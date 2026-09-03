import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { bookingSchema, buildBookingPriceSnapshot, isProductionSmokeTestBooking, validatePromoCode } from "@shared/booking";
import { addSlaEmailAllowlistSchema, removeSlaEmailAllowlistSchema, updateSlaEmailAllowlistSchema, activityDateRangeSchema, attachNatalPdfSchema, bulkSendNatalPdfSchema, clientHistorySchema, createReportStudioTestJobSchema, createServicePackageVersionSchema, editBookingClientSchema, pricingCurrencySchema, pricingHistoryFilterSchema, pricingHistoryPageSchema, receiptEmailHistoryPageSchema, runIpnSimulationSchema, sendNatalPdfSchema, servicePricingSchema, smokeTestRunsPageSchema, slaEvaluationRunsPageSchema, updateBookingAdminSchema, updateServicePackageVersionSchema, reportRunSchema, reportApprovalSchema, sendSlaChartPdfSchema } from "@shared/admin";
import { createBookingRequest, createSmokeTestRun, deleteBookingRequest, finishSmokeTestRun, getAdminActivityEvents, getAdminActivitySummary, getBookingRequestById, getClientChangeHistory, getPaymentTestLabRuns, getPaymentTestLabRetentionSettings, previewPaymentTestLabRetentionCleanup, getPaymentTestLabRetentionChanges, updatePaymentTestLabRetentionDays, updatePaymentTestLabNotificationLocale, cleanupExpiredPaymentTestLabRuns, getPaymentTestLabCleanupHistory, buildPaymentTestLabCleanupHistoryCsv, getPricingHistory, getPricingHistoryPage, getServicePricing, getSmokeTestRuns, getSmokeTestRunsForExport, getSmokeTestRunsPage, getReceiptRetentionHours, cleanupExpiredReceiptFiles, listServicePricing, getReceiptEmailHistoryPage, getLatestReceiptEmailAttempt, createReceiptEmailAttempt, finishReceiptEmailAttempt, normalizeReceiptEmail, isReceiptEmailCoolingDown, recordReceiptEmailFailureAlert, RECEIPT_EMAIL_COOLDOWN_MS, listSlaEmailAllowlist, addSlaEmailAllowlist, setSlaEmailAllowlistEnabled, removeSlaEmailAllowlist, isSlaEmailAllowed, updateBookingClient, updateBookingDelivery, updateBookingPayment, updateReceiptRetentionHours, updateServicePricing, createServicePackageVersion, getActiveServicePackage, listActiveServicePackages, listServicePackages, setServicePackageActive, SERVICE_PACKAGE_CODES, updateServicePackageVersion } from "./db";
import { notifyOwner } from "./_core/notification";
import { buildCheckoutBreakdownPdf, buildSmokeTestRunsCsv } from "./export";
import { createCheckoutForBooking } from "./payment-flow";
import { runManualSmokeTest } from "./manual-smoke-test";
import { runSignedIpnSimulation } from "./payment-ipn-test-harness";
import { applyAdminBookingUpdate } from "./admin-update-flow";
import { attachNatalPdf, getAllBookingRequests, registerReceiptFile } from "./db";
import { sendClientNatalPdf, sendClientReceiptPdf, sendSlaChartPdf } from "./client-delivery";
import { storagePut } from "./storage";
import { buildActivityCsv, buildBookingsCsv, buildBookingsPdf, buildPricingHistoryCsv, buildSlaEvaluationRunsCsv, decodePdfBase64, sanitizePdfName } from "./export";
import { ENV } from "./_core/env";
import { approveReportVersion, createReportStudioTestJob, deleteReportStudioTestJob, enqueueReportJobForBooking, getReportProcessingSettings, getReportReviewJob, listReportReviewJobs, processReportJob, retryReportDelivery, setReportProcessingSettings } from "./report-studio-db";
import { AI_NARRATIVE_MODELS } from "./report-narrative";
import { createClientStatusLink, getPublicClientStatus, listClientStatusLinks, revokeClientStatusLink } from "./client-status";
import { evaluateSla, getOwnerMetrics, getSlaEvaluationRuns, getSlaSettings, setSlaSettings } from "./sla";
import { timingSafeEqual } from "node:crypto";
import { reviseReportNarrative } from "./report-studio-db";

function secretsMatch(expected: string, provided: string | undefined) {
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

function getPublicOrigin(req: { protocol: string; get(name: string): string | undefined }) {
  if (ENV.publicBaseUrl) return ENV.publicBaseUrl.replace(/\/+$/, "");
  if (ENV.isProduction) throw new Error("PUBLIC_BASE_URL must be configured in production.");
  return `${req.protocol}://${req.get("host")}`;
}

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
    servicePackages: adminProcedure.query(() => listServicePackages()),
    updateServicePackageActive: adminProcedure.input(z.object({ code: z.enum(SERVICE_PACKAGE_CODES), version: z.number().int().positive(), active: z.boolean() })).mutation(({ input, ctx }) => setServicePackageActive({ ...input, actor: ctx.user.openId })),
    createServicePackageVersion: adminProcedure.input(createServicePackageVersionSchema).mutation(({ input, ctx }) => createServicePackageVersion({ ...input, actor: ctx.user.openId })),
    updateServicePackageVersion: adminProcedure.input(updateServicePackageVersionSchema).mutation(({ input, ctx }) => updateServicePackageVersion({ ...input, actor: ctx.user.openId })),
    receiptRetention: adminProcedure.query(() => getReceiptRetentionHours()),
    updateReceiptRetention: adminProcedure.input(z.object({ retentionHours: z.union([z.literal(24), z.literal(48), z.literal(72)]) })).mutation(({ input, ctx }) => updateReceiptRetentionHours(input.retentionHours, ctx.user.openId)),
    cleanupExpiredReceipts: adminProcedure.mutation(async () => ({ deleted: await cleanupExpiredReceiptFiles() })),
    receiptEmailHistory: adminProcedure.input(receiptEmailHistoryPageSchema.optional()).query(({ input }) => getReceiptEmailHistoryPage({ status: input?.status, recipient: input?.recipient, page: input?.page ?? 1, pageSize: input?.pageSize ?? 10 })),
    pricingHistory: adminProcedure.input(pricingHistoryPageSchema.optional()).query(async ({ input }) => { const page = await getPricingHistoryPage(input?.page ?? 1, input?.pageSize ?? 10, input); return { ...page, items: page.items.map((entry) => ({ ...entry, changedByName: entry.changedBy === ENV.ownerOpenId ? ENV.ownerName : entry.changedBy })) }; }),
    smokeTestRuns: adminProcedure.input(smokeTestRunsPageSchema.optional()).query(({ input }) => getSmokeTestRunsPage(input ?? {})),
    exportSmokeTestRunsCsv: adminProcedure.input(smokeTestRunsPageSchema.omit({ page: true, pageSize: true }).optional()).mutation(async ({ input }) => { const rows = await getSmokeTestRunsForExport(input ?? {}); return { filename: `smoke-test-runs-${new Date().toISOString().slice(0, 10)}.csv`, contentBase64: Buffer.from(buildSmokeTestRunsCsv(rows), "utf8").toString("base64") }; }),
    runManualSmokeTest: adminProcedure.mutation(({ ctx }) => runManualSmokeTest(getPublicOrigin(ctx.req))),
    runIpnSimulation: adminProcedure.input(runIpnSimulationSchema).mutation(({ input, ctx }) => runSignedIpnSimulation({ ...input, actorId: ctx.user.openId })),
    paymentTestLabRetention: adminProcedure.query(() => getPaymentTestLabRetentionSettings()),
    paymentTestLabRetentionPreview: adminProcedure.input(z.object({ retentionDays: z.number().int().min(7).max(3650).optional() }).optional()).query(({ input }) => previewPaymentTestLabRetentionCleanup(input?.retentionDays)),
    paymentTestLabRetentionChanges: adminProcedure.query(() => getPaymentTestLabRetentionChanges()),
    updatePaymentTestLabRetention: adminProcedure.input(z.object({ retentionDays: z.number().int().min(7).max(3650) })).mutation(({ input, ctx }) => updatePaymentTestLabRetentionDays(input.retentionDays, ctx.user.openId)),
    updatePaymentTestLabNotificationLocale: adminProcedure.input(z.object({ notificationLocale: z.enum(["en", "ru", "de", "es"]) })).mutation(({ input, ctx }) => updatePaymentTestLabNotificationLocale(input.notificationLocale, ctx.user.openId)),
    paymentTestLabCleanupHistory: adminProcedure.input(z.object({ triggeredBy: z.string().max(64).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional()).query(({ input }) => getPaymentTestLabCleanupHistory(input ?? {})),
    exportPaymentTestLabCleanupHistoryCsv: adminProcedure.input(z.object({ triggeredBy: z.string().max(64).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional()).mutation(async ({ input }) => ({ filename: `payment-test-lab-cleanup-history-${new Date().toISOString().slice(0, 10)}.csv`, contentBase64: Buffer.from(buildPaymentTestLabCleanupHistoryCsv(await getPaymentTestLabCleanupHistory(input ?? {})), "utf8").toString("base64") })),
    cleanupPaymentTestLabRuns: adminProcedure.mutation(({ ctx }) => cleanupExpiredPaymentTestLabRuns({ triggeredBy: ctx.user.openId })),
    paymentTestLabRuns: adminProcedure.input(z.object({ status: z.enum(["running", "succeeded", "failed"]).optional(), search: z.string().max(64).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), page: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).max(50).optional() }).optional()).query(({ input }) => getPaymentTestLabRuns(input ?? {})),
    exportPaymentTestLabRunsCsv: adminProcedure.input(z.object({ status: z.enum(["running", "succeeded", "failed"]).optional(), search: z.string().max(64).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional()).mutation(async ({ input }) => { const rows = (await getPaymentTestLabRuns({ ...(input ?? {}), page: 1, pageSize: 50 })).items; const csv = ["Run ID,Status,Requested status,Started at,Finished at,Duration ms,Error code", ...rows.map((row) => [row.runId,row.status,row.paymentStatus,row.startedAt.toISOString(),row.finishedAt?.toISOString() ?? "",row.durationMs ?? "",row.errorCode ?? ""].map((cell) => `\"${String(cell).replaceAll("\"", "\"\"")}\"`).join(","))].join("\n"); return { filename: `payment-test-lab-${new Date().toISOString().slice(0,10)}.csv`, contentBase64: Buffer.from(csv, "utf8").toString("base64") }; }),
    resendStatus: adminProcedure.query(() => ({ configured: Boolean(ENV.resendApiKey && ENV.resendFromEmail), fromAddressConfigured: Boolean(ENV.resendFromEmail), mode: process.env.RUN_EXTERNAL_CREDENTIAL_TESTS === "true" ? "live_probe_enabled" : "configuration_monitored" })),
    updatePricing: adminProcedure.input(servicePricingSchema).mutation(({ input, ctx }) => updateServicePricing({ ...input, updatedBy: ctx.user.openId })),
    activitySummary: adminProcedure.input(activityDateRangeSchema.optional()).query(({ input }) => getAdminActivitySummary(input ?? {})),
    clientHistory: adminProcedure.input(clientHistorySchema).query(({ input }) => getClientChangeHistory(input.bookingId)),
    updateBooking: adminProcedure.input(updateBookingAdminSchema).mutation(({ input, ctx }) => applyAdminBookingUpdate({ ...input, adminOpenId: ctx.user.openId })),
    editBookingClient: adminProcedure.input(editBookingClientSchema).mutation(({ input, ctx }) => updateBookingClient({ ...input, changedBy: ctx.user.openId })),
    exportCsv: adminProcedure.mutation(async () => ({ filename: `jyotish-bookings-${new Date().toISOString().slice(0, 10)}.csv`, contentBase64: Buffer.from(buildBookingsCsv(await getAllBookingRequests()), "utf8").toString("base64") })),
    exportActivityCsv: adminProcedure.input(activityDateRangeSchema.optional()).mutation(async ({ input }) => ({ filename: `jyotish-activity-${new Date().toISOString().slice(0, 10)}.csv`, contentBase64: Buffer.from(buildActivityCsv(await getAdminActivityEvents(input ?? {})), "utf8").toString("base64") })),
    exportPricingHistoryCsv: adminProcedure.input(pricingHistoryFilterSchema.optional()).mutation(async ({ input }) => { const history = await getPricingHistory(500, input); const namedHistory = history.map((entry) => ({ ...entry, changedByName: entry.changedBy === ENV.ownerOpenId ? ENV.ownerName : entry.changedBy })); return { filename: `jyotish-pricing-history-${new Date().toISOString().slice(0, 10)}.csv`, contentBase64: Buffer.from(buildPricingHistoryCsv(namedHistory), "utf8").toString("base64") }; }),
    exportPdf: adminProcedure.mutation(async () => ({ filename: `jyotish-bookings-${new Date().toISOString().slice(0, 10)}.pdf`, contentBase64: (await buildBookingsPdf(await getAllBookingRequests())).toString("base64") })),
    clientStatusLinks: adminProcedure.query(() => listClientStatusLinks()),
    createClientStatusLink: adminProcedure.input(z.object({ bookingId: z.number().int().positive(), expiryHours: z.number().int().min(1).max(720) })).mutation(({ input, ctx }) => createClientStatusLink({ ...input, createdBy: ctx.user.openId })),
    revokeClientStatusLink: adminProcedure.input(z.object({ tokenId: z.number().int().positive() })).mutation(({ input, ctx }) => revokeClientStatusLink(input.tokenId, ctx.user.openId)),
    metrics: adminProcedure.input(z.object({ since: z.coerce.date().optional(), until: z.coerce.date().optional() }).optional()).query(({ input }) => getOwnerMetrics(input?.since, input?.until)),
    slaEvaluationRuns: adminProcedure.input(slaEvaluationRunsPageSchema.optional()).query(({ input }) => getSlaEvaluationRuns(input ?? {})),
    exportMetricsCsv: adminProcedure.input(slaEvaluationRunsPageSchema.omit({ page: true, pageSize: true }).optional()).mutation(async ({ input }) => { const [metrics, runs] = await Promise.all([getOwnerMetrics(input?.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined, input?.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined), getSlaEvaluationRuns(input ?? {})]); return { filename: `jyotish-metrics-${new Date().toISOString().slice(0, 10)}.csv`, contentBase64: Buffer.from(buildSlaEvaluationRunsCsv(metrics, runs.items), "utf8").toString("base64") }; }),
    slaEmailAllowlist: adminProcedure.query(() => listSlaEmailAllowlist()),
    addSlaEmailAllowlist: adminProcedure.input(addSlaEmailAllowlistSchema).mutation(({ input, ctx }) => addSlaEmailAllowlist({ ...input, actor: ctx.user.openId })),
    updateSlaEmailAllowlist: adminProcedure.input(updateSlaEmailAllowlistSchema).mutation(({ input, ctx }) => setSlaEmailAllowlistEnabled({ ...input, actor: ctx.user.openId })),
    removeSlaEmailAllowlist: adminProcedure.input(removeSlaEmailAllowlistSchema).mutation(({ input }) => removeSlaEmailAllowlist(input)),
    sendSlaChartPdf: adminProcedure.input(sendSlaChartPdfSchema).mutation(async ({ input }) => { if (!(await isSlaEmailAllowed(input.email))) throw new TRPCError({ code: "FORBIDDEN", message: "This recipient is not on the active SLA email allowlist." }); const pdfBytes = decodePdfBase64(input.contentBase64); const result = await sendSlaChartPdf({ email: input.email, pdfBytes, pdfName: input.fileName, rangeLabel: input.rangeLabel, language: input.language }); return { success: true, providerId: result.id ?? null } as const; }),
    slaSettings: adminProcedure.query(() => getSlaSettings()),
    updateSlaSettings: adminProcedure.input(z.object({ enabled: z.boolean(), preparationHours: z.number().int().min(1).max(720), deliveryHours: z.number().int().min(1).max(720), alertCooldownMinutes: z.number().int().min(5).max(10080) })).mutation(({ input, ctx }) => setSlaSettings({ ...input, updatedBy: ctx.user.openId })),
    evaluateSla: adminProcedure.mutation(({ ctx }) => evaluateSla({ trigger: "manual", actor: ctx.user.openId })),
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
  reportStudio: router({
    queue: adminProcedure.query(() => listReportReviewJobs()),
    getJob: adminProcedure.input(z.object({ reportJobId: z.number().int().positive() })).query(({ input }) => getReportReviewJob(input.reportJobId)),
    createTestJob: adminProcedure.input(createReportStudioTestJobSchema).mutation(({ input, ctx }) => createReportStudioTestJob({ ...input, actorId: ctx.user.openId })),
    deleteTestJob: adminProcedure.input(reportRunSchema).mutation(({ input, ctx }) => deleteReportStudioTestJob({ ...input, actorId: ctx.user.openId })),
    runCalculation: adminProcedure.input(reportRunSchema).mutation(({ input, ctx }) => processReportJob({ ...input, actorId: ctx.user.openId })),
    approve: adminProcedure.input(reportApprovalSchema).mutation(({ input, ctx }) => approveReportVersion({ ...input, actorId: ctx.user.openId })),
    reviseNarrative: adminProcedure.input(z.object({ reportJobId: z.number().int().positive(), baseVersionId: z.number().int().positive(), narrativeJson: z.string().max(100_000) })).mutation(({ input, ctx }) => reviseReportNarrative({ ...input, actorId: ctx.user.openId })),
    retryDelivery: adminProcedure.input(reportApprovalSchema.pick({ reportJobId: true, versionId: true })).mutation(({ input, ctx }) => retryReportDelivery({ ...input, actorId: ctx.user.openId })),
    processingSettings: adminProcedure.query(() => getReportProcessingSettings()),
    updateProcessingSettings: adminProcedure.input(z.object({ autoProcessEnabled: z.boolean(), aiModel: z.enum(AI_NARRATIVE_MODELS), maxTokens: z.number().int().min(1000).max(12000), maxSections: z.number().int().min(1).max(12), maxParagraphChars: z.number().int().min(300).max(1800) })).mutation(({ input, ctx }) => setReportProcessingSettings({ ...input, actorId: ctx.user.openId })),
  }),
  status: router({
    get: publicProcedure.input(z.object({ token: z.string().min(32).max(100) })).query(({ input }) => getPublicClientStatus(input.token)),
  }),
  pricing: router({
    current: publicProcedure.input(pricingCurrencySchema.optional()).query(({ input }) => getServicePricing(input?.currency)),
    packages: publicProcedure.query(() => listActiveServicePackages()),
    validatePromo: publicProcedure.input(z.object({ currency: pricingCurrencySchema.shape.currency, addon: z.boolean(), promoCode: z.string().trim().max(32) })).mutation(async ({ input }) => { const pricing = await getServicePricing(input.currency); const validation = validatePromoCode(input.promoCode); const subtotal = pricing.basicUsd + (input.addon ? pricing.numerologyAddonUsd : 0); const discountAmount = validation.valid ? Math.round(subtotal * validation.discountPercent) / 100 : 0; return { ...validation, discountAmount, totalAmount: Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100) }; }),
    breakdownPdf: publicProcedure.input(z.object({ currency: pricingCurrencySchema.shape.currency, locale: z.string().min(2).max(20), addon: z.boolean(), labels: z.object({ title: z.string().min(1).max(120), currency: z.string().min(1).max(40), basic: z.string().min(1).max(120), addon: z.string().min(1).max(120), addonNotSelected: z.string().min(1).max(80), total: z.string().min(1).max(80), generated: z.string().min(1).max(80), disclaimer: z.string().min(1).max(3000) }) })).mutation(async ({ input }) => { const pricing = await getServicePricing(input.currency); const pdf = await buildCheckoutBreakdownPdf({ ...input, basicUsd: pricing.basicUsd, numerologyAddonUsd: pricing.numerologyAddonUsd }); const stored = await storagePut(`price-breakdowns/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.pdf`, pdf, "application/pdf"); const receipt = await registerReceiptFile(stored.key); return { filename: `jyotish-price-breakdown-${input.currency.toLowerCase()}.pdf`, contentBase64: pdf.toString("base64"), url: stored.url, expiresAt: receipt.expiresAt.toISOString() }; }),
    emailBreakdownPdf: publicProcedure.input(z.object({ email: z.string().email().max(320), currency: pricingCurrencySchema.shape.currency, locale: z.string().min(2).max(20), addon: z.boolean(), labels: z.object({ title: z.string().min(1).max(120), currency: z.string().min(1).max(40), basic: z.string().min(1).max(120), addon: z.string().min(1).max(120), addonNotSelected: z.string().min(1).max(80), total: z.string().min(1).max(80), generated: z.string().min(1).max(80), disclaimer: z.string().min(1).max(3000) }), language: z.string().min(2).max(30) })).mutation(async ({ input }) => {
      const normalizedEmail = normalizeReceiptEmail(input.email);
      const latest = await getLatestReceiptEmailAttempt(normalizedEmail);
      if (isReceiptEmailCoolingDown(latest?.requestedAt)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please wait before requesting another receipt." });
      const pricing = await getServicePricing(input.currency);
      const pdf = await buildCheckoutBreakdownPdf({ currency: input.currency, locale: input.locale, addon: input.addon, labels: input.labels, basicUsd: pricing.basicUsd, numerologyAddonUsd: pricing.numerologyAddonUsd });
      const stored = await storagePut(`price-breakdowns/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.pdf`, pdf, "application/pdf");
      await registerReceiptFile(stored.key);
      const attempt = await createReceiptEmailAttempt({ recipientEmail: normalizedEmail, storageKey: stored.key, language: input.language });
      try {
        const result = await sendClientReceiptPdf({ email: normalizedEmail, pdfKey: stored.key, pdfName: `jyotish-price-breakdown-${input.currency.toLowerCase()}.pdf`, language: input.language });
        await finishReceiptEmailAttempt({ id: attempt.id, status: "sent", providerId: result.id ?? null });
        return { success: true, providerId: result.id ?? null, url: stored.url, cooldownSeconds: RECEIPT_EMAIL_COOLDOWN_MS / 1000 } as const;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Receipt email delivery failed.";
        await finishReceiptEmailAttempt({ id: attempt.id, status: "failed", error: message });
        const alert = await recordReceiptEmailFailureAlert(normalizedEmail);
        if (alert.shouldAlert) void notifyOwner({ title: "Repeated receipt email delivery failures", content: `${alert.failureCount} receipt email attempts failed for ${normalizedEmail} within the last hour. Latest error: ${message.slice(0, 400)}` });
        throw error;
      }
    }),
  }),
  booking: router({
    submit: publicProcedure.input(bookingSchema).mutation(async ({ input, ctx }) => {
      const selectedPackage = await getActiveServicePackage(input.addon ? "basic_plus" : "basic");
      if (!selectedPackage) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The selected service package is currently unavailable." });
      const pricing = await getServicePricing(input.currency);
      if (input.promoCode && !validatePromoCode(input.promoCode).valid) throw new TRPCError({ code: "BAD_REQUEST", message: "This promo code is not valid." });
      const priceSnapshot = { ...buildBookingPriceSnapshot({ addon: input.addon, currency: input.currency, basicAmount: pricing.basicUsd, addonAmount: pricing.numerologyAddonUsd, promoCode: input.promoCode }), packageVersion: selectedPackage.version };
      const totalUsd = priceSnapshot.totalAmount;
      const result = await createBookingRequest({
        name: input.name,
        email: input.email,
        birthDate: input.birthDate,
        birthTime: input.birthTime,
        birthCity: input.birthCity,
        birthCountry: input.birthCountry,
        language: input.language,
        addon: input.addon ? 1 : 0,
        packageCode: priceSnapshot.packageCode,
        packageVersion: priceSnapshot.packageVersion,
        priceSnapshotJson: JSON.stringify(priceSnapshot),
        totalUsd,
        currency: input.currency,
        interest: input.interest || null,
        privacyConsentVersion: input.privacyNoticeVersion,
        privacyConsentLocale: input.privacyLocale,
        privacyConsentAt: new Date(),
        status: "new",
        paymentStatus: "creating",
      });
      const smokeRunStartedAt = Date.now();
      const requestedSmokeRun = isProductionSmokeTestBooking(input);
      const isSmokeRun = requestedSmokeRun && secretsMatch(ENV.productionSmokeSecret, ctx.req.header("x-production-smoke-secret"));
      if (requestedSmokeRun && !isSmokeRun) {
        await deleteBookingRequest(result.id);
        throw new TRPCError({ code: "FORBIDDEN", message: "Production smoke-test authorization failed." });
      }
      if (isSmokeRun) await createSmokeTestRun(input.smokeTestRunId!);
      void notifyOwner({
        title: "New Vedic astrology booking",
        content: `Booking #${result.id} received. Open the owner dashboard to review it. Payment checkout is being created.`,
      });
      try {
        const origin = getPublicOrigin(ctx.req);
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
