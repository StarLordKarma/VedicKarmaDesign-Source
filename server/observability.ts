import crypto from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

const SENSITIVE_KEY = /(email|birth|token|secret|password|authorization|cookie|pdf|content|body|signature|api.?key|ipn)/i;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,100}$/;

type RequestMeta = Request & { requestId?: string; clientIp?: string };

type LogLevel = "info" | "warn" | "error";

export function createRequestId() {
  return crypto.randomUUID();
}

export function getClientIp(req: Request) {
  const candidate = req.ip || req.socket.remoteAddress || "unknown";
  return candidate.replace(/^::ffff:/, "").slice(0, 80) || "unknown";
}

function sanitize(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (value instanceof Error) return { name: value.name, message: value.message.slice(0, 240) };
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

export function sanitizeLogMeta(meta: Record<string, unknown> = {}) {
  return sanitize(meta) as Record<string, unknown>;
}

export function logStructuredEvent(level: LogLevel, event: string, meta: Record<string, unknown> = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeLogMeta(meta),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const requestObservabilityMiddleware: RequestHandler = (req, res, next) => {
  const request = req as RequestMeta;
  const incoming = req.header("x-request-id")?.trim();
  request.requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : createRequestId();
  request.clientIp = getClientIp(req);
  res.setHeader("X-Request-ID", request.requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    logStructuredEvent(res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info", "http.request.completed", {
      requestId: request.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
};

export type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
};

type Bucket = { count: number; resetAt: number };

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${options.name}:${(options.key ?? getClientIp)(req)}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    current.count += 1;
    if (current.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds);
      res.status(429).json({ error: "rate_limited", requestId: (req as RequestMeta).requestId, retryAfterSeconds });
      logStructuredEvent("warn", "http.rate_limited", { requestId: (req as RequestMeta).requestId, scope: options.name, retryAfterSeconds });
      return;
    }
    next();
  };
}

const routeLimits: Array<{ pattern: RegExp; limiter: RequestHandler }> = [
  { pattern: /booking\.submit/, limiter: createRateLimit({ name: "booking-submit", windowMs: 15 * 60_000, max: 5 }) },
  { pattern: /pricing\.breakdownPdf/, limiter: createRateLimit({ name: "pricing-breakdown", windowMs: 10 * 60_000, max: 20 }) },
  { pattern: /pricing\.emailBreakdownPdf/, limiter: createRateLimit({ name: "receipt-email", windowMs: 60 * 60_000, max: 5 }) },
  { pattern: /admin\.(export|exportActivityCsv|exportPricingHistoryCsv|exportSmokeTestRunsCsv|exportPdf)/, limiter: createRateLimit({ name: "admin-export", windowMs: 10 * 60_000, max: 10 }) },
  { pattern: /reportStudio\./, limiter: createRateLimit({ name: "report-studio", windowMs: 10 * 60_000, max: 30 }) },
];

export const trpcRateLimitMiddleware: RequestHandler = (req, res, next) => {
  const route = req.originalUrl || req.url || req.path;
  const matched = routeLimits.find(item => item.pattern.test(route));
  if (!matched) return next();
  return matched.limiter(req, res, next);
};

export function withRateLimit(limiter: RequestHandler, handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => limiter(req, res, error => error ? next(error) : handler(req, res, next));
}
