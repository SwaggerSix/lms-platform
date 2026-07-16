// Read-only Playwright crawl of the LMS public/unauthenticated surfaces.
// Captures screenshots (desktop + mobile), console errors, failed network
// requests, page title/h1, and basic UX signals. NO writes, NO account
// creation, NO checkout completion.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/claude-0/-home-user-lms-platform/4ceccd69-20ec-57fb-a448-4efa8a9565ae/scratchpad/shots";
mkdirSync(OUT, { recursive: true });

const routes = [
  { id: "login", path: "/login" },
  { id: "register", path: "/register" },
  { id: "forgot-password", path: "/forgot-password" },
  { id: "reset-password", path: "/reset-password" },
  { id: "verify-2fa", path: "/verify-2fa" },
  { id: "terms", path: "/terms" },
  { id: "privacy", path: "/privacy" },
  { id: "welcome", path: "/welcome" },
  { id: "store-gc", path: "/store/gothamculture" },
  { id: "store-ggs", path: "/store/gothamgovernment" },
  { id: "store-cart", path: "/store/gothamculture/cart" },
  { id: "root", path: "/" },
];

const results = [];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

async function visit(ctx, route, viewport) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
  page.on("requestfailed", (r) =>
    failedRequests.push(`${r.method()} ${r.url().slice(0, 120)} :: ${r.failure()?.errorText}`)
  );
  page.on("response", (r) => {
    const s = r.status();
    if (s >= 500) failedRequests.push(`HTTP ${s} ${r.url().slice(0, 120)}`);
  });

  let finalUrl = "";
  let title = "";
  let h1 = "";
  let bodyLen = 0;
  let firstFocus = "";
  let inputsNoLabel = 0;
  let imgsNoAlt = 0;
  let buttonsNoName = 0;
  try {
    const resp = await page.goto(BASE + route.path, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    finalUrl = page.url();
    title = await page.title();
    h1 = (await page.locator("h1").first().textContent().catch(() => "")) || "";
    bodyLen = (await page.locator("body").innerText().catch(() => "")).length;

    // A11y-lite signals
    inputsNoLabel = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll("input:not([type=hidden]),textarea,select")];
      return inputs.filter((el) => {
        const id = el.getAttribute("id");
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
        const ph = el.getAttribute("placeholder");
        return !hasLabel && !aria && !ph;
      }).length;
    });
    imgsNoAlt = await page.evaluate(
      () => [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length
    );
    buttonsNoName = await page.evaluate(
      () => [...document.querySelectorAll("button")].filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label")).length
    );
    // Tab once to see focus order
    await page.keyboard.press("Tab");
    firstFocus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "none";
      return `${el.tagName}${el.id ? "#" + el.id : ""}${el.getAttribute("aria-label") ? "[" + el.getAttribute("aria-label") + "]" : ""}`;
    });

    const vp = viewport === "mobile" ? "m" : "d";
    await page.screenshot({ path: `${OUT}/${route.id}-${vp}.png`, fullPage: true });
    if (resp) route._status = resp.status();
  } catch (e) {
    pageErrors.push("NAV_ERROR: " + String(e).slice(0, 200));
  }

  results.push({
    id: route.id,
    path: route.path,
    viewport,
    finalUrl,
    redirected: finalUrl !== BASE + route.path,
    httpStatus: route._status,
    title,
    h1: h1.trim().slice(0, 120),
    bodyLen,
    firstFocus,
    inputsNoLabel,
    imgsNoAlt,
    buttonsNoName,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 10),
    pageErrors: [...new Set(pageErrors)].slice(0, 10),
    failedRequests: [...new Set(failedRequests)].slice(0, 12),
  });
  await page.close();
}

for (const viewport of ["desktop", "mobile"]) {
  const ctx = await browser.newContext(
    viewport === "mobile"
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" }
      : { viewport: { width: 1280, height: 800 } }
  );
  for (const route of routes) {
    await visit(ctx, { ...route }, viewport);
  }
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/crawl-results.json`, JSON.stringify(results, null, 2));

// Console summary
for (const r of results.filter((x) => x.viewport === "desktop")) {
  console.log(`\n### ${r.id} (${r.path}) status=${r.httpStatus} redirected=${r.redirected}`);
  console.log(`  finalUrl=${r.finalUrl}`);
  console.log(`  title="${r.title}" h1="${r.h1}" bodyLen=${r.bodyLen} firstFocus=${r.firstFocus}`);
  console.log(`  a11y: inputsNoLabel=${r.inputsNoLabel} imgsNoAlt=${r.imgsNoAlt} buttonsNoName=${r.buttonsNoName}`);
  if (r.consoleErrors.length) console.log(`  consoleErrors: ${JSON.stringify(r.consoleErrors)}`);
  if (r.pageErrors.length) console.log(`  pageErrors: ${JSON.stringify(r.pageErrors)}`);
  if (r.failedRequests.length) console.log(`  failedRequests: ${JSON.stringify(r.failedRequests)}`);
}
console.log("\nDONE. Screenshots + JSON in", OUT);
