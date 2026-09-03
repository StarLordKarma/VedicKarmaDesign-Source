// Browser-only fixtures: never bypasses server authorization or sends real orders.
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.VISUAL_BASE_URL || "http://127.0.0.1:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Visual fixtures are restricted to localhost");
const output = process.env.VISUAL_OUTPUT || "/tmp/vedic-visual-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const errors = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, locale: "ru-RU" });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base, { waitUntil: "networkidle" });
    const decline = page.getByRole("button", { name: /Continue without analytics|Продолжить без аналитики/ });
    if (await decline.isVisible()) await decline.click();
    await page.screenshot({ path: `${output}/hero-${width}.png` });
    await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) errors.push(`Home overflows at ${width}px`);
    await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${output}/admin-login-${width}.png`, fullPage: true });
    await page.route("**/api/trpc/**", async route => {
      const procedures = new URL(route.request().url()).pathname.split("/api/trpc/")[1].split(",");
      const fixtures = {
        "auth.me": { id: 1, openId: "visual-owner", name: "Preview owner", role: "admin" },
        "reportStudio.queue": [],
        "reportStudio.processingSettings": { autoProcessEnabled: false, aiModel: "gpt-5-mini", maxTokens: 5000, maxSections: 6, maxParagraphChars: 1800 },
        "admin.bookingList": [], "admin.pricing": [{ currency: "USD", basicUsd: 25, numerologyAddonUsd: 10 }], "admin.receiptRetention": 48,
        "admin.activitySummary": { deliveryFailureCount: 0, pendingPaymentCount: 0, recentlyEditedClientCount: 0, deliveryFailures: [], pendingPayments: [], recentlyEditedClients: [] },
      };
      const data = procedures.map(name => ({ result: { data: { json: fixtures[name] ?? { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 } } } }));
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${output}/admin-dashboard-${width}.png`, fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) errors.push(`Admin dashboard overflows at ${width}px`);
    await page.goto(`${base}/admin/report-studio`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Review & approve reports" }).waitFor();
    await page.screenshot({ path: `${output}/report-studio-${width}.png`, fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) errors.push(`Report Studio overflows at ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ output, errors }, null, 2));
if (errors.length) process.exitCode = 1;
