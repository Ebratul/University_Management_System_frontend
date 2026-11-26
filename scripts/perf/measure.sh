#!/usr/bin/env bash
# One command for a full, repeatable measurement into docs/perf/<label>:
#   1. production build -> bundle sizes, analyzer report, Lighthouse (3 runs, mobile)
#   2. profiling build (--profile --no-mangling) -> render counts / interaction latency
#
# Needs the API reachable at BACKEND_URL (see .env.local) and Chrome installed.
#   bash scripts/perf/measure.sh before
set -euo pipefail
LABEL="${1:?usage: measure.sh <before|after>}"
OUT="docs/perf/$LABEL"
PORT="${PORT:-3000}"
mkdir -p "$OUT/lighthouse"

serve() {
  fuser -k "$PORT/tcp" >/dev/null 2>&1 || true
  npx next start -p "$PORT" >/dev/null 2>&1 &
  SERVER=$!
  for _ in $(seq 1 60); do curl -sf -o /dev/null "http://localhost:$PORT/" && return 0; sleep 1; done
  echo "server did not start" >&2; exit 1
}
# npx is a wrapper: kill whatever holds the port, or an orphaned next-server keeps serving an old build.
stop() { kill "$SERVER" 2>/dev/null || true; fuser -k "$PORT/tcp" >/dev/null 2>&1 || true; wait "$SERVER" 2>/dev/null || true; }

echo "== production build"
rm -rf .next
npx next build >/dev/null
node scripts/perf/bundle-size.mjs --json "$OUT/bundle-sizes.json" >/dev/null
npx next experimental-analyze --output >/dev/null
node scripts/perf/analyze-report.mjs "$OUT"

echo "== lighthouse"
serve
BASE="http://localhost:$PORT" RUNS="${RUNS:-3}" node scripts/perf/lighthouse.mjs "$OUT/lighthouse"
stop
# Keep the median report per page only.
node -e '
const fs=require("fs"),p=process.argv[1];const keep=new Set(require("./"+p+"/lighthouse-summary.json").pages.map(x=>x.report.split("/").pop()));
for(const f of fs.readdirSync(p)) if(f.endsWith(".json")&&f!=="lighthouse-summary.json"&&!keep.has(f)) fs.rmSync(p+"/"+f);' "$OUT/lighthouse"

echo "== profiling build"
rm -rf .next
npx next build --profile --no-mangling >/dev/null
serve
BASE="http://localhost:$PORT" RUNS="${RUNS:-3}" node scripts/perf/render-profile.mjs "$OUT"
stop
echo "done: $OUT"
