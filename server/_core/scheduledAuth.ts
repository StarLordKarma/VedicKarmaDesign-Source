import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { sdk } from "./sdk";

const SCHEDULED_ACTOR = Symbol("scheduled-task-actor");
type ScheduledRequest = Request & { [SCHEDULED_ACTOR]?: string };

function matchesSecret(expected: string, provided: string | undefined) {
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function scheduledTaskGuard(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.SCHEDULED_TASK_SECRET?.trim();
  if (!expected) return next();
  const bearer = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const provided = bearer ?? req.header("x-scheduled-task-secret");
  if (!matchesSecret(expected, provided)) return res.status(401).json({ error: "Unauthorized scheduled task" });
  (req as ScheduledRequest)[SCHEDULED_ACTOR] = "external-scheduler";
  next();
}

export async function authenticateScheduledActor(req: Request) {
  const externalActor = (req as ScheduledRequest)[SCHEDULED_ACTOR];
  if (externalActor) return externalActor;
  const user = await sdk.authenticateRequest(req);
  if (!user.isCron || !user.taskUid) throw new ScheduledAuthError();
  return user.taskUid;
}

export class ScheduledAuthError extends Error {
  constructor() {
    super("cron-only");
    this.name = "ScheduledAuthError";
  }
}

export function isScheduledAuthError(error: unknown): error is ScheduledAuthError {
  return error instanceof ScheduledAuthError;
}
