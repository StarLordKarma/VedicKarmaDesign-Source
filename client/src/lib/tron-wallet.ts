import { Buffer } from "buffer";
// Lazy-loaded only after an explicit TRON connection click.
import { MetaMaskAdapter } from "@metamask/connect-tron";
if (!(globalThis as any).Buffer) (globalThis as any).Buffer = Buffer;
let adapter: MetaMaskAdapter | undefined;
export async function connectTronWallet() {
  adapter ??= new MetaMaskAdapter();
  if (!adapter.connected) await adapter.connect();
  await adapter.switchChain("0x2b6653dc");
  if (!adapter.address) throw new Error("TRON wallet unavailable");
  return { address: adapter.address, adapter };
}
export async function signTronPayment(
  transaction: any,
  expectedAddress: string
) {
  if (!adapter?.connected || adapter.address !== expectedAddress)
    throw new Error("Wallet account changed; reconnect");
  await adapter.switchChain("0x2b6653dc");
  if (adapter.address !== expectedAddress)
    throw new Error("Wallet account changed");
  return adapter.signTransaction(transaction);
}

export async function signTronMessage(
  message: string,
  expectedAddress: string
) {
  if (!adapter?.connected || adapter.address !== expectedAddress)
    throw new Error("Wallet changed");
  return adapter.signMessage(message);
}
