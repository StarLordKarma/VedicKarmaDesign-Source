import { expect, test } from "@playwright/test";

const locales = {
  en: {
    html: "en-US",
    date: "Format: MM/DD/YYYY",
    email: "name@example.com",
    required: "Please complete all required fields.",
  },
  ru: {
    html: "ru-RU",
    date: "Формат: ДД.ММ.ГГГГ",
    email: "имя@пример.рф",
    required: "Заполните все обязательные поля.",
  },
  de: {
    html: "de-DE",
    date: "Format: TT.MM.JJJJ",
    email: "name@beispiel.de",
    required: "Bitte füllen Sie alle Pflichtfelder aus.",
  },
  es: {
    html: "es-ES",
    date: "Formato: DD/MM/AAAA",
    email: "nombre@ejemplo.es",
    required: "Completa todos los campos obligatorios.",
  },
} as const;

for (const width of [320, 375, 430]) {
  for (const [locale, copy] of Object.entries(locales)) {
    test(`${locale} public form fits a ${width}px viewport and localizes field guidance`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/?lang=${locale}`);

      await expect(page.locator("html")).toHaveAttribute("lang", copy.html);
      await expect(page.getByText(new RegExp(copy.date))).toBeVisible();
      await expect(page.getByPlaceholder(copy.email)).toBeVisible();

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);

      await page.locator('button[type="submit"]').last().click();
      await expect(page.getByRole("alert")).toContainText(copy.required);
    });
  }
}
