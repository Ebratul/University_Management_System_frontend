#!/usr/bin/env node
/**
 * Measures the JavaScript each route loads on first visit, from a finished
 * `next build`. Next 16 no longer prints bundle sizes, so this reads the
 * per-route client-reference manifests that Turbopack writes and gzips the
 * chunks they list (plus the shared runtime in build-manifest.json).
 *
 * Lazy chunks (next/dynamic, React.lazy) are NOT counted: they are fetched
 * after the page shell, which is exactly the saving code splitting buys.
 *
 *   node scripts/perf/bundle-size.mjs [--json out.json] [--routes /admin,/student]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const NEXT = join(process.cwd(), ".next");
const args = process.argv.slice(2);
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : undefined;
const onlyRoutes = args.includes("--routes") ? args[args.indexOf("--routes") + 1].split(",") : undefined;

const gz = new Map();
function gzipSize(file) {
  if (!gz.has(file)) gz.set(file, gzipSync(readFileSync(join(NEXT, file)), { level: 9 }).length);
  return gz.get(file);
}

function findManifests(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) findManifests(full, out);
    else if (name === "page_client-reference-manifest.js") out.push(full);
  }
  return out;
}

/** "(dashboard)/admin/audit-logs" -> "/admin/audit-logs" */
function toRoute(file) {
  const seg = relative(join(NEXT, "server/app"), file).split("/").slice(0, -1);
  const route = "/" + seg.filter((s) => !(s.startsWith("(") && s.endsWith(")"))).join("/");
  return route === "/" ? "/" : route.replace(/\/$/, "");
}

const buildManifest = JSON.parse(readFileSync(join(NEXT, "build-manifest.json"), "utf8"));
const shared = new Set(buildManifest.rootMainFiles);

const rows = [];
for (const file of findManifests(join(NEXT, "server/app"))) {
  globalThis.__RSC_MANIFEST = {};
  delete require.cache[file];
  require(file);
  const manifest = Object.values(globalThis.__RSC_MANIFEST)[0];
  const route = toRoute(file);
  if (onlyRoutes && !onlyRoutes.includes(route)) continue;

  // The page entry is the longest key; it inherits every layout above it.
  const entries = Object.entries(manifest.entryJSFiles ?? {});
  const files = new Set(shared);
  for (const [, list] of entries.filter(([k]) => !/\/(error|not-found|global-error|loading)$/.test(k))) {
    for (const f of list) files.add(f);
  }
  let total = 0;
  let largest = { file: "", size: 0 };
  for (const f of files) {
    const size = gzipSize(f);
    total += size;
    if (size > largest.size) largest = { file: f, size };
  }
  rows.push({ route, chunks: files.size, gzipKB: +(total / 1024).toFixed(1), largestChunk: largest.file, largestKB: +(largest.size / 1024).toFixed(1) });
}

rows.sort((a, b) => a.route.localeCompare(b.route));

// Whole-app totals: every emitted chunk, lazy ones included.
const chunkDir = join(NEXT, "static/chunks");
let all = 0;
let biggest = { file: "", size: 0 };
for (const name of readdirSync(chunkDir).filter((n) => n.endsWith(".js"))) {
  const size = gzipSize(`static/chunks/${name}`);
  all += size;
  if (size > biggest.size) biggest = { file: name, size };
}
const summary = { allChunksGzipKB: +(all / 1024).toFixed(1), largestChunk: biggest.file, largestChunkGzipKB: +(biggest.size / 1024).toFixed(1) };

console.table(rows);
console.log(summary);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), summary, routes: rows }, null, 2));
