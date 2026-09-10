import { expect, test } from "@playwright/test";

const authToken =
  process.env.SANDBOX_AUTH_TOKEN ||
  "sandbox-login-token-change-me-32-characters";
const mockUrl = process.env.SANDBOX_MOCK_URL || "http://127.0.0.1:4010";

test("public order, signed mock payment, report rendering and email delivery", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const decline = page.getByRole("button", {
    name: /Continue without analytics|Продолжить без аналитики/,
  });
  if (await decline.isVisible()) await decline.click();
  await expect(
    page.getByRole("link", { name: /Source code · AGPL/i })
  ).toBeVisible();

  await page.locator('input[name="name"]').fill("E2E Sandbox Client");
  await page.locator('input[name="email"]').fill("e2e-client@sandbox.invalid");
  await page.locator('input[name="birthDate"]').fill("1990-01-01");
  await page.locator('input[name="birthTime"]').fill("12:00");
  await page.locator('input[name="birthCity"]').fill("Berlin");
  await page.locator('input[name="birthCountry"]').fill("Germany");
  await page.getByLabel("privacy consent").check();
  await page.getByRole("button", { name: "Request my reading" }).click();
  await expect(page.getByText(/Your request is saved/)).toBeVisible();
  await page.getByRole("link", { name: /Continue to crypto payment/ }).click();
  await expect(
    page.getByRole("heading", { name: /Sandbox payment/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm test payment" }).click();
  await expect(page.locator("#result")).toContainText('"confirmed":true');

  await page.goto(`/api/auth/login?token=${encodeURIComponent(authToken)}`);
  await expect(page).toHaveURL(/\/admin/);
  await page.goto("/admin/report-studio");
  await page
    .getByRole("button", { name: /booking #.*queued/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: /Resolve location & render preview/ })
    .click();
  await expect(page.getByRole("link", { name: "Open PDF" })).toBeVisible({
    timeout: 90_000,
  });
  const review = page
    .getByText(/I checked the source facts/)
    .locator("..")
    .getByRole("checkbox");
  await review.check();
  await page.getByRole("button", { name: /Approve PDF for delivery/ }).click();
  await expect(page.getByRole("button", { name: /Delivered/ })).toBeVisible({
    timeout: 30_000,
  });

  const messages = await request.get(`${mockUrl}/messages`);
  expect(messages.ok()).toBeTruthy();
  expect(
    (await messages.json()).data.some(
      message =>
        message.to?.includes("e2e-client@sandbox.invalid") &&
        message.attachmentCount === 1
    )
  ).toBeTruthy();
});

test("all public locales state that fiat is not anonymous", async ({
  page,
}) => {
  for (const locale of ["en", "ru", "de", "es"]) {
    await page.goto(`/privacy?lang=${locale}`);
    await expect(page.locator("main")).toContainText(
      locale === "ru"
        ? "не является анонимной"
        : locale === "de"
          ? "nicht anonym"
          : locale === "es"
            ? "no son anónimos"
            : "not anonymous"
    );
  }
});

test("sandbox login rejects an incorrect token", async ({ request }) => {
  const response = await request.get("/api/auth/login?token=wrong", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
});
