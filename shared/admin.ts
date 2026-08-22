import { z } from "zod";

export const requestStatuses = ["new", "in_progress", "completed", "cancelled"] as const;
export const requestStatusSchema = z.enum(requestStatuses);

export const updateBookingAdminSchema = z.object({
  id: z.number().int().positive(),
  status: requestStatusSchema.optional(),
  adminNote: z.string().trim().max(5000).nullable().optional(),
}).refine((input) => input.status !== undefined || input.adminNote !== undefined, {
  message: "Provide a status or note update.",
});

export const attachNatalPdfSchema = z.object({
  bookingId: z.number().int().positive(),
  fileName: z.string().trim().min(1).max(255).regex(/\.pdf$/i, "Only PDF files are allowed."),
  contentBase64: z.string().min(1).max(16_777_216),
});

export const exportFormatSchema = z.enum(["csv", "pdf"]);
export const sendNatalPdfSchema = z.object({ bookingId: z.number().int().positive() });
export const bulkSendNatalPdfSchema = z.object({ bookingIds: z.array(z.number().int().positive()).min(1).max(50) }).superRefine((input, context) => { if (new Set(input.bookingIds).size !== input.bookingIds.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate booking IDs are not allowed." }); });
export const clientHistorySchema = z.object({ bookingId: z.number().int().positive() });
export const currencySchema = z.enum(["USD", "EUR", "GBP"]);
export const pricingCurrencySchema = z.object({ currency: currencySchema });
export const servicePricingSchema = z.object({
  currency: currencySchema.default("USD"),
  basicUsd: z.number().int().min(1).max(10000),
  numerologyAddonUsd: z.number().int().min(0).max(10000),
});
const pricingHistoryDateFields = {
  currency: currencySchema.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
};
const validPricingHistoryRange = (input: { from?: string; to?: string }) => !input.from || !input.to || input.from <= input.to;
export const pricingHistoryFilterSchema = z.object(pricingHistoryDateFields).refine(validPricingHistoryRange, { message: "The pricing history date range is invalid." });
export const smokeTestRunStartSchema = z.object({ runId: z.string().regex(/^production-smoke-\d{10,}$/) });
export const smokeTestRunFinishSchema = z.object({ runId: z.string().regex(/^production-smoke-\d{10,}$/), status: z.enum(["succeeded", "failed"]), result: z.string().max(10000), durationMs: z.number().int().min(0).max(3600000) });
export const smokeTestRunStatusSchema = z.enum(["running", "succeeded", "failed"]);
export const smokeTestRunSortSchema = z.enum(["started_desc", "started_asc", "duration_desc", "duration_asc"]);
export const smokeTestRunsPageSchema = z.object({
  status: smokeTestRunStatusSchema.optional(),
  sort: smokeTestRunSortSchema.default("started_desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});
export const pricingHistoryPageSchema = z.object({
  ...pricingHistoryDateFields,
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
}).refine(validPricingHistoryRange, { message: "The pricing history date range is invalid." });

export const receiptEmailStatusSchema = z.enum(["sending", "sent", "failed"]);
export const receiptEmailHistoryPageSchema = z.object({
  status: receiptEmailStatusSchema.optional(),
  recipient: z.string().trim().max(320).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const activityDateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((input) => !input.from || !input.to || input.from <= input.to, { message: "The activity date range is invalid." });
export const editBookingClientSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email().max(320).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  birthCity: z.string().trim().min(1).max(160).optional(),
  birthCountry: z.string().trim().min(1).max(160).optional(),
  language: z.string().trim().min(1).max(32).optional(),
  interest: z.string().trim().max(5000).nullable().optional(),
}).refine((input) => Object.keys(input).some((key) => key !== "id" && input[key as keyof typeof input] !== undefined), { message: "Provide at least one client field to update." });

export type UpdateBookingAdminInput = z.infer<typeof updateBookingAdminSchema>;
