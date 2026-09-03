import type { Request, Response } from "express";
import { cleanupExpiredReceiptFiles, getReceiptRetentionHours } from "./db";
import { authenticateScheduledActor, isScheduledAuthError } from "./_core/scheduledAuth";

export async function cleanupReceiptFilesHandler(req: Request, res: Response) {
  try {
    await authenticateScheduledActor(req);

    const [deleted, retentionHours] = await Promise.all([cleanupExpiredReceiptFiles(), getReceiptRetentionHours()]);
    res.json({ ok: true, deleted, retentionHours });
  } catch (error) {
    if (isScheduledAuthError(error)) {
      res.status(403).json({ error: "cron-only" });
      return;
    }
    res.status(500).json({
      error: String(error),
      context: { url: req.originalUrl, taskUid: req.headers["x-heartbeat-task-uid"] ?? null },
      timestamp: new Date().toISOString(),
    });
  }
}
