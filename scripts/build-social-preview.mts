import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

// Render the real public sample in a deterministic social-card layout, without AI-generated text.
const root = path.resolve(import.meta.dirname, "..");
const images = await Promise.all([1, 2, 3].map(async n => `data:image/webp;base64,${(await fs.readFile(path.join(root, `client/public/samples/reading-page-${n}.webp`))).toString("base64")}`));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f2e9db;color:#302a25;font-family:Georgia,serif}
    .frame{position:absolute;inset:24px;border:1px solid #c7b48b}.copy{position:absolute;left:65px;top:70px;width:475px}.brand{font:15px Arial,sans-serif;letter-spacing:4px;color:#a96346}.title{font-size:61px;line-height:1.08;margin:40px 0 22px}.subtitle{font:22px/1.5 Arial,sans-serif;color:#73685d;max-width:420px}.tag{display:inline-block;margin-top:28px;border:1px solid #a96346;padding:12px 20px;border-radius:30px;font:15px Arial,sans-serif;color:#a96346}.pages{position:absolute;left:585px;top:70px;width:550px;height:470px}.page{position:absolute;width:255px;border:1px solid #dfcdb2;box-shadow:0 18px 35px #302a2530}.a{left:0;top:35px;transform:rotate(-10deg)}.b{left:255px;top:35px;transform:rotate(10deg)}.c{left:127px;top:0;transform:rotate(0deg)}.footer{position:absolute;left:65px;bottom:52px;font:15px Arial,sans-serif;color:#73685d;letter-spacing:1px}.note{position:absolute;right:65px;bottom:52px;font:13px Arial,sans-serif;color:#73685d}
    </style></head><body><div class="frame"></div><section class="copy"><div class="brand">VEDIC KARMA DESIGN</div><h1 class="title">Your personal<br>Vedic reading</h1><p class="subtitle">Birth chart. Planetary periods.<br>A beautifully presented private PDF.</p><div class="tag">EXPLORE A SAMPLE REPORT</div></section><div class="pages"><img class="page a" src="${images[1]}"><img class="page b" src="${images[2]}"><img class="page c" src="${images[0]}"></div><div class="footer">karmalifedesign.com</div><div class="note">Fictional sample · Interpretive astrology</div></body></html>`);
  await page.locator("img").evaluateAll(elements => Promise.all(elements.map(el => (el as HTMLImageElement).decode())));
  const output = path.join(root, "client/public/social/report-preview.jpg");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output, type: "jpeg", quality: 92 });
  console.log(output);
} finally { await browser.close(); }
