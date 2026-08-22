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
