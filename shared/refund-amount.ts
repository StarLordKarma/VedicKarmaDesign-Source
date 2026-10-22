import { parseUnits, formatUnits } from "ethers";
import { PAYMENT_NETWORKS, type CheckoutNetworkId } from "./payment-networks";
/** Fees are disclosed and frozen in the refunded token; native gas is still paid by the sender. */
export function refundAmount(gross: string, fee: string, network: CheckoutNetworkId) {
  const decimals = network === "tron" ? 6 : PAYMENT_NETWORKS[network].decimals;
  if (!/^\d+(\.\d+)?$/.test(fee) || fee.length > 40) throw new Error("Invalid refund transfer fee");
  const grossUnits = parseUnits(gross, decimals), feeUnits = parseUnits(fee, decimals);
  if (feeUnits < BigInt(0) || feeUnits >= grossUnits) throw new Error("Refund fee must be below the received amount");
  return { grossAmount: formatUnits(grossUnits, decimals), feeAmount: formatUnits(feeUnits, decimals), amount: formatUnits(grossUnits - feeUnits, decimals), units: String(grossUnits - feeUnits) };
}
