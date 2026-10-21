import {
  PAYMENT_NETWORKS,
  type PaymentNetworkId,
} from "../../shared/payment-networks";
export function paymentRpcUrl(network: PaymentNetworkId) {
  return {
    avalanche: process.env.DIRECT_RPC_URL,
    ethereum: process.env.DIRECT_ETHEREUM_RPC_URL,
    polygon: process.env.DIRECT_POLYGON_RPC_URL,
    bnb: process.env.DIRECT_BNB_RPC_URL,
  }[network];
}
export function configuredPaymentNetworks(): PaymentNetworkId[] {
  return (Object.keys(PAYMENT_NETWORKS) as PaymentNetworkId[]).filter(n =>
    paymentRpcUrl(n)?.startsWith("https://")
  );
}
