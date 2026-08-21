export const CHECKOUT_REDIRECT_DELAY_MS = 1800;

export function getCheckoutButtonLabel(isPending: boolean) {
  return isPending ? "Creating your secure checkout…" : "Request my reading";
}

export function getCheckoutSuccessMessage(totalUsd: number) {
  return `Your request is saved. Continue to the secure crypto checkout to complete the $${totalUsd} payment.`;
}
