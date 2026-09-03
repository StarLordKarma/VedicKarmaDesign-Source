import type { Express } from "express";
import { ENV } from "./env";
import { isReceiptFileActive } from "../db";
import { sdk } from "./sdk";
import { storageGetSignedUrl } from "../storage";

async function isOwnerRequest(req: Parameters<typeof sdk.authenticateRequest>[0]) {
  try {
    const user = await sdk.authenticateRequest(req);
    return Boolean(ENV.ownerOpenId) && user.openId === ENV.ownerOpenId;
  } catch {
    return false;
  }
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    try {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (key.startsWith("price-breakdowns/")) {
      if (!(await isReceiptFileActive(key))) {
        res.status(410).send("Receipt link expired");
        return;
      }
    } else if (!(await isOwnerRequest(req))) {
      res.status(403).send("Owner authorization required");
      return;
    }

      const url = await storageGetSignedUrl(key);
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
