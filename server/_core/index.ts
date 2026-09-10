import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerNowPaymentsWebhook } from "../nowpayments.webhook";
import { cleanupReceiptFilesHandler } from "../receipt-retention";
import { evaluateSlaHandler } from "../sla-retention";
import { cleanupPaymentTestLabRunsHandler } from "../payment-test-retention";
import {
  requestObservabilityMiddleware,
  trpcRateLimitMiddleware,
} from "../observability";
import { healthHandler, readinessHandler } from "../health";
import { scheduledTaskGuard } from "./scheduledAuth";
import { registerOidcRoutes } from "./oidc";
import {
  independentConfigurationErrors,
  sandboxConfigurationErrors,
} from "./configuration";
import { registerClientReportDownload } from "../client-report-download";
import { registerSandboxAuthRoutes } from "./sandbox-auth";
import { applicationSecurityHeaders, crossSiteWriteGuard } from "./security";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const errors = [
    ...independentConfigurationErrors(),
    ...sandboxConfigurationErrors(),
  ];
  if (errors.length)
    throw new Error(
      `Independent deployment configuration: ${errors.join("; ")}`
    );
  const app = express();
  app.set(
    "trust proxy",
    process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : false
  );
  app.use(requestObservabilityMiddleware);
  app.use(applicationSecurityHeaders);
  app.use(crossSiteWriteGuard);
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/health", healthHandler);
  app.get("/ready", readinessHandler);
  registerNowPaymentsWebhook(app);
  registerStorageProxy(app);
  registerClientReportDownload(app);
  registerSandboxAuthRoutes(app);
  registerOAuthRoutes(app);
  registerOidcRoutes(app);
  app.post(
    "/api/scheduled/cleanup-receipts",
    scheduledTaskGuard,
    cleanupReceiptFilesHandler
  );
  app.post(
    "/api/scheduled/evaluate-sla",
    scheduledTaskGuard,
    evaluateSlaHandler
  );
  app.post(
    "/api/scheduled/cleanup-payment-test-lab",
    scheduledTaskGuard,
    cleanupPaymentTestLabRunsHandler
  );
  // tRPC API
  app.use("/api/trpc", trpcRateLimitMiddleware);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port =
    process.env.NODE_ENV === "development"
      ? await findAvailablePort(preferredPort)
      : preferredPort;

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(
    port,
    process.env.NODE_ENV === "development" ? "127.0.0.1" : "0.0.0.0",
    () => {
      console.log(`Server running on http://localhost:${port}/`);
    }
  );
}

startServer().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
