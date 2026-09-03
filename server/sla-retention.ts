import type { Request, Response } from "express";
import { authenticateScheduledActor, isScheduledAuthError } from "./_core/scheduledAuth";
import { evaluateSla } from "./sla";

export async function evaluateSlaHandler(req: Request, res: Response) {
  try {
    const actor = await authenticateScheduledActor(req);
    const result = await evaluateSla({ trigger: "heartbeat", actor });
    res.json({ ok: true, ...result });
  } catch (error) {
    if (isScheduledAuthError(error)) {
      res.status(403).json({ error: "cron-only" });
      return;
    }
    res.status(500).json({ error: "sla-evaluation-failed", timestamp: new Date().toISOString() });
  }
}
