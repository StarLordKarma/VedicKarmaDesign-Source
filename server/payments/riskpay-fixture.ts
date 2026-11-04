import { createHash } from "node:crypto";
import { createRiskPayApi } from "./riskpay-api";
/** Deterministic offline transport using the actual documented wallet response.
 * Never calls RiskPay, creates external wallets, or broadcasts transactions.
 */
export function riskPayFixture(sessionId: string) {
  const assigned =
    "0x" +
    createHash("sha256")
      .update("riskpay-fixture:" + sessionId)
      .digest("hex")
      .slice(0, 40);
  const fetcher: typeof fetch = async request => {
    const url = new URL(String(request));
    if (
      url.origin !== "https://api.riskpay.biz" ||
      url.pathname !== "/control/wallet.php"
    )
      throw Error("Unexpected RiskPay fixture request");
    return new Response(
      JSON.stringify({
        address_in: encodeURIComponent("fixture/encrypted+" + sessionId),
        polygon_address_in: assigned,
        callback_url: url.searchParams.get("callback"),
        ipn_token: encodeURIComponent("fixture-ipn/" + sessionId),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  return createRiskPayApi({ mode: "fixture", fetcher });
}
