import { describe, expect, it } from "vitest";
import { updateBookingAdminSchema } from "./admin";
import { COPY } from "./i18n";
import { ADMIN_COPY, validatePdfSelection } from "@/pages/Admin";

describe("admin updates and localization", () => {
  it("accepts a status and private note update", () => {
    const parsed = updateBookingAdminSchema.safeParse({ id: 12, status: "completed", adminNote: "PDF sent" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty admin update and oversized notes", () => {
    expect(updateBookingAdminSchema.safeParse({ id: 12 }).success).toBe(false);
    expect(updateBookingAdminSchema.safeParse({ id: 12, adminNote: "x".repeat(5001) }).success).toBe(false);
  });

  it("contains selectable English and Russian admin copy", () => {
    expect(ADMIN_COPY.en.exportCsv).toBe("Export CSV");
    expect(ADMIN_COPY.ru.exportCsv).toBe("Экспорт CSV");
    expect(ADMIN_COPY.en.localeButton).toBe("RU");
    expect(ADMIN_COPY.ru.localeButton).toBe("EN");
    expect(ADMIN_COPY.ru.uploadTooLarge).toContain("12 МБ");
  });

  it("validates PDF upload selections before mutation", () => {
    expect(validatePdfSelection({ type: "application/pdf", name: "chart.pdf", size: 100 })).toBeNull();
    expect(validatePdfSelection({ type: "text/plain", name: "chart.txt", size: 100 })).toBe("invalidType");
    expect(validatePdfSelection({ type: "application/pdf", name: "chart.pdf", size: 12 * 1024 * 1024 + 1 })).toBe("tooLarge");
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
