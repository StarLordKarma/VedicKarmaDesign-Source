import { z } from "zod";
import { READING_PRICES } from "./pricing";

export const PRIVACY_NOTICE_VERSION = "privacy-2026-08";

export const bookingSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email."),
  birthDate: z.string().min(1, "Birth date is required."),
  birthTime: z.string().min(1, "Exact birth time is required."),
  birthCity: z.string().trim().min(2, "Birth city is required."),
  birthCountry: z.string().trim().min(2, "Birth country is required."),
  language: z.enum(["English", "Русский", "Deutsch", "Español"]),
  addon: z.boolean(),
  currency: z.enum(["USD", "EUR", "GBP"]).default("USD"),
  interest: z.string().trim().max(1000).optional(),
  promoCode: z.string().trim().max(32).optional(),
  privacyAcknowledged: z.literal(true),
  privacyNoticeVersion: z.literal(PRIVACY_NOTICE_VERSION),
  privacyLocale: z.enum(["en", "ru", "de", "es"]),
  smokeTest: z.boolean().optional().default(false),
  smokeTestRunId: z.string().regex(/^production-smoke-\d{10,}$/).optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export type BookingPriceSnapshot = {
  packageCode: "basic" | "basic_plus";
  packageVersion: number;
  currency: "USD" | "EUR" | "GBP";
  basicAmount: number;
  addonAmount: number;
  totalAmount: number;
  promoCode?: string;
  discountPercent?: number;
  discountAmount?: number;
};

export const PROMOTION_CODES = { WELCOME10: { discountPercent: 10 } } as const;

export function normalizePromoCode(code: string | null | undefined) {
  return code?.trim().toUpperCase() || "";
}

export function validatePromoCode(code: string | null | undefined) {
  const normalizedCode = normalizePromoCode(code);
  const promotion = normalizedCode ? PROMOTION_CODES[normalizedCode as keyof typeof PROMOTION_CODES] : undefined;
  return promotion ? { valid: true as const, code: normalizedCode, discountPercent: promotion.discountPercent } : { valid: false as const, code: normalizedCode, discountPercent: 0 };
}

export function applyPromoDiscount(totalAmount: number, code: string | null | undefined) {
  const validation = validatePromoCode(code);
  const discountAmount = validation.valid ? Math.round(totalAmount * validation.discountPercent) / 100 : 0;
  return { ...validation, discountAmount, totalAmount: Math.max(0, Math.round((totalAmount - discountAmount) * 100) / 100) };
}

export function buildBookingPriceSnapshot(input: { addon: boolean; currency: BookingPriceSnapshot["currency"]; basicAmount: number; addonAmount: number; promoCode?: string }): BookingPriceSnapshot {
  const packageCode = input.addon ? "basic_plus" : "basic";
  const subtotal = input.basicAmount + (input.addon ? input.addonAmount : 0);
  const promo = applyPromoDiscount(subtotal, input.promoCode);
  return { packageCode, packageVersion: 1, currency: input.currency, basicAmount: input.basicAmount, addonAmount: input.addon ? input.addonAmount : 0, totalAmount: promo.totalAmount, ...(promo.valid ? { promoCode: promo.code, discountPercent: promo.discountPercent, discountAmount: promo.discountAmount } : {}) };
}

export function isProductionSmokeTestBooking(input: Pick<BookingInput, "email" | "interest" | "smokeTest" | "smokeTestRunId">) {
  return input.smokeTest === true && input.smokeTestRunId !== undefined && input.email === `${input.smokeTestRunId}@example.com` && input.interest === "Automated production checkout verification";
}

export function getBookingTotal(addon: boolean) {
  return READING_PRICES.basic + (addon ? READING_PRICES.numerologyAddon : 0);
}

export function getCheckoutErrorMessage(message?: string) {
  return message?.trim() || "We could not create the crypto checkout. Please try again.";
}
