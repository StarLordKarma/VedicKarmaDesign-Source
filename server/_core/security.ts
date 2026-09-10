import type { RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CROSS_SITE_EXCEPTIONS = new Set(["/api/nowpayments/ipn"]);

/**
 * Reject browser-initiated cross-site writes before they reach cookie-backed APIs.
 * Provider webhooks are authenticated independently and explicitly exempted.
 */
export const crossSiteWriteGuard: RequestHandler = (req, res, next) => {
  if (
    SAFE_METHODS.has(req.method) ||
    CROSS_SITE_EXCEPTIONS.has(req.path) ||
    req.header("sec-fetch-site") !== "cross-site"
  ) {
    next();
    return;
  }
  res.status(403).json({ error: "cross_site_write_rejected" });
};

export const applicationSecurityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
};
