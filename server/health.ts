import type { RequestHandler } from "express";
import { checkDatabaseReadiness } from "./db";

export const healthHandler: RequestHandler = (_req, res) => {
  res.status(200).json({ ok: true, service: "vedic-astrology-booking" });
};

export const readinessHandler: RequestHandler = async (_req, res) => {
  const database = await checkDatabaseReadiness();
  const ready = database;
  res.status(ready ? 200 : 503).json({ ok: ready, checks: { database } });
};
