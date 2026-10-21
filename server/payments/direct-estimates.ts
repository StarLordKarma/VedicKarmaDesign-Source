import { usdExchangeRates } from "./direct-rates";
import {
  PAYMENT_NETWORKS,
  formatTokenUnits,
  type NetworkEstimate,
  type PaymentNetworkId,
} from "../../shared/payment-networks";
import {
  intentOptions,
  rpc,
  selectIntentNetwork,
  transferData,
  type Intent,
} from "./direct";

export async function nativeUsdPrices(): Promise<Record<string, number>> {
  try {
    const data = await usdExchangeRates();
    return Object.fromEntries(
      ["ETH", "AVAX", "POL", "BNB", "TRX"]
        .filter(s => data[s])
        .map(s => [s, 1 / data[s]])
    );
  } catch {
    return {};
  }
}
export async function estimatePaymentNetworks(
  intent: Intent,
  address: string,
  onlyNetwork?: PaymentNetworkId
): Promise<NetworkEstimate[]> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address))
    throw new Error("Invalid wallet address");
  const prices = await nativeUsdPrices();
  return Promise.all(
    intentOptions(intent)
      .filter(o => !onlyNetwork || o.network === onlyNetwork)
      .map(async option => {
        const network = option.network,
          config = PAYMENT_NETWORKS[network];
        const selected = selectIntentNetwork(intent, network);
        const quotedAt = Date.now();
        const call = (method: string, params: unknown[] = []) =>
          rpc(method, params, network);
        try {
          if ((await call("eth_chainId")) !== config.chainId)
            throw new Error("Wrong RPC network");
          const [balanceHex, tokenHex] = await Promise.all([
            call("eth_getBalance", [address, "latest"]),
            call("eth_call", [
              {
                to: config.token,
                data: `0x70a08231${address.slice(2).toLowerCase().padStart(64, "0")}`,
              },
              "latest",
            ]),
          ]);
          const nativeBalance = formatTokenUnits(BigInt(balanceHex).toString());
          const tokenBalance = formatTokenUnits(
            BigInt(tokenHex).toString(),
            config.decimals
          );
          const base = { network, nativeBalance, tokenBalance, quotedAt };
          if (BigInt(tokenHex) < BigInt(selected.units))
            return { ...base, status: "insufficient_usdt" as const };
          const tx = {
            from: address,
            to: config.token,
            value: "0x0",
            data: transferData(selected),
          };
          const [estimateHex, gasPriceHex, latest] = await Promise.all([
            call("eth_estimateGas", [tx]),
            call("eth_gasPrice"),
            call("eth_getBlockByNumber", ["latest", false]),
          ]);
          const estimate = BigInt(estimateHex),
            gasPrice = BigInt(gasPriceHex);
          if (estimate <= BigInt(0) || gasPrice <= BigInt(0))
            throw new Error("Invalid fee estimate");
          const limit = (estimate * BigInt(120) + BigInt(99)) / BigInt(100);
          const conservativeGasPrice = latest?.baseFeePerGas
            ? BigInt(latest.baseFeePerGas) * BigInt(2) + gasPrice
            : gasPrice * BigInt(2);
          const fee = estimate * gasPrice,
            budget = limit * conservativeGasPrice;
          const estimatedNative = formatTokenUnits(fee.toString());
          const usdPrice = prices[config.nativeSymbol];
          const estimatedUsd =
            usdPrice && Number.isFinite(Number(estimatedNative) * usdPrice)
              ? Number(estimatedNative) * usdPrice
              : undefined;
          return {
            ...base,
            status:
              BigInt(balanceHex) >= budget
                ? ("ready" as const)
                : ("insufficient_gas" as const),
            estimatedNative,
            budgetNative: formatTokenUnits(budget.toString()),
            estimatedUsd,
            gasLimit: `0x${limit.toString(16)}`,
            gasPrice: gasPriceHex,
          };
        } catch {
          return { network, status: "unavailable" as const, quotedAt };
        }
      })
  );
}
