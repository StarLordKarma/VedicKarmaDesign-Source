import type { Express } from "express";
import { getClientReportDownload } from "./client-status";
import { createRateLimit } from "./observability";

const clientReportDownloadRateLimit = createRateLimit({
  name: "client-report-download",
  windowMs: 10 * 60_000,
  max: 20,
});

export function registerClientReportDownload(app: Express) {
  app.get(
    "/api/client/report/:token",
    clientReportDownloadRateLimit,
    async (req, res) => {
      try {
        const result = await getClientReportDownload(req.params.token ?? "");
        res.set("Cache-Control", "no-store");
        res.set("Referrer-Policy", "no-referrer");
        if (result.kind === "ready") return void res.redirect(307, result.url);
        if (result.kind === "unavailable")
          return void res.status(503).send("Report service unavailable");
        if (result.kind === "not_ready")
          return void res.status(404).send("Report is not ready");
        return void res
          .status(410)
          .send("Report link is invalid or no longer active");
      } catch (error) {
        console.error("[ClientReportDownload] failed", error);
        res.status(502).send("Report download unavailable");
      }
    }
  );
}
