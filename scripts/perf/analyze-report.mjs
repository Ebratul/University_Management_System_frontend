#!/usr/bin/env node
/**
 * Turns the output of `next experimental-analyze --output` into one
 * self-contained HTML report (no server needed) plus a JSON file that two
 * runs can be diffed with.
 *
 * Only client JavaScript is counted (files under .next/static/chunks), which
 * is what the browser downloads. Sizes are Turbopack's compressed estimates.
 *
 *   npx next experimental-analyze --output
 *   node scripts/perf/analyze-report.mjs docs/perf/before
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: analyze-report.mjs <output-dir>");
  process.exit(1);
}

const DATA = join(process.cwd(), ".next/diagnostics/analyze/data");
const ROUTES = [
  "/",
  "/admin",
  "/admin/users",
  "/admin/audit-logs",
  "/admin/enrollments",
  "/admin/courses",
  "/faculty",
  "/faculty/offerings/[id]",
  "/student",
  "/student/registration",
  "/login",
];

function readAnalyze(route) {
  const file = join(DATA, route === "/" ? "" : route, "analyze.data");
  if (!existsSync(file)) return undefined;
  const buf = readFileSync(file);
  const headerLength = buf.readUInt32BE(0);
  return JSON.parse(buf.subarray(4, 4 + headerLength).toString());
}

/** Groups a module path into a package (node_modules) or a source folder. */
function bucket(path) {
  const nm = path.lastIndexOf("node_modules/");
  if (nm !== -1) {
    const rest = path.slice(nm + "node_modules/".length).split("/");
    return rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0];
  }
  const src = path.indexOf("src/");
  if (src !== -1) {
    const parts = path.slice(src).split("/");
    return parts.slice(0, Math.min(3, parts.length - 1)).join("/") || path.slice(src);
  }
  return "(other)";
}

function analyse(route) {
  const data = readAnalyze(route);
  if (!data) return undefined;
  const fullPath = new Map();
  const resolve = (index) => {
    if (fullPath.has(index)) return fullPath.get(index);
    const source = data.sources[index];
    const parent = source.parent_source_index;
    const value = parent === undefined || parent === null ? source.path : `${resolve(parent)}${source.path}`;
    fullPath.set(index, value);
    return value;
  };

  const groups = new Map();
  const files = new Map();
  let total = 0;
  for (const part of data.chunk_parts) {
    const filename = data.output_files[part.output_file_index].filename;
    if (!filename.includes("/static/chunks/") || !filename.endsWith(".js")) continue;
    const size = part.compressed_size;
    total += size;
    const group = bucket(resolve(part.source_index));
    groups.set(group, (groups.get(group) ?? 0) + size);
    files.set(filename, (files.get(filename) ?? 0) + size);
  }
  const top = [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([name, size]) => ({ name, kb: +(size / 1024).toFixed(1) }));
  const largestFile = [...files.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    route,
    totalKB: +(total / 1024).toFixed(1),
    largestChunk: largestFile ? { file: largestFile[0].split("/").pop(), kb: +(largestFile[1] / 1024).toFixed(1) } : undefined,
    groups: top,
  };
}

const results = ROUTES.map(analyse).filter(Boolean);
writeFileSync(join(outDir, "bundle-analysis.json"), JSON.stringify({ generatedAt: new Date().toISOString(), routes: results }, null, 2));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sections = results
  .map((r) => {
    const max = r.groups[0]?.kb || 1;
    const rows = r.groups
      .slice(0, 25)
      .map(
        (g) => `<tr><td class="name">${esc(g.name)}</td><td class="num">${g.kb.toFixed(1)}</td><td class="bar"><span style="width:${((g.kb / max) * 100).toFixed(1)}%"></span></td></tr>`,
      )
      .join("");
    return `<section><h2>${esc(r.route)} <small>${r.totalKB.toFixed(1)} KB client JS · largest chunk ${esc(r.largestChunk?.file ?? "-")} (${r.largestChunk?.kb ?? 0} KB)</small></h2>
<table><thead><tr><th>Package / source folder</th><th class="num">KB (compressed)</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
  })
  .join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bundle analysis</title>
<style>
:root{--bg:#FAF8F5;--surface:#fff;--border:#E7E1D8;--text:#1C1917;--muted:#78716C;--accent:#15803D}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--surface:#1C1C1E;--border:#2E2E32;--text:#E4E4E7;--muted:#A1A1AA;--accent:#34D399}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif;padding:32px 16px}
main{max-width:1100px;margin:0 auto}h1{font-size:28px;letter-spacing:-.02em;margin:0 0 4px}p{color:var(--muted);margin:0 0 32px}
section{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:24px;overflow-x:auto}
h2{font-size:18px;margin:0 0 16px}h2 small{display:block;font-weight:400;color:var(--muted);font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:left}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.name{font-family:ui-monospace,monospace;word-break:break-all}
.bar{width:40%}.bar span{display:block;height:8px;border-radius:4px;background:var(--accent)}
</style></head><body><main><h1>Bundle analysis</h1>
<p>Generated ${esc(new Date().toISOString())} from <code>next experimental-analyze --output</code>. Client JavaScript only, grouped by npm package or source folder. Lazy chunks are included, because the analyzer counts every chunk a route can load.</p>
${sections}</main></body></html>`;
writeFileSync(join(outDir, "bundle.html"), html);
for (const r of results) console.log(`${r.route.padEnd(26)} ${String(r.totalKB).padStart(7)} KB  top: ${r.groups.slice(0, 5).map((g) => `${g.name} ${g.kb}`).join(", ")}`);
