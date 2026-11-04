// Integer USDC units; a real quote must supply the gross fiat equivalent.
export function manualCardRefundQuote(input: {
  grossMicroUsdc: string;
  networkMicroUsdc: string;
  basis: "voluntary" | "mandatory";
}) {
  for (const v of [input.grossMicroUsdc, input.networkMicroUsdc])
    if (!/^(0|[1-9]\d{0,17})$/.test(v)) throw Error("Invalid USDC amount");
  const gross = BigInt(input.grossMicroUsdc);
  if (gross <= BigInt(0)) throw Error("Refund amount must be positive");
  const site =
    input.basis === "voluntary"
      ? (gross * BigInt(20) + BigInt(99)) / BigInt(100)
      : BigInt(0);
  const network =
    input.basis === "voluntary" ? BigInt(input.networkMicroUsdc) : BigInt(0);
  const net = gross - site - network;
  if (net <= BigInt(0)) throw Error("Fees leave no refundable amount");
  return {
    grossMicroUsdc: gross.toString(),
    siteMicroUsdc: site.toString(),
    networkMicroUsdc: network.toString(),
    netMicroUsdc: net.toString(),
    basis: input.basis,
  };
}
