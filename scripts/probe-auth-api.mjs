// Non-destructive auth-UX + API-authz probes (authorized self-testing).
// - No real accounts created, no real emails targeted (.invalid TLD only).
// - API probes are unauthenticated GETs to observe access-control behavior.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/claude-0/-home-user-lms-platform/4ceccd69-20ec-57fb-a448-4efa8a9565ae/scratchpad/shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// 1) Confirm Terms/Privacy links from the login page bounce to /login
console.log("=== Legal links (direct nav, unauthenticated) ===");
for (const p of ["/terms", "/privacy"]) {
  await page.goto(BASE + p, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(600);
  console.log(`  GET ${p} -> landed on ${page.url()}`);
}

// 2) Login error message + rate-limit behavior (fake .invalid email, wrong pw)
console.log("\n=== Login error wording + rate limiting (fake .invalid account) ===");
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" }).catch(() => {});
const respCodes = [];
for (let i = 0; i < 7; i++) {
  await page.fill("#email", `qa-probe-${i}@nonexistent.invalid`);
  await page.fill("#password", "wrong-password-123");
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login") || r.url().includes("auth/v1/token"), { timeout: 8000 }).catch(() => null),
    page.click('button[type="submit"]').catch(() => {}),
  ]);
  await page.waitForTimeout(400);
  const err = await page.locator('[role="alert"], .text-red-600, .text-red-500, .text-destructive').first().textContent().catch(() => "");
  respCodes.push(resp ? resp.status() : "n/a");
  if (i === 0 || i === 6) console.log(`  attempt ${i + 1}: httpStatus=${resp ? resp.status() : "n/a"} shownError="${(err || "").trim().slice(0, 120)}"`);
}
console.log(`  status sequence: ${respCodes.join(", ")}`);

// 3) Password visibility toggle present on login?
const toggle = await page.locator('button[aria-label*="password" i], button:has([data-lucide="eye"]), [data-testid="toggle-password"]').count().catch(() => 0);
console.log(`  password-visibility toggle present: ${toggle > 0}`);

// 4) Unauthenticated API access-control probes
console.log("\n=== Unauthenticated API probes (expect 401/403/redirect) ===");
const apis = [
  "/api/users",
  "/api/enrollments",
  "/api/admin/lrs",
  "/api/skills",
  "/api/observations/templates",
  "/api/transcript",
  "/api/certificates/verify/INVALIDCODE123",
  "/api/xapi/about",
  "/api/scheduled-reports",
];
for (const a of apis) {
  const r = await ctx.request.get(BASE + a, { maxRedirects: 0, failOnStatusCode: false }).catch((e) => ({ status: () => "ERR", _e: String(e) }));
  let bodyPreview = "";
  try { bodyPreview = (await r.text()).slice(0, 90).replace(/\s+/g, " "); } catch {}
  console.log(`  GET ${a} -> ${r.status()} :: ${bodyPreview}`);
}

// 5) Security headers on a page response
console.log("\n=== Security headers (/login) ===");
const hr = await ctx.request.get(BASE + "/login", { failOnStatusCode: false });
const h = hr.headers();
for (const k of ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "strict-transport-security", "permissions-policy"]) {
  console.log(`  ${k}: ${h[k] ? h[k].slice(0, 80) : "(absent)"}`);
}

await browser.close();
console.log("\nDONE probes");
