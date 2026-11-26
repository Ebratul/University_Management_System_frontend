#!/usr/bin/env node
/**
 * Automated render profiling: the numbers the React DevTools Profiler shows,
 * collected without clicking through DevTools.
 *
 * Build first with React profiling on and names kept:
 *   npx next build --profile --no-mangling && npx next start
 *   BASE=http://localhost:3000 node scripts/perf/render-profile.mjs docs/perf/before
 *
 * How it works: a stub React DevTools hook is injected before the page loads.
 * React calls it on every commit; the script walks the committed fiber tree and
 * counts each component that actually ran (the same PerformedWork test DevTools
 * uses), with its actualDuration from the profiling build. Interaction latency
 * comes from the browser's Event Timing API (what INP is computed from).
 * CPU is throttled 4x, like Lighthouse mobile.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const outDir = process.argv[2] ?? "docs/perf";
const BASE = process.env.BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const CPU = Number(process.env.CPU_SLOWDOWN ?? 4);
const only = process.env.ONLY?.split(",");

const HOOK = `(() => {
  const PerformedWork = 1;
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]);
  const state = { recording: false, commits: 0, renders: {}, durations: {}, total: 0 };
  let previous = new WeakSet();
  const nameOf = (fiber) => {
    let t = fiber.type;
    if (t && (t.$$typeof === Symbol.for("react.memo") || t.$$typeof === Symbol.for("react.forward_ref"))) t = t.type || t.render;
    return (t && (t.displayName || t.name)) || "Anonymous";
  };
  function onCommit(root) {
    const seen = new WeakSet();
    const stack = [root.current];
    let rendered = 0;
    while (stack.length) {
      const fiber = stack.pop();
      seen.add(fiber);
      if (state.recording && COMPONENT_TAGS.has(fiber.tag) && (fiber.flags & PerformedWork) && !previous.has(fiber)) {
        const name = nameOf(fiber);
        state.renders[name] = (state.renders[name] || 0) + 1;
        const self = fiber.selfBaseDuration || 0;
        state.durations[name] = (state.durations[name] || 0) + self;
        state.total += self;
        rendered++;
      }
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
    previous = seen;
    if (state.recording && rendered) state.commits++;
  }
  window.__RP = state;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    isDisabled: false,
    inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
    onCommitFiberRoot(_id, root) { try { onCommit(root); } catch (e) { console.error(e); } },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    checkDCE() {},
  };
  window.__EVENTS = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.interactionId) window.__EVENTS.push({ id: e.interactionId, name: e.name, duration: e.duration });
  }).observe({ type: "event", durationThreshold: 16, buffered: true });
})();`;

const sessions = new Map();
async function login(role) {
  if (sessions.has(role)) return sessions.get(role);
  const response = await fetch(`${BASE}/api/demo-login/${role}`, { method: "POST" });
  if (!response.ok) throw new Error(`demo login ${role}: ${response.status}`);
  const cookies = response.headers.getSetCookie().map((c) => {
    const [pair] = c.split(";");
    const index = pair.indexOf("=");
    return { name: pair.slice(0, index), value: pair.slice(index + 1), domain: new URL(BASE).hostname, path: "/" };
  });
  sessions.set(role, cookies);
  return cookies;
}

const settle = (page, ms = 1500) => page.waitForNetworkIdle({ idleTime: 500, timeout: 30_000 }).catch(() => {}).then(() => new Promise((r) => setTimeout(r, ms)));

async function typeSlowly(page, selector, text, delay = 120) {
  await page.click(selector);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await new Promise((r) => setTimeout(r, delay));
  }
}

/**
 * Each scenario: where to start, what to record. `record` runs while counting.
 * Selectors use accessible labels that exist both before and after the refactor.
 */
const SCENARIOS = [
  {
    name: "admin-overview-load",
    role: "admin",
    path: "/admin",
    recordLoad: true,
  },
  {
    name: "users-search-typing",
    role: "admin",
    path: "/admin/users",
    record: (page) => typeSlowly(page, 'input[aria-label="Search users"]', "tester"),
  },
  {
    name: "audit-filter-typing",
    role: "admin",
    path: "/admin/audit-logs",
    record: (page) => typeSlowly(page, "#audit-action", "LOGIN"),
  },
  {
    name: "student-overview-load",
    role: "student",
    path: "/student",
    recordLoad: true,
  },
  {
    name: "audit-large-list-scroll",
    role: "admin",
    path: "/admin/audit-logs?view=all&dataset=sample",
    optional: true,
    record: async (page) => {
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel({ deltaY: 600 });
        await new Promise((r) => setTimeout(r, 50));
      }
    },
  },
  {
    name: "users-large-list-scroll",
    role: "admin",
    path: "/admin/users?view=all&dataset=sample",
    optional: true,
    record: async (page) => {
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel({ deltaY: 600 });
        await new Promise((r) => setTimeout(r, 50));
      }
    },
  },
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-first-run", "--window-size=1440,900"] });
const results = [];

for (const scenario of SCENARIOS) {
  if (only && !only.includes(scenario.name)) continue;
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await context.setCookie(...(await login(scenario.role)));
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await page.evaluateOnNewDocument(HOOK);
  if (scenario.recordLoad) await page.evaluateOnNewDocument("window.__RP && (window.__RP.recording = true)");

  const start = Date.now();
  const response = await page.goto(`${BASE}${scenario.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (!response || !response.ok() || !page.url().includes(scenario.path.split("?")[0])) {
    if (scenario.optional) {
      console.log(`skip ${scenario.name}: not available`);
      await context.close();
      continue;
    }
    throw new Error(`${scenario.name}: landed on ${page.url()}`);
  }
  await settle(page);

  if (scenario.optional && scenario.path.includes("view=all")) {
    const rows = await page.$$eval("table tbody tr", (r) => r.length).catch(() => 0);
    if (rows < 100) {
      console.log(`skip ${scenario.name}: large view not present`);
      await context.close();
      continue;
    }
  }

  if (scenario.record) {
    await page.evaluate(() => { window.__RP.recording = true; window.__RP.commits = 0; window.__RP.renders = {}; window.__RP.durations = {}; window.__RP.total = 0; window.__EVENTS = []; });
    await scenario.record(page);
    await settle(page, 1000);
  }

  const data = await page.evaluate(() => {
    const rp = window.__RP;
    rp.recording = false;
    const byInteraction = {};
    for (const e of window.__EVENTS) byInteraction[e.id] = Math.max(byInteraction[e.id] || 0, e.duration);
    const latencies = Object.values(byInteraction).sort((a, b) => a - b);
    return {
      commits: rp.commits,
      componentRenders: Object.values(rp.renders).reduce((a, b) => a + b, 0),
      renderMs: +rp.total.toFixed(1),
      top: Object.entries(rp.renders)
        .map(([name, count]) => ({ name, count, ms: +(rp.durations[name] || 0).toFixed(1) }))
        .sort((a, b) => b.ms - a.ms || b.count - a.count)
        .slice(0, 15),
      interactions: latencies.length,
      worstInteractionMs: latencies.length ? Math.round(latencies[latencies.length - 1]) : 0,
      domNodes: document.getElementsByTagName("*").length,
      tableRowsInDom: document.querySelectorAll("tbody tr").length,
    };
  });
  results.push({ scenario: scenario.name, path: scenario.path, wallMs: Date.now() - start, ...data });
  console.log(`${scenario.name.padEnd(26)} commits=${String(data.commits).padStart(4)} renders=${String(data.componentRenders).padStart(6)} renderMs=${String(data.renderMs).padStart(8)} worstInteraction=${data.worstInteractionMs}ms dom=${data.domNodes} rows=${data.tableRowsInDom}`);
  console.log("   top:", data.top.slice(0, 6).map((t) => `${t.name}×${t.count} ${t.ms}ms`).join(", "));
  await context.close();
}

await browser.close();
writeFileSync(join(outDir, "render-profile.json"), JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, cpuSlowdown: CPU, results }, null, 2));
