import { getDeployStore } from "@netlify/blobs";
import { createRelay } from "../lib/relay.mjs";
import { publicKey, expiresAt } from "../lib/deployment.mjs";
export default async request => {
  try {
    return await createRelay({
      store: getDeployStore({
        name: "riskpay-fixture-events",
        consistency: "strong",
      }),
      publicKey,
      expiresAt,
    })(request);
  } catch {
    return new Response(JSON.stringify({ error: "receiver_unavailable" }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
};
export const config = { path: "/*" };
