# Performance report: University Management System dashboard

**Task:** ForegX-7, React Performance & Optimization
**Project:** University Management System, the web app for administrators, faculty and students (Next.js 16 App Router, React 19 with React Compiler, Tailwind v4 + shadcn/ui, TanStack Query/Form, Zustand)
**Repository:** https://github.com/Ebratul/University_Management_System_frontend
**Live:** https://university-management-system-m55d.vercel.app

Every number below was measured. Nothing is estimated. The "before" column was measured from
commit `90f7db9` (the untouched app plus the measurement tooling), and the "after" column from `main`. Both ran back to back on
the same machine with the same scripts (`scripts/perf/measure.sh`). Raw data is in [`docs/perf/`](perf).
Manual tool runs that only you can do (Lighthouse on the live URL, Profiler screenshots) are
marked **TODO** with steps in [`docs/perf/HOW_TO_MEASURE.md`](perf/HOW_TO_MEASURE.md).

---

## 1. Results at a glance

<!-- RESULTS:START -->
| Area | Before | After |
|---|---|---|
| `/admin` load: React commits / component renders | 126 / 2,860 | **20 / 703** |
| Typing in users search: component renders | 1,899 | **480 (−75%)** |
| 5,000-row list: DOM nodes (users / audit) | 55,180 / 65,170 | **423 / 463** |
| 5,000-row list: longest frame on scroll | 3.4 s / 4.0 s | **no long frames** |
| 5,000-row audit filter: main-thread blocking | 4,569 ms | **0 ms** |
| `/student` CLS | 0.08 | **0.008** |
| Initial JS, `/admin/users` / `/admin/courses` / `/login` | 357 / 350 / 307 KB | **240 / 228 / 248 KB** |
| Initial JS, average of 53 routes | 273.1 KB | **244.5 KB (−10%)** |
| Lighthouse scores (5 pages) | 82, 99, 99, 99, 98 | **84, 99, 100, 100, 99** |
<!-- RESULTS:END -->

**Targets** (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1): all dashboard pages meet them: LCP 1.53–1.69 s, CLS ≤ 0.008, TBT (lab proxy for INP) 21–72 ms, worst measured interaction 24 ms. **The public home page misses the LCP target** (4.52 s simulated slow 4G, 0.47 s observed); see §13.

---

## 2. How it was measured

| What | Tool | Settings |
|---|---|---|
| Lighthouse | Lighthouse 13.6 CLI, `scripts/perf/lighthouse.mjs` | Mobile preset (Moto G Power, simulated slow 4G, 4× CPU); headless Chrome, fresh profile per run (incognito-equivalent); 3 runs, median by score; signed-in pages use the demo-login cookie |
| Bundle | `scripts/perf/bundle-size.mjs` | gzip −9 of every chunk a route loads on first visit (from Turbopack's per-route manifests); lazy chunks excluded |
| Bundle composition | `next experimental-analyze --output` → `scripts/perf/analyze-report.mjs` | Self-contained [`before/bundle.html`](perf/before/bundle.html) and [`after/bundle.html`](perf/after/bundle.html), per npm package |
| Renders | `scripts/perf/render-profile.mjs` | `next build --profile --no-mangling`; a React DevTools hook counts the components that actually rendered in each commit (same test DevTools uses) plus `actualDuration`; Event Timing (INP's source) and Long Animation Frames; 4× CPU; median of 3 |
| Responsive / theme QA | Puppeteer sweep | 375 / 768 / 1440 px × light / dark × 27 routes × 3 roles: overflow, console errors, theme class |

Next 16 no longer prints bundle sizes and `@next/bundle-analyzer` only supports webpack builds,
so the Turbopack-native analyzer is used.

---

## 3. Initial bottlenecks (Phase 1 audit)

1. **Chart animation storm on `/admin`.** Recharts animated the donut and bars on mount, and every frame was a React commit: **114 commits and 2,680 component renders per load**.
2. **Every keystroke re-rendered whole list pages.** Search state lived at the top of each of the 10 admin managers, so typing re-rendered the table, every row's dropdown menu and the dialogs. In `/admin/users`, 6 keystrokes caused **1,899 component renders**.
3. **The overview loaded its data in a chain.** `AdminOverview` was one 150-line client component: HTML, then JS, then hydration, then `fetch(/admin/dashboard/stats)`, then paint.
4. **zod shipped whole.** `import { z } from "zod"` pulled in every locale and the JSON-schema code: **131 KB compressed** on every form route, and the largest chunk (88.6 KB gzip).
5. **Forms shipped up front.** Create/edit forms (zod, TanStack Form, field components) were bundled into list pages that only use them after a click.
6. **Layout shift on `/student`.** Skeletons didn't match the real cards: **CLS 0.089**.
7. **Non-virtualized tables.** They were fine at the 10–50 row cap. But rendering 1,000+ rows (see §5) put 55–65k nodes in the DOM and produced **3.4–4 s frames** on first scroll.
8. **Whole-user session context.** Any refetch of `/users/me` re-rendered every consumer.
9. **The public home page's LCP image** (cross-origin, no priority) queued behind fonts and JS: simulated LCP **4.84 s**.

---

## 4. Techniques implemented, with per-change evidence

Each row is one commit. The commit message holds the full before/after detail.

| # | Change | Phase | Evidence (before → after) | Commit |
|---|---|---|---|---|
| 1 | Disable chart entry animations | 2 | `/admin` load: 114 → 17 commits, 2,680 → 776 component renders | `512c362` |
| 2 | Colocate search state in `ListToolbar` | 2 | Typing in users search: `UsersManager` 8 → 2 renders, 1,899 → 466 component renders (−75 %), worst interaction 32 → 16 ms | `52e882e` |
| 3 | Server-render and split the admin overview | 2 + 6 | `/admin` initial JS 220.7 → 216.8 KB; load render time 300 → 219 ms (median of 3) | `abdda11` |
| 4 | Same-size skeletons (stat cards, course and notice cards, profile badges) | 5 / CLS | `/student` CLS 0.089 → 0.007, score 98 → 100 | `37fb29b` |
| 5 | `useDebounce` hooks; `useUrlParam` rebuilt on `useDebouncedCallback` (`useRef` timer) | 4 | URL updates once per pause instead of per keystroke (verified in the browser) | `75a8c54` |
| 6 | Virtualize users and audit-log "All records" | 3 | 5,000 rows: DOM 55,180 → 423 (users), 65,170 → 459 (audit); scroll long frame 3.4 s / 4.0 s → none; filter blocking 4,569 → 0 ms | `62ae5bf` |
| 7 | Selective session subscriptions (`useSessionSelector`) | 4 | Unit test: a role subscriber stays at 1 render when the email changes | `81d8592` |
| 8 | Dashboard header as a Server Component with 3 islands | 6 | −1.1 KB (`/admin`), −0.7 KB (`/student`); student load 10 → 7 commits | `486d434` |
| 9 | Tree-shakable zod imports | 5 | `/login` 306.9 → 247.5 KB, `/admin/courses` 350.2 → 290.1 KB; largest chunk 88.6 → 71.5 KB | `2755698` |
| 10 | Lazy-load create/edit forms (`next/dynamic` + `FormSkeleton`) | 5 | `/admin/users` 311.0 → 252.1 KB, `/admin/courses` 290.1 → 228.0 KB | `5448068` |
| 11 | Lazy-load `VirtualTable` | 5 | `/admin/audit-logs` 235.5 → 224.4 KB, `/admin/users` 252.1 → 239.7 KB | `e45e0df` |
| 12 | Hero image preload + `fetchpriority`; no mono-font preload | 5 | Home simulated LCP 4.84 → 4.52 s; "LCP request discovery" passes | `7234649` |
| 13 | Debounce the quiz-results (API) and registration searches | 4 | One API request per pause instead of about one per keystroke | `15f829d` |
| 14 | Remove unused `date-fns`; `shadcn` CLI to devDependencies | 5 | Dependency hygiene; no bundle effect (it was never imported) | `0133b8e` |
| 15 | Module-level column definitions | 2 | Found by the final profile: audit filter typing 185 → 97 renders, 9.7 → 5.2 ms | `d697ca9` |
| 16 | Compositor-only skeleton shimmer (`transform` on `::after`) | 5 | Found by the final Lighthouse run: `/student` TBT 111 → 49 ms, `/admin/audit-logs` 121 → 21 ms | `df42c7d` |

Design commits: `32d0aea` (tokens), `9e5354b` (components), `a941749` (validated chart palette).
Responsive fixes found by the QA sweep: `8bf7784`, `99ffcf8`.

### Why there is little manual `React.memo` / `useMemo` / `useCallback`

React Compiler was already on (`reactCompiler: true`). It memoizes components, values and callbacks
automatically, so hand-written memoization mostly duplicates its work. The rendering wins came from what the compiler *can't*
fix: where state lives (#2), what renders on the client at all (#3, #8), what subscribes to what (#7),
animation-driven commits (#1), and DOM size (#6). `useMemo` is used explicitly where it documents intent on
expensive work (filtering 5,000 rows, `features/users/users-manager.tsx`, `features/audit/audit-log-viewer.tsx`).
`VirtualTable` opts *out* of the compiler with `"use no memo"`, because TanStack Virtual returns a mutable instance.

---

## 5. Data for the large-list requirement

The API caps list pages at 100 rows and the real database is small, so the two virtualized lists get
an **All records** view (`?view=all`) with two data sources:
- **Live data**: every page of the real API (100 per request, 5 in parallel, capped at 5,000). The real audit log has 563 entries.
- **Sample (5,000 rows)**: a seeded generator (`src/lib/sample-data.ts`, mulberry32 PRNG; deterministic, so profiling runs are comparable), loaded as its own chunk only when selected. It is labelled in the UI, never sent to the API, and row actions are disabled. A hand-written PRNG replaces `@faker-js/faker` to avoid about 1 MB of dependency.

---

## 6. Server / Client boundaries

| Boundary | Before | After | Client JS removed |
|---|---|---|---|
| `/admin` overview | One client component; stats fetched in the browser after hydration | Server Component page; stats fetched on the server (request-cached) and **streamed** behind `<Suspense>` with a same-size skeleton; only the two lazy charts, `RetryButton` and `LocalTime` hydrate | 3.9 KB gzip initial, plus no client fetch before the figures paint |
| Dashboard header (every signed-in page) | Whole header client-side (`RoleGate` wrappers, links, avatar, sheet) | Server shell; islands: `HeaderIdentity` (selective subscription), `LogoutButton`, `MobileNav` | 0.7–1.1 KB gzip per route |
| `PageHeader`, `StatCard`, `AdminShortcuts`, `AdminInsights` | Used inside client trees | Server Components (no `"use client"`) | Included in the figures above |

Parallel fetching: the stat grid, the "updated" time and the roles chart all read `getAdminStats()`
wrapped in React `cache()`, which makes one request per render. The seat chart fetches independently in parallel.

---

## 7. Design system

Tokens are in `src/app/globals.css` as CSS custom properties with the spec's names (`--bg`, `--surface`,
`--surface-muted`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--accent-soft`,
`--danger`, `--warning`). shadcn's semantic tokens map onto them, so light and dark switch by tokens only.

Contrast was checked with a script, not by eye:
- Body text 16.5:1 (light) and 14.8:1 (dark). Muted text 4.53:1 on `--bg` and 4.80:1 on `--surface`.
- **Muted text on `--surface-muted` is only 4.19:1**, so text on that surface (for example the sticky table header) uses `--text`.
- The spec's `--border` (1.3:1) is kept for cards and dividers. Form controls get a separate `--input` border (#948D86 light / #71717A dark) that meets the 3:1 non-text rule (WCAG 1.4.11).
- The chart palette passed the dataviz validator (lightness band, chroma floor, colour-blind and normal-vision separation, 3:1 on surface) in both modes.

The rest follows the spec: 40 px buttons and inputs with a 10 px radius, 2 px focus ring at 40 %, 16 px cards with a light-only shadow and a
transform-only hover lift (disabled under `prefers-reduced-motion`), 48 px table rows with a sticky
`--surface-muted` header, a shimmer skeleton that respects reduced motion, Inter via `next/font`, 40 px semibold titles with
one italic accent word, an 8-pt spacing scale, and 4/2/1 stat grids.

---

## 8. Before / after Lighthouse

<!-- LIGHTHOUSE:START -->
| Page | Score | LCP | TBT | CLS | FCP | Speed Index | JS transferred |
|---|---|---|---|---|---|---|---|
| `/` | 82 → **84** | 4.84 s → **4.52 s** | 35 ms → **63 ms** | 0 → **0** | 1.21 s → **1.21 s** | 1.21 s → **1.21 s** | 378.2 KB → **319 KB** |
| `/admin` | 99 → **99** | 1.38 s → **1.69 s** | 100 ms → **72 ms** | 0 → **0** | 1.38 s → **1.69 s** | 2.84 s → **2.29 s** | 375.9 KB → **367.9 KB** |
| `/admin/users` | 99 → **100** | 1.39 s → **1.54 s** | 101 ms → **47 ms** | 0.002 → **0.004** | 1.39 s → **1.54 s** | 2.02 s → **1.82 s** | 406.1 KB → **281.6 KB** |
| `/admin/audit-logs` | 99 → **100** | 1.7 s → **1.53 s** | 33 ms → **21 ms** | 0.001 → **0.002** | 1.7 s → **1.53 s** | 1.7 s → **1.53 s** | 266.4 KB → **265.6 KB** |
| `/student` | 98 → **99** | 1.53 s → **1.55 s** | 28 ms → **49 ms** | 0.08 → **0.008** | 1.53 s → **1.55 s** | 2.01 s → **1.94 s** | 267.6 KB → **262.8 KB** |

LCP and TBT on these pages move between runs (the local API sits in front of a remote database).
The first full "after" run, one fix earlier, measured LCP 1.21 s (`/admin`), 1.06 s (`/admin/users`)
and 1.06 s (`/student`); the table above is the final run, reported as measured. That run's
`/admin` LCP (1.69 s) is higher than before (1.38 s), and both are within the 2.5 s target.
<!-- LIGHTHOUSE:END -->

**Live deployment: TODO.** `*.vercel.app` was not reachable from the machine these runs were made on.
Run Lighthouse on the live URL with HOW_TO_MEASURE.md §2 and paste the numbers here:

| Page | Score | LCP | TBT | CLS |
|---|---|---|---|---|
| `/admin` (live) | TODO | TODO | TODO | TODO |
| `/admin/users` (live) | TODO | TODO | TODO | TODO |
| `/student` (live) | TODO | TODO | TODO | TODO |

## 9. Before / after bundle analysis

<!-- BUNDLE:START -->
| Route | Before | After | Change |
|---|---|---|---|
| `/` | 212 KB | **212 KB** | 0% |
| `/login` | 306.9 KB | **247.6 KB** | -19% |
| `/register` | 327.6 KB | **268.4 KB** | -18% |
| `/admin` | 220.7 KB | **215.7 KB** | -2% |
| `/admin/users` | 357.4 KB | **239.9 KB** | -33% |
| `/admin/audit-logs` | 221.9 KB | **224.5 KB** | +1% |
| `/admin/courses` | 350.2 KB | **228.2 KB** | -35% |
| `/admin/enrollments` | 232.9 KB | **232.1 KB** | -0% |
| `/admin/offerings` | 352.4 KB | **291.5 KB** | -17% |
| `/faculty` | 218.2 KB | **217.2 KB** | -0% |
| `/faculty/offerings/[id]` | 366.3 KB | **306.9 KB** | -16% |
| `/student` | 223.1 KB | **222.4 KB** | -0% |
| `/student/registration` | 319 KB | **259.4 KB** | -19% |
| **Average, all 53 routes** | 273.1 KB | **244.5 KB** | -10% |
| Largest initial chunk | 88.6 KB | **71.5 KB** | -19% |
| All client chunks (incl. lazy) | 971 KB | 999.1 KB | +3% |

The total of *all* chunks grew 3%: the virtual table, the sample generator and the split-out
form chunks are new code. But it's deferred, so what each page downloads up front dropped.
`/admin/audit-logs` is +2.6 KB for the paged/all switch and the client-side filters.
<!-- BUNDLE:END -->

Package-level views: [`perf/before/bundle.html`](perf/before/bundle.html) vs [`perf/after/bundle.html`](perf/after/bundle.html).

## 10. Profiler

<!-- PROFILE:START -->
| Scenario | Commits | Component renders | Render time | Worst interaction | Long-frame blocking | DOM nodes |
|---|---|---|---|---|---|---|
| admin-overview-load | 126 → **20** | 2860 → **703** | 342.7 ms → **216.7 ms** | 0 ms → **0 ms** | 236 ms → **215 ms** | 438 → **476** |
| users-search-typing | 9 → **9** | 1899 → **480** | 31.8 ms → **13.5 ms** | 24 ms → **16 ms** | 0 ms → **0 ms** | 228 → **231** |
| audit-filter-typing | 7 → **9** | 88 → **99** | 6.1 ms → **5.6 ms** | 16 ms → **24 ms** | 0 ms → **0 ms** | 179 → **186** |
| student-overview-load | 10 → **9** | 210 → **220** | 131.5 ms → **153.8 ms** | 0 ms → **0 ms** | 62 ms → **79 ms** | 207 → **200** |
| users-large-list-load | n/a → **7** | n/a → **272** | n/a → **156.4 ms** | n/a → **0 ms** | n/a → **69 ms** | n/a → **423** |
| users-large-list-scroll | n/a → **31** | n/a → **1891** | n/a → **42.3 ms** | n/a → **0 ms** | n/a → **0 ms** | n/a → **511** |
| users-large-list-search | n/a → **7** | n/a → **146** | n/a → **9.3 ms** | n/a → **16 ms** | n/a → **0 ms** | n/a → **422** |
| audit-large-list-load | n/a → **7** | n/a → **236** | n/a → **142.7 ms** | n/a → **0 ms** | n/a → **66 ms** | n/a → **463** |
| audit-large-list-scroll | n/a → **31** | n/a → **961** | n/a → **48.9 ms** | n/a → **0 ms** | n/a → **0 ms** | n/a → **567** |
| audit-large-list-filter | n/a → **10** | n/a → **108** | n/a → **9.3 ms** | n/a → **24 ms** | n/a → **0 ms** | n/a → **462** |

_n/a before: the 5,000-row views did not exist yet (lists were capped at 50 rows); see docs/perf/evidence for the non-virtualized vs virtualized comparison._
<!-- PROFILE:END -->

**Profiler screenshots: TODO.** Follow HOW_TO_MEASURE.md §3 and save them as:
- `docs/perf/before/profiler-users-search.png` / `docs/perf/after/profiler-users-search.png`
- `docs/perf/before/profiler-admin-load.png` / `docs/perf/after/profiler-admin-load.png`
- `docs/perf/after/profiler-audit-scroll.png`

---

## 11. Requirement checklist

| Requirement | Minimum | Done | Where |
|---|---|---|---|
| Render optimizations with Profiler evidence | 2 | ✅ 4 | Chart animations `src/components/admin/admin-charts.tsx`; state colocation `src/components/admin/list-toolbar.tsx`; overview split `src/components/admin/overview/*`; header islands `src/components/dashboard/*` |
| Virtualized lists, 1,000+ records | 2 | ✅ 2 (5,000 rows each) | `src/components/admin/virtual-table.tsx` used by `src/features/users/users-manager.tsx` and `src/features/audit/audit-log-viewer.tsx`; data `src/lib/sample-data.ts`, `src/hooks/use-all-records.ts` |
| Debounced inputs (250–400 ms, reusable hook) | 2 | ✅ 5 kinds (300 ms) | `src/hooks/use-debounce.ts`; via `src/hooks/use-url-param.ts`: admin list search (10 lists), audit-log filters (4), public catalogue search; direct: `src/features/quiz/quiz-results-panel.tsx`, `src/features/registration/course-registration.tsx` |
| State optimization | 1 | ✅ 3 | Selective subscriptions `src/components/auth/session-provider.tsx` (+ test); `useRef` timers and rAF-throttled scroll `src/hooks/use-debounce.ts`, `src/components/admin/virtual-table.tsx`; Zustand selectors `src/components/dashboard/header-islands.tsx` |
| Lazy components with same-size skeletons | 2 | ✅ 4 | Charts `src/components/admin/admin-charts-lazy.tsx`; forms `src/features/users/admin-create-form.tsx`, `src/features/courses/course-form.tsx` + `src/components/admin/form-skeleton.tsx`; `src/components/admin/virtual-table-lazy.tsx` |
| Bundle comparison | ✓ | ✅ | `docs/perf/before/bundle.html`, `docs/perf/after/bundle.html`, §9 |
| Server/client boundaries | 2 | ✅ 2 | `src/app/(dashboard)/admin/page.tsx` + `src/components/admin/overview/*`; `src/components/dashboard/dashboard-header.tsx` + `header-islands.tsx` |
| One commit per optimization | ✓ | ✅ | §4 |
| Light and dark mode, 375 / 768 / 1440 | ✓ | ✅ | QA sweep: 162 renders, no overflow, no theme mismatches (§12) |
| No console errors, no broken routes | ✓ | ✅ (see §12 for environment-only messages) | §12 |

## 12. Verification

- `npm run typecheck`, `npm run lint`: clean. `npm test`: 55/55 (includes the new session-subscription and Cloudinary tests).
- **Responsive/theme sweep:** 27 routes (public, admin, faculty, student) × 375/768/1440 × light/dark = 162 production renders. No horizontal overflow (after fixing two pre-existing causes, `8bf7784` and `99ffcf8`), no theme-class mismatches, no unexpected redirects.
- **Console:** no application errors. Messages seen only in the local environment:
  - Google Sign-In's "origin not allowed" for `localhost:3002` (OAuth origin configuration).
  - React #441 "Connection closed" and HTTP 429, only after the sweep exceeded the local API's 300-requests-per-15-minutes rate limit. A re-run with a fresh API showed neither.
- **Interactive checks in a real browser:** debounced URL updates; virtual table keyboard navigation (End → row 5,000, ↑ → 4,999), 48 px rows, sticky header shadow; lazy dialogs load and validate; header and mobile menu for all three roles.

## 13. Remaining limitations

1. **Public home page LCP (4.52 s simulated slow 4G).** The hero image is now requested first, but the public site still ships about 210 KB of initial JS (splash screen, mega-nav, catalogue islands), and on simulated slow 4G that shares the bandwidth. Observed LCP is 0.47 s. Next step: make the splash and nav Server Components with small islands.
2. **`/admin` LCP varies run to run** (1.21–1.69 s after, 1.38 s before). The stats now stream from the server, so the page waits on the API per request. Caching the stats for a few seconds (`revalidate`) would steady it.
3. **Student overview render time is a little higher** (131.5 → 153.8 ms summed self time, 210 → 220 renders) because of the badge placeholders and header islands. Its four client queries could move to the server like `/admin`.
4. **Two of the four TODOs** need a person: Lighthouse on the live URL (not reachable from the measuring machine) and React DevTools Profiler screenshots (§8, §10).
5. **Only users and courses lazy-load their forms.** The other eight managers keep their forms inline and still ship zod and TanStack Form up front (`/admin/offerings` 291 KB). The same pattern (#10) applies.
6. **Sample data is client-only.** The 5,000-row views prove the rendering path. A real 5,000-row data set would also need server-side search instead of loading every page.
