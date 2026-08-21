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

export type UpdateBookingAdminInput = z.infer<typeof updateBookingAdminSchema>;
