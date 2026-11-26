# Demo video script (4–5 minutes)

**Setup before recording**
- Two browser windows side by side, both Chrome, both signed in as the demo admin.
  - Left: the **before** build. `git worktree add ../ums-before 90f7db9`, then
    `npm ci && npx next build --profile && npx next start -p 3000` in it.
  - Right: the **after** build (`main`), `npx next build --profile && npx next start -p 3001`.
- React DevTools installed. In Profiler settings, tick "Highlight updates when components render".
- `docs/perf/metrics.md` and `docs/perf/before/bundle.html` / `after/bundle.html` open in tabs.
- Screen at 1440 px, browser zoom 100 %, light mode to start.

---

### 0:00 – 0:20 · Intro
"This is the University Management System dashboard, redesigned and optimised for the
React Performance task. I'll show where it was slow, what changed, and the measured
difference. Every number comes from scripts in `scripts/perf`, and the before and after
were run the same way."

### 0:20 – 0:50 · The redesign
- Right window: `/admin`. Point at the warm off-white background, the 16 px cards, the
  label → value → chip stat cards, and the one accented word in the title.
- Toggle the OS / browser to dark mode. "The theme switches by tokens only: deep
  charcoal, lighter surfaces instead of shadows, emerald accent."
- Shrink to 375 px: stats go 4 → 2 → 1 columns, and the header collapses into the menu sheet.

### 0:50 – 1:40 · Re-renders: typing in a search box (Profiler)
- Left (before): `/admin/users`, Profiler → record, type `tester`, stop.
  "Every keystroke re-renders the whole manager: 8 renders of UsersManager and
  ~1,900 component renders, including every row's dropdown menu."
- Right (after): same steps. "The search state now lives in the toolbar. The list
  re-renders once, when the debounced value reaches the URL: ~470 component renders, −75 %."
- Show the URL: it only changes after you stop typing (300 ms debounce).

### 1:40 – 2:40 · 5,000 rows: virtualization
- Left (before the virtualization commit; or describe using the evidence JSON):
  `/admin/audit-logs?view=all&dataset=sample`. Scroll. "5,000 rows are in the DOM,
  65,000 nodes, and the first scroll freezes for about 4 seconds."
- Right (after): same URL. Open DevTools Elements: only ~22 `<tr>` exist. Scroll
  fast; scroll back up. "Only the visible rows plus 8 overscan rows are rendered.
  No long frames while scrolling."
- Press **End**, then **↑**: keyboard focus moves and the row scrolls into view.
  Show the sticky header and its shadow.
- Type `PAYMENT` in the Action filter: "Filtering 5,000 rows used to block the main
  thread for 4.5 s; now it's 0 ms of blocking."
- Point out the **Sample data** banner: generated in the browser, never saved, actions off.

### 2:40 – 3:30 · Bundle size
- Open `before/bundle.html` and `after/bundle.html` on the `/admin/users` section.
  "zod was 131 KB here: the named `z` import pulled in every locale. A namespace
  import fixed that."
- Click **New administrator** in the right window with the Network tab open: the form
  chunk downloads only now, with a skeleton the same size as the form.
- `/admin`: the charts arrive as a separate chunk; the skeleton has the chart's exact height.
- Show the table in `metrics.md`, section 2 (initial JS per route, before → after).

### 3:30 – 4:15 · Server Components and Lighthouse
- `/admin` with "Disable JavaScript" in DevTools: the header, title, stats and shortcuts
  still render. "These are Server Components now. Stats stream in behind Suspense,
  and only the charts, the identity block, log-out and the mobile menu hydrate."
- Show `metrics.md` section 1: Lighthouse before → after (score, LCP, TBT, CLS).
  Call out `/student` CLS 0.089 → ~0.007 (same-size skeletons).

### 4:15 – 4:45 · Honest limits and wrap-up
- "The public home page still has a simulated slow-4G LCP above 2.5 s. The real,
  observed LCP is under half a second; the public site's JS is the next thing to cut."
- "Everything is in `docs/PERFORMANCE_REPORT.md`, with one commit per optimisation and
  the before/after data in `docs/perf`."
