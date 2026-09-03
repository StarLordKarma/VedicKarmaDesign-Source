import type { Request, Response } from "express";
import { cleanupExpiredPaymentTestLabRuns } from "./db";
import { authenticateScheduledActor, isScheduledAuthError } from "./_core/scheduledAuth";

export async function cleanupPaymentTestLabRunsHandler(req: Request, res: Response) {
  try {
    await authenticateScheduledActor(req);
    res.json({ ok: true, ...(await cleanupExpiredPaymentTestLabRuns()) });
  } catch (error) {
    if (isScheduledAuthError(error)) return res.status(403).json({ error: "cron-only" });
    res.status(500).json({ error: String(error), context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
