import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { evaluateSla } from "./sla";

export async function evaluateSlaHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }
    const result = await evaluateSla({ trigger: "heartbeat", actor: user.taskUid });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: "sla-evaluation-failed", timestamp: new Date().toISOString() });
  }
}
