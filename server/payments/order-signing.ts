/** Invoice signatures are isolated from owner-login cookies. Keep the configured
 * key stable across deployments: outstanding invoices remain valid for recovery. */
export function orderSigningKey(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.ORDER_SIGNING_SECRET || env.JWT_SECRET;
  if (
    !secret ||
    secret.length < 32 ||
    /replace-with|example-secret/i.test(secret)
  )
    throw new Error("Order signing requires a strong ORDER_SIGNING_SECRET");
  return new TextEncoder().encode(secret);
}
