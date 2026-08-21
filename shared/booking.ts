import { z } from "zod";
import { READING_PRICES } from "./pricing";

export const bookingSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email."),
  birthDate: z.string().min(1, "Birth date is required."),
  birthTime: z.string().min(1, "Exact birth time is required."),
  birthCity: z.string().trim().min(2, "Birth city is required."),
  birthCountry: z.string().trim().min(2, "Birth country is required."),
  language: z.enum(["English", "Русский", "Deutsch", "Español"]),
  addon: z.boolean(),
  interest: z.string().trim().max(1000).optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export function getBookingTotal(addon: boolean) {
  return READING_PRICES.basic + (addon ? READING_PRICES.numerologyAddon : 0);
}
