import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { bookingSchema, getBookingTotal } from "@shared/booking";
import { createBookingRequest, updateBookingPayment } from "./db";
import { createCheckoutForBooking } from "./payment-flow";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  booking: router({
    submit: publicProcedure.input(bookingSchema).mutation(async ({ input, ctx }) => {
      const totalUsd = getBookingTotal(input.addon);
      const result = await createBookingRequest({
        name: input.name,
        email: input.email,
        birthDate: input.birthDate,
        birthTime: input.birthTime,
        birthCity: input.birthCity,
        birthCountry: input.birthCountry,
        language: input.language,
        addon: input.addon ? 1 : 0,
        totalUsd,
        interest: input.interest || null,
        status: "new",
        paymentStatus: "creating",
      });
      try {
        const origin = `${ctx.req.protocol}://${ctx.req.get("host")}`;
        const invoice = await createCheckoutForBooking({
          bookingId: result.id,
          totalUsd,
          addon: input.addon,
          origin,
          savePayment: updateBookingPayment,
          markFailed: async (id) => updateBookingPayment({ id, paymentStatus: "failed" }),
        });
        return { ...result, totalUsd, invoiceUrl: invoice.invoice_url, paymentId: invoice.id };
      } catch (error) {
        console.error("[Payments] Failed to create NOWPayments invoice", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We could not create the crypto checkout. Please try again." });
      }
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
