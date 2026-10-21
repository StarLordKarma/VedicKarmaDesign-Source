import { expect, test } from "@playwright/test";

const headings = {
  en: "Why Vedic astrology can offer finer detail",
  ru: "Почему ведическая астрология даёт более тонкую детализацию",
  de: "Warum vedische Astrologie feiner differenzieren kann",
  es: "Por qué la astrología védica puede ofrecer más detalle",
} as const;

for (const width of [768, 1280]) {
  for (const [locale, heading] of Object.entries(headings)) {
    test(`${locale} visual layers remain readable at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${locale}`);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      const visuals = await page.evaluate(() => {
        const hero = document.querySelector<HTMLElement>(".editorial-hero");
        const section =
          document.querySelector<HTMLElement>(".vedic-difference");
        return {
          heroBackground: hero ? getComputedStyle(hero).backgroundImage : "",
          sectionBackground: section
            ? getComputedStyle(section).backgroundImage
            : "",
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
        };
      });
      expect(visuals.heroBackground).toContain("star-field.svg");
      expect(visuals.sectionBackground).toContain("sacred-grid.svg");
      expect(visuals.document).toBeLessThanOrEqual(visuals.viewport);
    });
  }
}
