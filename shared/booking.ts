import {READING_PRODUCTS} from './reading-products';
import { z } from "zod";
import { READING_PRICES } from "./pricing";

export const PRIVACY_NOTICE_VERSION = "privacy-2026-10-21";

export const bookingSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(160),
  email: z.string().trim().email("Please enter a valid email.").max(320),
  birthDate: z.string().default(""),
  birthTime: z.string().default(""),
  birthCity: z.string().trim().max(160).default(""),
  birthCountry: z.string().trim().max(160).default(""),
  language: z.enum(["English", "Русский", "Deutsch", "Español"]),
  addon: z.boolean(),
  product: z.enum(READING_PRODUCTS).optional(),
  currentZone: z.string().max(64).default("UTC").refine(x=>{try{new Intl.DateTimeFormat("en",{timeZone:x});return true}catch{return false}},"Invalid time zone"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  unknownTime: z.boolean().default(false),
  disambiguation: z.enum(["reject","earlier","later"]).default("reject"),
  currency: z.enum(["USD", "EUR", "GBP"]).default("USD"),
  interest: z.string().trim().max(1000).optional(),
  promoCode: z.string().trim().max(32).optional(),
  privacyAcknowledged: z.literal(true),
  privacyNoticeVersion: z.literal(PRIVACY_NOTICE_VERSION),
  privacyLocale: z.enum(["en", "ru", "de", "es"]),
  smokeTest: z.boolean().optional().default(false),
  smokeTestRunId: z.string().regex(/^production-smoke-\d{10,}$/).optional(),
}).superRefine((v,ctx)=>{
 if(v.product==='tarot')return;
 if(!z.string().date().safeParse(v.birthDate).success||v.birthDate>new Date().toISOString().slice(0,10))ctx.addIssue({code:'custom',path:['birthDate'],message:'Please enter a valid birth date.'});
 const allowUnknown=v.unknownTime&&['portrait','daily','monthly'].includes(v.product||'');
 if(!allowUnknown&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.birthTime))ctx.addIssue({code:'custom',path:['birthTime'],message:'Please enter a valid birth time.'});
 if(v.birthCity.length<2)ctx.addIssue({code:'custom',path:['birthCity'],message:'Birth city is required.'});
 if(v.birthCountry.length<2)ctx.addIssue({code:'custom',path:['birthCountry'],message:'Birth country is required.'});
 if(v.product==='monthly'&&!v.month)ctx.addIssue({code:'custom',path:['month'],message:'Please select a month.'});
 if(v.product&&!v.product.startsWith('vedic_')&&v.currency!=='USD')ctx.addIssue({code:'custom',path:['currency'],message:'This product is priced in USD.'});
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
