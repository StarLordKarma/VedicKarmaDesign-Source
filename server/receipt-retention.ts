import type { Request, Response } from "express";
import { cleanupExpiredReceiptFiles } from "./db";
import { sdk } from "./_core/sdk";

export async function cleanupReceiptFilesHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }

    const deleted = await cleanupExpiredReceiptFiles();
    res.json({ ok: true, deleted, retentionHours: 48 });
  } catch (error) {
    res.status(500).json({
      error: String(error),
      context: { url: req.originalUrl, taskUid: req.headers["x-heartbeat-task-uid"] ?? null },
      timestamp: new Date().toISOString(),
    });
  }
}
