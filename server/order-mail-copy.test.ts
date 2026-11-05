import { it, expect } from "vitest";
import { acceptanceCopy } from "./order-mail-copy";
it.each(["ru", "en", "es", "de"] as const)(
  "acceptance email in %s has no contact or promotion block",
  locale => {
    const c = acceptanceCopy(
      locale,
      42,
      "tarot",
      "https://example.test/status/synthetic"
    );
    expect(c.subject).toContain("42");
    expect(c.html).toContain(`lang="${locale}"`);
    expect(c.text).toContain("15");
    expect(c.text).toContain("20");
    expect(c.html).not.toMatch(
      /mailto:|support@|contact us|свяжитесь|contacto|kontakt/i
    );
    expect(c.html).not.toContain("other readings");
    expect(c.html).toContain("/status/synthetic");
  }
);
it("rejects a non-web status link", () =>
  expect(() =>
    acceptanceCopy("ru", 1, "tarot", "javascript:alert(1)")
  ).toThrow());
