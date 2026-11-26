#!/usr/bin/env node
/**
 * Lab Lighthouse runs against a local production server (`next build && next start`).
 *
 * - Mobile preset (Lighthouse default: Moto G Power, simulated slow 4G, 4x CPU slowdown).
 * - Headless Chrome, fresh profile per run (equivalent to incognito).
 * - Signed-in pages get the session cookie from /api/demo-login/<role>.
 * - RUNS runs per page; the median run by performance score is kept.
 *
 *   BASE=http://localhost:3000 RUNS=3 node scripts/perf/lighthouse.mjs docs/perf/before
 *
 * INP needs a real interaction, so it is not a lab metric. TBT is the lab proxy
 * Lighthouse reports instead; real INP comes from the Performance panel / field data.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? "docs/perf/lighthouse";
const BASE = process.env.BASE ?? "http://localhost:3000";
const RUNS = Number(process.env.RUNS ?? 3);
const LH = process.env.LIGHTHOUSE_BIN ?? "lighthouse";
const ONLY = process.env.ONLY?.split(",");

const PAGES = [
  { name: "home", path: "/", role: undefined },
  { name: "admin-overview", path: "/admin", role: "admin" },
  { name: "admin-users", path: "/admin/users", role: "admin" },
  { name: "admin-audit-logs", path: "/admin/audit-logs", role: "admin" },
  { name: "student-overview", path: "/student", role: "student" },
];

const sessions = new Map();
async function sessionCookie(role) {
  if (sessions.has(role)) return sessions.get(role);
  const response = await fetch(`${BASE}/api/demo-login/${role}`, { method: "POST" });
  if (!response.ok) throw new Error(`demo login for ${role} failed: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  sessions.set(role, cookie);
  return cookie;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

mkdirSync(outDir, { recursive: true });
const summary = [];

for (const page of PAGES) {
  if (ONLY && !ONLY.includes(page.path)) continue;
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    // One login per role (the API rate-limits logins); the proxy refreshes expired access tokens.
    const cookie = page.role ? await sessionCookie(page.role) : undefined;
    const reportPath = join(outDir, `${page.name}.run${i + 1}.json`);
    const args = [
      `${BASE}${page.path}`,
      "--only-categories=performance",
      "--output=json",
      `--output-path=${reportPath}`,
      "--chrome-flags=--headless=new --no-first-run --disable-extensions",
      "--quiet",
    ];
    if (cookie) args.push(`--extra-headers=${JSON.stringify({ Cookie: cookie })}`);
    execFileSync(LH, args, { stdio: "inherit" });

    const lhr = JSON.parse(readFileSync(reportPath, "utf8"));
    if (lhr.finalDisplayedUrl && !lhr.finalDisplayedUrl.includes(page.path === "/" ? BASE : page.path)) {
      throw new Error(`${page.path} redirected to ${lhr.finalDisplayedUrl}; the session cookie was not accepted.`);
    }
    const a = lhr.audits;
    runs.push({
      file: reportPath,
      score: Math.round(lhr.categories.performance.score * 100),
      fcp: a["first-contentful-paint"].numericValue,
      lcp: a["largest-contentful-paint"].numericValue,
      tbt: a["total-blocking-time"].numericValue,
      cls: a["cumulative-layout-shift"].numericValue,
      si: a["speed-index"].numericValue,
      jsKB: (a["network-requests"]?.details?.items ?? [])
        .filter((r) => r.resourceType === "Script")
        .reduce((sum, r) => sum + (r.transferSize ?? 0), 0) / 1024,
    });
  }
  const m = median(runs.map((r) => r.score));
  const chosen = runs.find((r) => r.score === m);
  summary.push({
    page: page.path,
    score: chosen.score,
    scores: runs.map((r) => r.score).join("/"),
    "FCP s": +(chosen.fcp / 1000).toFixed(2),
    "LCP s": +(chosen.lcp / 1000).toFixed(2),
    "TBT ms": Math.round(chosen.tbt),
    CLS: +chosen.cls.toFixed(3),
    "SI s": +(chosen.si / 1000).toFixed(2),
    "JS KB (transfer)": +chosen.jsKB.toFixed(1),
    report: chosen.file,
  });
}

console.table(summary);
writeFileSync(join(outDir, "lighthouse-summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, runs: RUNS, pages: summary }, null, 2));
