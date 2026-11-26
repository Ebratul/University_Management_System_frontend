#!/usr/bin/env node
/**
 * Prints Markdown before/after tables from two measurement folders, so the
 * report's numbers come straight from the JSON files, never retyped.
 *
 *   node scripts/perf/compare.mjs docs/perf/before-rerun docs/perf/after
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [beforeDir, afterDir] = process.argv.slice(2);
const read = (dir, file) => {
  const path = join(dir, file);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
};

const pct = (b, a) => (b && a !== undefined ? `${a - b > 0 ? "+" : ""}${(((a - b) / b) * 100).toFixed(0)}%` : "");
const fmt = (v, unit = "") => (v === undefined || v === null ? "n/a" : `${v}${unit}`);

// ---------- Lighthouse ----------
const lb = read(beforeDir, "lighthouse/lighthouse-summary.json");
const la = read(afterDir, "lighthouse/lighthouse-summary.json");
if (lb && la) {
  console.log("### Lighthouse (mobile, median of 3)\n");
  console.log("| Page | Score | LCP | TBT | CLS | FCP | Speed Index | JS transferred |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const b of lb.pages) {
    const a = la.pages.find((p) => p.page === b.page);
    if (!a) continue;
    const cell = (k, unit = "") => `${fmt(b[k], unit)} → **${fmt(a[k], unit)}**`;
    console.log(`| \`${b.page}\` | ${b.score} → **${a.score}** | ${cell("LCP s", " s")} | ${cell("TBT ms", " ms")} | ${cell("CLS")} | ${cell("FCP s", " s")} | ${cell("SI s", " s")} | ${cell("JS KB (transfer)", " KB")} |`);
  }
  console.log("");
}

// ---------- Bundle ----------
const bb = read(beforeDir, "bundle-sizes.json");
const ba = read(afterDir, "bundle-sizes.json");
if (bb && ba) {
  console.log("### Initial JavaScript per route (gzip)\n");
  console.log("| Route | Before | After | Change |");
  console.log("|---|---|---|---|");
  const routes = ["/", "/login", "/register", "/admin", "/admin/users", "/admin/audit-logs", "/admin/courses", "/admin/enrollments", "/admin/offerings", "/faculty", "/faculty/offerings/[id]", "/student", "/student/registration"];
  for (const route of routes) {
    const b = bb.routes.find((r) => r.route === route);
    const a = ba.routes.find((r) => r.route === route);
    if (b && a) console.log(`| \`${route}\` | ${b.gzipKB} KB | **${a.gzipKB} KB** | ${pct(b.gzipKB, a.gzipKB)} |`);
  }
  const avg = (rows) => rows.reduce((s, r) => s + r.gzipKB, 0) / rows.length;
  const shared = (list) => list.filter((r) => !r.route.startsWith("/_"));
  console.log(`| **Average, all ${shared(ba.routes).length} routes** | ${avg(shared(bb.routes)).toFixed(1)} KB | **${avg(shared(ba.routes)).toFixed(1)} KB** | ${pct(avg(shared(bb.routes)), avg(shared(ba.routes)))} |`);
  const maxLargest = (rows) => Math.max(...rows.map((r) => r.largestKB));
  console.log(`| Largest initial chunk | ${maxLargest(bb.routes)} KB | **${maxLargest(ba.routes)} KB** | ${pct(maxLargest(bb.routes), maxLargest(ba.routes))} |`);
  console.log(`| All client chunks (incl. lazy) | ${bb.summary.allChunksGzipKB} KB | ${ba.summary.allChunksGzipKB} KB | ${pct(bb.summary.allChunksGzipKB, ba.summary.allChunksGzipKB)} |`);
  console.log("");
}

// ---------- Render profile ----------
const rb = read(beforeDir, "render-profile.json");
const ra = read(afterDir, "render-profile.json");
if (rb && ra) {
  console.log("### Render profile (profiling build, 4× CPU, median of 3)\n");
  console.log("| Scenario | Commits | Component renders | Render time | Worst interaction | Long-frame blocking | DOM nodes |");
  console.log("|---|---|---|---|---|---|---|");
  const names = [...new Set([...rb.results, ...ra.results].map((r) => r.scenario))];
  for (const name of names) {
    const b = rb.results.find((r) => r.scenario === name);
    const a = ra.results.find((r) => r.scenario === name);
    const cell = (k, unit = "") => `${b ? fmt(b[k], unit) : "n/a"} → **${a ? fmt(a[k], unit) : "n/a"}**`;
    console.log(`| ${name} | ${cell("commits")} | ${cell("componentRenders")} | ${cell("renderMs", " ms")} | ${cell("worstInteractionMs", " ms")} | ${cell("longFrameBlockingMs", " ms")} | ${cell("domNodes")} |`);
  }
  console.log("\n_n/a before: the 5,000-row views did not exist yet (lists were capped at 50 rows); see docs/perf/evidence for the non-virtualized vs virtualized comparison._");
}
