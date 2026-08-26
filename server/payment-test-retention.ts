import type { Request, Response } from "express";
import { cleanupExpiredPaymentTestLabRuns } from "./db";
import { sdk } from "./_core/sdk";

export async function cleanupPaymentTestLabRunsHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    res.json({ ok: true, ...(await cleanupExpiredPaymentTestLabRuns(90)) });
  } catch (error) {
    res.status(500).json({ error: String(error), context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
