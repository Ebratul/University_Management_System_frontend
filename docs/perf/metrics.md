# Performance metrics: before / after

All lab numbers come from the same machine, the same scripts and the same
settings for both columns. Nothing in this file is estimated. Where a number
has to come from a manual tool run, the cell says **TODO** and the steps are in
[HOW_TO_MEASURE.md](./HOW_TO_MEASURE.md).

**Setup**
- `next build` + `next start` (production) on localhost, API running locally against the same database.
- Lighthouse 13.6.0 CLI, mobile preset (Moto G Power, simulated slow 4G, 4× CPU), headless Chrome with a fresh profile per run, 3 runs per page, median by score.
- Render profile: `next build --profile --no-mangling`, Chrome 1440×900, 4× CPU slowdown, counted with the React DevTools commit hook (`scripts/perf/render-profile.mjs`).
- Bundle: `scripts/perf/bundle-size.mjs` (gzip −9 of each route's initial JS) and `next experimental-analyze --output` (per-package view in `bundle.html`).

Raw data: [`before/`](./before) and [`after/`](./after).

## 1. Lighthouse (lab, mobile)

| Page | Metric | Before | After | Target |
|---|---|---|---|---|
| `/admin` | Performance score | 98 (98/98/98) | | |
| | LCP | 1.06 s | | ≤ 2.5 s |
| | TBT (lab proxy for INP) | 140 ms | | ≤ 200 ms |
| | CLS | 0 | | ≤ 0.1 |
| | FCP | 1.06 s | | |
| | Speed Index | 2.79 s | | |
| `/admin/users` | Score / LCP / TBT / CLS | 99 / 1.54 s / 77 ms / 0.002 | | |
| `/admin/audit-logs` | Score / LCP / TBT / CLS | 99 / 1.58 s / 56 ms / 0.001 | | |
| `/student` | Score / LCP / TBT / CLS | 98 / 1.06 s / 49 ms / **0.089** | | |
| `/` (public home) | Score / LCP / TBT / CLS | 82 / **4.84 s** / 45 ms / 0 | | |

Live deployment (Vercel), run by hand: **TODO**, see HOW_TO_MEASURE.md §2.

## 2. JavaScript (gzip, initial load per route)

| Route | Before | After |
|---|---|---|
| `/admin` | 220.7 KB | |
| `/admin/users` | 357.4 KB | |
| `/admin/audit-logs` | 221.9 KB | |
| `/admin/courses` | 350.2 KB | |
| `/student` | 223.1 KB | |
| `/login` | 306.9 KB | |
| Largest initial chunk | 88.6 KB (zod + forms) | |
| All client chunks, whole app | 971.0 KB | |

## 3. Render profile (profiling build, 4× CPU)

| Scenario | Metric | Before | After |
|---|---|---|---|
| `/admin` load | React commits | 114 | |
| | Component renders | 2,680 | |
| | Render time (sum of self time) | 336.7 ms | |
| Typing "tester" in users search (6 keys) | `UsersManager` renders | 8 | |
| | Component renders | 1,899 | |
| | Worst interaction (Event Timing) | 32 ms | |
| Typing "LOGIN" in audit-log filter (5 keys) | Component renders | 90 | |
| | Worst interaction | 24 ms | |
| `/student` load | Commits / renders / render time | 10 / 209 / 137.6 ms | |
| 5,000-row audit log, 20 wheel scrolls | Rows in DOM / worst interaction | n/a (list capped at 50 rows) | |
| 5,000-row users list, 20 wheel scrolls | Rows in DOM / worst interaction | n/a (list capped at 50 rows) | |

Manual React DevTools Profiler screenshots: **TODO**, see HOW_TO_MEASURE.md §3.
