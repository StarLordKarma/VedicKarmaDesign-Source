import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { bookingSchema, isProductionSmokeTestBooking } from "@shared/booking";
import { activityDateRangeSchema, attachNatalPdfSchema, bulkSendNatalPdfSchema, clientHistorySchema, editBookingClientSchema, pricingCurrencySchema, pricingHistoryFilterSchema, pricingHistoryPageSchema, sendNatalPdfSchema, servicePricingSchema, updateBookingAdminSchema } from "@shared/admin";
import { createBookingRequest, createSmokeTestRun, deleteBookingRequest, finishSmokeTestRun, getAdminActivityEvents, getAdminActivitySummary, getBookingRequestById, getClientChangeHistory, getPricingHistory, getPricingHistoryPage, getServicePricing, getSmokeTestRuns, listServicePricing, updateBookingClient, updateBookingDelivery, updateBookingPayment, updateServicePricing } from "./db";
import { notifyOwner } from "./_core/notification";
import { createCheckoutForBooking } from "./payment-flow";
import { runManualSmokeTest } from "./manual-smoke-test";
import { applyAdminBookingUpdate } from "./admin-update-flow";
import { attachNatalPdf, getAllBookingRequests } from "./db";
import { sendClientNatalPdf } from "./client-delivery";
import { storagePut } from "./storage";
import { buildActivityCsv, buildBookingsCsv, buildBookingsPdf, buildPricingHistoryCsv, decodePdfBase64, sanitizePdfName } from "./export";
import { ENV } from "./_core/env";

async function cleanupSmokeTestBooking(input: Parameters<typeof isProductionSmokeTestBooking>[0], bookingId: number, reason: "success" | "failure") {
  if (!isProductionSmokeTestBooking(input)) return false;
  try {
    await deleteBookingRequest(bookingId);
  } catch (cleanupError) {
    console.error(`[SmokeTest] Failed to clean up ${reason} test booking`, cleanupError);
  }
  return true;
}

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
  admin: router({
    bookingList: adminProcedure.query(() => getAllBookingRequests()),
    pricing: adminProcedure.query(() => listServicePricing()),
    pricingHistory: adminProcedure.input(pricingHistoryPageSchema.optional()).query(async ({ input }) => { const page = await getPricingHistoryPage(input?.page ?? 1, input?.pageSize ?? 10, input); return { ...page, items: page.items.map((entry) => ({ ...entry, changedByName: entry.changedBy === ENV.ownerOpenId ? ENV.ownerName : entry.changedBy })) }; }),
    smokeTestRuns: adminProcedure.query(() => getSmokeTestRuns(50)),
    runManualSmokeTest: adminProcedure.mutation(({ ctx }) => runManualSmokeTest(`${ctx.req.protocol}://${ctx.req.get("host")}`)),
    updatePricing: adminProcedure.input(servicePricingSchema).mutation(({ input, ctx }) => updateServicePricing({ ...input, updatedBy: ctx.user.openId })),
    activitySummary: adminProcedure.input(activityDateRangeSchema.optional()).query(({ input }) => getAdminActivitySummary(input ?? {})),
    clientHistory: adminProcedure.input(clientHistorySchema).query(({ input }) => getClientChangeHistory(input.bookingId)),
    updateBooking: adminProcedure.input(updateBookingAdminSchema).mutation(({ input, ctx }) => applyAdminBookingUpdate({ ...input, adminOpenId: ctx.user.openId })),
    editBookingClient: adminProcedure.input(editBookingClientSchema).mutation(({ input, ctx }) => updateBookingClient({ ...input, changedBy: ctx.user.openId })),
    exportCsv: adminProcedure.mutation(async () => ({ filename: `jyotish-bookings-${new Date().toISOString().slice(0, 10)}.csv`, contentBase64: Buffer.from(buildBookingsCsv(await getAllBookingRequests()), "utf8").toString("base64") })),
    exportActivityCsv: adminProcedure.input(activityDateRangeSchema.optional()).mutation(async ({ input }) => ({ filename: `jyotish-activity-${new Date().toISOString().slice(0, 10)}.csv`, contentBase64: Buffer.from(buildActivityCsv(await getAdminActivityEvents(input ?? {})), "utf8").toString("base64") })),
    exportPricingHistoryCsv: adminProcedure.input(pricingHistoryFilterSchema.optional()).mutation(async ({ input }) => { const history = await getPricingHistory(500, input); const namedHistory = history.map((entry) => ({ ...entry, changedByName: entry.changedBy === ENV.ownerOpenId ? ENV.ownerName : entry.changedBy })); return { filename: `jyotish-pricing-history-${new Date().toISOString().slice(0, 10)}.csv`, contentBase64: Buffer.from(buildPricingHistoryCsv(namedHistory), "utf8").toString("base64") }; }),
    exportPdf: adminProcedure.mutation(async () => ({ filename: `jyotish-bookings-${new Date().toISOString().slice(0, 10)}.pdf`, contentBase64: (await buildBookingsPdf(await getAllBookingRequests())).toString("base64") })),
    attachNatalPdf: adminProcedure.input(attachNatalPdfSchema).mutation(async ({ input, ctx }) => {
      const buffer = decodePdfBase64(input.contentBase64);
      const safeName = sanitizePdfName(input.fileName);
      const stored = await storagePut(`natal-charts/${input.bookingId}/${safeName}`, buffer, "application/pdf");
      return attachNatalPdf({ id: input.bookingId, key: stored.key, url: stored.url, name: safeName, uploadedBy: ctx.user.openId });
    }),
    sendNatalPdf: adminProcedure.input(sendNatalPdfSchema).mutation(async ({ input, ctx }) => {
      const booking = await getBookingRequestById(input.bookingId);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking request not found." });
      if (!booking.natalPdfKey || !booking.natalPdfName) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Attach a natal-chart PDF before sending it." });
      await updateBookingDelivery({ id: booking.id, deliveryStatus: "sending", deliveryError: null });
      try {
        const result = await sendClientNatalPdf({ email: booking.email, name: booking.name, pdfKey: booking.natalPdfKey, pdfName: booking.natalPdfName, language: booking.language });
        await updateBookingDelivery({ id: booking.id, deliveryStatus: "sent", deliveryError: null, deliveredBy: ctx.user.openId });
        return { success: true, providerId: result.id ?? null } as const;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Email delivery failed.";
        await updateBookingDelivery({ id: booking.id, deliveryStatus: "failed", deliveryError: message.slice(0, 1000) });
        throw error;
      }
    }),
    bulkSendNatalPdf: adminProcedure.input(bulkSendNatalPdfSchema).mutation(async ({ input, ctx }) => {
      const results: Array<{ bookingId: number; success: boolean; providerId?: string | null; error?: string }> = [];
      for (const bookingId of input.bookingIds) {
        const booking = await getBookingRequestById(bookingId);
        if (!booking) { results.push({ bookingId, success: false, error: "Booking request not found." }); continue; }
        if (!booking.natalPdfKey || !booking.natalPdfName) { results.push({ bookingId, success: false, error: "No natal-chart PDF attached." }); continue; }
        await updateBookingDelivery({ id: booking.id, deliveryStatus: "sending", deliveryError: null });
        try {
          const result = await sendClientNatalPdf({ email: booking.email, name: booking.name, pdfKey: booking.natalPdfKey, pdfName: booking.natalPdfName, language: booking.language });
          await updateBookingDelivery({ id: booking.id, deliveryStatus: "sent", deliveryError: null, deliveredBy: ctx.user.openId });
          results.push({ bookingId, success: true, providerId: result.id ?? null });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Email delivery failed.";
          await updateBookingDelivery({ id: booking.id, deliveryStatus: "failed", deliveryError: message.slice(0, 1000) });
          results.push({ bookingId, success: false, error: message.slice(0, 200) });
        }
      }
      return { results, sent: results.filter((result) => result.success).length, failed: results.filter((result) => !result.success).length } as const;
    }),
  }),
  pricing: router({
    current: publicProcedure.input(pricingCurrencySchema.optional()).query(({ input }) => getServicePricing(input?.currency)),
  }),
  booking: router({
    submit: publicProcedure.input(bookingSchema).mutation(async ({ input, ctx }) => {
      const pricing = await getServicePricing(input.currency);
      const totalUsd = pricing.basicUsd + (input.addon ? pricing.numerologyAddonUsd : 0);
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
        currency: input.currency,
        interest: input.interest || null,
        status: "new",
        paymentStatus: "creating",
      });
      const smokeRunStartedAt = Date.now();
      const isSmokeRun = isProductionSmokeTestBooking(input);
      if (isSmokeRun) await createSmokeTestRun(input.smokeTestRunId!);
      void notifyOwner({
        title: "New Vedic astrology booking",
        content: `${input.name} (${input.email}) requested a $${totalUsd} reading. Birth details: ${input.birthCity}, ${input.birthCountry}; ${input.birthDate} at ${input.birthTime}. Payment checkout is being created.`,
      });
      try {
        const origin = `${ctx.req.protocol}://${ctx.req.get("host")}`;
        const invoice = await createCheckoutForBooking({
          bookingId: result.id,
          totalUsd,
          priceCurrency: input.currency,
          addon: input.addon,
          origin,
          savePayment: updateBookingPayment,
          markFailed: async (id) => updateBookingPayment({ id, paymentStatus: "failed" }),
        });
        const shouldCleanupSmokeTest = await cleanupSmokeTestBooking(input, result.id, "success");
        const response = { ...result, totalUsd, invoiceUrl: invoice.invoice_url, paymentId: invoice.id, smokeTestCleanup: shouldCleanupSmokeTest ? "completed" : undefined };
        if (isSmokeRun) await finishSmokeTestRun({ runId: input.smokeTestRunId!, status: "succeeded", result: JSON.stringify({ ok: true, checkoutCurrency: input.currency, bookingId: result.id, paymentId: invoice.id, invoiceUrl: invoice.invoice_url }), durationMs: Date.now() - smokeRunStartedAt });
        return response;
      } catch (error) {
        console.error("[Payments] Failed to create NOWPayments invoice", error);
        if (isSmokeRun) await finishSmokeTestRun({ runId: input.smokeTestRunId!, status: "failed", result: JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), durationMs: Date.now() - smokeRunStartedAt });
        await cleanupSmokeTestBooking(input, result.id, "failure");
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
