import { directPaymentProvider } from "./direct";
import { nowPaymentsProvider } from "./nowpayments-provider";
import { heleketProvider } from "./heleket-provider";
import { payCryptoProvider } from "./paycrypto-provider";
import { resolvePaymentProviderId, type PaymentProvider } from "./provider";

const providers = {
  direct: directPaymentProvider,
  nowpayments: nowPaymentsProvider,
  heleket: heleketProvider,
  paycrypto: payCryptoProvider,
} satisfies Record<string, PaymentProvider>;

export function getPaymentProvider(
  env: NodeJS.ProcessEnv = process.env
): PaymentProvider {
  return providers[resolvePaymentProviderId(env)];
}

export type {
  CreatePaymentInput,
  HostedPayment,
  NormalizedPaymentStatus,
  PaymentProvider,
  PaymentProviderId,
} from "./provider";
