export const PAYMENT_NETWORKS = {
  avalanche: {
    id: "avalanche",
    chainId: "0xa86a",
    name: "Avalanche C-Chain",
    nativeSymbol: "AVAX",
    tokenSymbol: "USDT",
    token: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
    decimals: 6,
    walletRpc: "https://api.avax.network/ext/bc/C/rpc",
    explorer: "https://snowtrace.io",
  },
  polygon: {
    id: "polygon",
    chainId: "0x89",
    name: "Polygon",
    nativeSymbol: "POL",
    tokenSymbol: "USDT0",
    token: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
    decimals: 6,
    walletRpc: "https://polygon.drpc.org",
    explorer: "https://polygonscan.com",
  },
  bnb: {
    id: "bnb",
    chainId: "0x38",
    name: "BNB Chain",
    nativeSymbol: "BNB",
    tokenSymbol: "Binance-Peg USDT",
    token: "0x55d398326f99059ff775485246999027b3197955",
    decimals: 18,
    walletRpc: "https://bsc-dataseed.bnbchain.org",
    explorer: "https://bscscan.com",
  },
  ethereum: {
    id: "ethereum",
    chainId: "0x1",
    name: "Ethereum",
    nativeSymbol: "ETH",
    tokenSymbol: "USDT",
    token: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    decimals: 6,
    walletRpc: "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io",
  },
} as const;
export type PaymentNetworkId = keyof typeof PAYMENT_NETWORKS;
export type CheckoutNetworkId = PaymentNetworkId | "tron";
export function isPaymentNetwork(value: unknown): value is PaymentNetworkId {
  return typeof value === "string" && Object.hasOwn(PAYMENT_NETWORKS, value);
}
export type NetworkEstimate = {
  network: CheckoutNetworkId;
  status: "ready" | "insufficient_usdt" | "insufficient_gas" | "unavailable";
  nativeBalance?: string;
  tokenBalance?: string;
  gasLimit?: string;
  gasPrice?: string;
  estimatedNative?: string;
  budgetNative?: string;
  estimatedUsd?: number;
  quotedAt: number;
  feeLimit?: number;
};
// Only compare networks where this wallet can already pay. Never assume a bridge is free.
export function recommendPaymentNetwork(
  estimates: NetworkEstimate[]
): CheckoutNetworkId | null {
  const ready = estimates.filter(e => e.status === "ready");
  if (
    !ready.length ||
    ready.some(
      e =>
        e.estimatedUsd === undefined ||
        !Number.isFinite(e.estimatedUsd) ||
        e.estimatedUsd <= 0
    )
  )
    return null;
  return ready.reduce((best, e) =>
    e.estimatedUsd! < best.estimatedUsd! ? e : best
  ).network;
}
export function formatTokenUnits(units: string, decimals = 18) {
  const n = BigInt(units),
    base = BigInt("1" + "0".repeat(decimals));
  return (
    `${n / base}.${(n % base).toString().padStart(decimals, "0")}`.replace(
      /\.?0+$/,
      ""
    ) || "0"
  );
}
