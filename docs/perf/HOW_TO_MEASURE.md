# How to measure (and repeat the measurements)

Use the same conditions for the "before" and "after" runs: same machine, same
Chrome, no other heavy apps running, mains power, same network.

## 1. Automated lab run (what filled `metrics.md`)

```bash
# terminal 1: the API (in the backend repo)
npm run dev

# terminal 2: this repo
bash scripts/perf/measure.sh after     # or "before" on the old commit
```

`measure.sh` does a production build, writes `bundle-sizes.json`, `bundle.html`
and `bundle-analysis.json`, runs Lighthouse 3× per page (mobile preset), then
makes a profiling build and runs `render-profile.mjs`.

Restart the API between runs: its rate limiter keeps counts in memory, and a
`429` would show error states and skew the numbers. `measure.sh` can do it for
you before each phase: `BEFORE_STEP="./restart-api.sh" bash scripts/perf/measure.sh after`.

**How the report's before/after were produced** (same scripts, same machine, back to back):

```bash
git worktree add ../ums-before 90f7db9          # untouched app + tooling
cp scripts/perf/* ../ums-before/scripts/perf/    # the final scripts in both runs
cp .env.local ../ums-before/ && (cd ../ums-before && npm ci)
(cd ../ums-before && OUT_DIR=$PWD/../University_Management_System_frontend/docs/perf/before-rerun \
  BEFORE_STEP=./restart-api.sh bash scripts/perf/measure.sh before-rerun)
BEFORE_STEP=./restart-api.sh bash scripts/perf/measure.sh after
node scripts/perf/compare.mjs docs/perf/before-rerun docs/perf/after   # Markdown tables
```

`docs/perf/before/` holds the original Phase 1 audit (same app; it was the
first run, before the scripts gained median-of-3 and the large-list scenarios).

## 2. Lighthouse in Chrome by hand (local or the live Vercel URL)

1. Open an **Incognito** window (no extensions).
2. Sign in with the demo admin button on `/login`.
3. Open `/admin`. DevTools → **Lighthouse**.
4. Mode **Navigation**, Device **Mobile**, Category **Performance** only.
5. Settings (gear): **Simulated throttling** (default). Leave "Clear storage" ticked.
6. Click **Analyze page load**. Run 3 times and keep the median score.
7. Save: ⋮ → **Save as HTML** → `docs/perf/before/lighthouse-live-admin.html`
   (or `after/`). Repeat for `/admin/users`, `/admin/audit-logs`, `/student`.

Paste the numbers into `metrics.md`, section 1, row "Live deployment".

## 3. React DevTools Profiler (screenshots for the report)

1. Install the **React Developer Tools** extension.
2. Run a profiling build: `npx next build --profile && npx next start`.
3. Open `http://localhost:3000/admin/users`, sign in as admin.
4. DevTools → **⚛ Profiler** → gear → tick **"Record why each component rendered"**
   and **"Highlight updates when components render"**.
5. Click **Record** (●). Type `tester` into "Search users" at a normal pace. Stop.
6. Screenshot the **Flamegraph** and the **Ranked** view for the commit with the
   longest bar. Save them as `docs/perf/before/profiler-users-search.png`.
7. Repeat for:
   - `/admin`: record a page reload (⟳ "Reload and start profiling").
     Save as `profiler-admin-load.png`.
   - `/admin/audit-logs?view=all&dataset=sample` (after only): scroll
     the list quickly for 3 seconds. Save as `profiler-audit-scroll.png`.
8. Do the same on the "after" build into `docs/perf/after/`.

The automated script (`render-profile.mjs`) uses the same commit hook DevTools
uses, so its counts should match what the Profiler shows, give or take a commit.

## 4. INP in the field

INP needs real interactions. In Chrome DevTools → **Performance**, the live
metrics panel shows INP while you click and type. Interact with the users search
and the audit filters for ~20 seconds and note the INP value it reports.
