import { describe, expect, it } from "vitest";
import { updateBookingAdminSchema } from "./admin";
import { COPY } from "./i18n";

describe("admin updates and localization", () => {
  it("accepts a status and private note update", () => {
    const parsed = updateBookingAdminSchema.safeParse({ id: 12, status: "completed", adminNote: "PDF sent" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty admin update and oversized notes", () => {
    expect(updateBookingAdminSchema.safeParse({ id: 12 }).success).toBe(false);
    expect(updateBookingAdminSchema.safeParse({ id: 12, adminNote: "x".repeat(5001) }).success).toBe(false);
  });

  it("contains selectable English and Russian public copy", () => {
    expect(COPY.en.book).toBe("Book a reading");
    expect(COPY.ru.book).toBe("Заказать чтение");
    expect(COPY.ru.heroBody).toContain("ведической");
    expect(COPY.ru.features).toEqual(["4 языка", "Многостраничный PDF", "Лично и структурированно"]);
    expect(COPY.ru.patternTitle).toBe("Читайте закономерности.");
    expect(COPY.ru.faqs.every((item) => !/[A-Za-z]{4,}/.test(item.question))).toBe(true);
  });
});
