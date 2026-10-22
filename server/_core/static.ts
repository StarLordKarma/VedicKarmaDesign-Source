import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { isPublicPage } from "../../shared/seo";
import { renderPageHtml } from "./seo";

/** Serve the prebuilt client without importing development-only Vite packages. */
export function serveStatic(app: Express, distPath = path.resolve(import.meta.dirname, "public")) {
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  const template = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
  app.get("/index.html", (_req, res) => res.redirect(301, "/"));
  app.use(express.static(distPath, { index: false }));
  app.get("*", (req, res) => {
    const appPage = isPublicPage(req.path) || /^\/(pay|status)\/[^/]+$/.test(req.path) || /^\/admin(?:\/|$)/.test(req.path) || req.path === "/owner-login";
    if (!isPublicPage(req.path)) res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.set("Cache-Control", "no-cache");
    res.status(appPage ? 200 : 404).type("html").send(renderPageHtml(template, req.originalUrl));
  });
}
