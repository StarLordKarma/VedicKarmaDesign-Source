import { DEFAULT_DIRECT_WALLET } from "../../shared/direct-wallet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIRECT_CHAIN,
  DIRECT_TOKEN,
  TRANSFER_TOPIC,
  directPaymentProvider,
  readIntent,
  transferData,
  verifyTransfer,
  type Intent,
} from "./direct";
const recipient = `0x${"12".repeat(20)}`;
const sender = `0x${"34".repeat(20)}`;
const hash = `0x${"ab".repeat(32)}`;
const intent: Intent = {
  bookingId: 42,
  id: "cd".repeat(32),
  recipient,
  units: "25000000",
  amount: "25.00",
  startBlock: "0x10",
  deadline: 2000,
};
let receipt: any, tx: any, block: any, finalized: any, chain: string;
beforeEach(() => {
  vi.stubEnv("JWT_SECRET", "secret-".repeat(8));
  vi.stubEnv("DIRECT_RPC_URL", "https://rpc.example.test");
  vi.stubEnv("DIRECT_WALLET_ADDRESS", recipient);
  chain = DIRECT_CHAIN;
  tx = {
    to: DIRECT_TOKEN,
    from: sender,
    input: transferData(intent),
    value: "0x0",
  };
  receipt = {
    status: "0x1",
    blockNumber: "0x11",
    blockHash: "block-a",
    logs: [
      {
        address: DIRECT_TOKEN,
        topics: [
          TRANSFER_TOPIC,
          `0x${sender.slice(2).padStart(64, "0")}`,
          `0x${recipient.slice(2).padStart(64, "0")}`,
        ],
        data: `0x${BigInt(intent.units).toString(16)}`,
      },
    ],
  };
  block = { number: "0x11", hash: "block-a", timestamp: "0x700" };
  finalized = { number: "0x12" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      const { method, params } = JSON.parse(init.body);
      const result =
        method === "eth_chainId"
          ? chain
          : method === "eth_blockNumber"
            ? "0x10"
            : method === "eth_getTransactionReceipt"
              ? receipt
              : method === "eth_getTransactionByHash"
                ? tx
                : params[0] === "finalized"
                  ? finalized
                  : block;
      return new Response(JSON.stringify({ result }), { status: 200 });
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("direct USDT checkout", () => {
  it("signs a frozen quote without birth data and verifies its signature", async () => {
    const invoice = await directPaymentProvider.createPayment({
      priceAmount: 25,
      priceCurrency: "USD",
      orderId: "booking-42",
      orderDescription: "reading",
      callbackUrl: "https://site.test/callback",
      successUrl: "https://site.test/",
      cancelUrl: "https://site.test/",
    });
    const token = invoice.invoice_url.split("/pay/")[1];
    const quote = await readIntent(token);
    expect(quote.units).toBe("25000000");
    expect(quote.bookingId).toBe(42);
    expect(quote.recipient).toBe(recipient);
    await expect(readIntent(token.slice(0, -5) + "xxxxx")).rejects.toThrow();
  });
  it("uses the owner's supplied public address when no override is set", async () => {
    vi.stubEnv("DIRECT_WALLET_ADDRESS", "");
    const invoice = await directPaymentProvider.createPayment({
      priceAmount: 25,
      priceCurrency: "USD",
      orderId: "booking-42",
      orderDescription: "",
      callbackUrl: "",
      successUrl: "https://site.test/",
      cancelUrl: "",
    });
    const quote = await readIntent(invoice.invoice_url.split("/pay/")[1]);
    expect(quote.recipient).toBe(DEFAULT_DIRECT_WALLET);
    expect(transferData(quote)).toContain(
      DEFAULT_DIRECT_WALLET.slice(2).toLowerCase()
    );
  });
  it("rejects unconfigured fiat conversion rather than treating euros as dollars", async () => {
    vi.stubEnv("DIRECT_EUR_USDT_RATE", "invalid");
    await expect(
      directPaymentProvider.createPayment({
        priceAmount: 25,
        priceCurrency: "EUR",
        orderId: "booking-42",
        orderDescription: "",
        callbackUrl: "",
        successUrl: "https://site.test/",
        cancelUrl: "",
      })
    ).rejects.toThrow("exchange rate");
  });
  it("accepts only a successful finalized exact transfer", async () => {
    await expect(verifyTransfer(intent, hash)).resolves.toBe(true);
  });
  it("waits for a pending receipt", async () => {
    receipt = null;
    await expect(verifyTransfer(intent, hash)).resolves.toBe(false);
  });
  it("waits for finality", async () => {
    finalized.number = "0x10";
    await expect(verifyTransfer(intent, hash)).resolves.toBe(false);
  });
  it("rejects a transaction for another order with the same amount", async () => {
    tx.input = transferData({ ...intent, id: "ef".repeat(32) });
    await expect(verifyTransfer(intent, hash)).rejects.toThrow(
      "does not match"
    );
  });
  it("rejects a reverted transfer", async () => {
    receipt.status = "0x0";
    await expect(verifyTransfer(intent, hash)).rejects.toThrow("failed");
  });
  it("rejects another network", async () => {
    chain = "0x1";
    await expect(verifyTransfer(intent, hash)).rejects.toThrow("Wrong");
  });
  it("rejects a fake token", async () => {
    receipt.logs[0].address = recipient;
    await expect(verifyTransfer(intent, hash)).rejects.toThrow("not received");
  });
  it("rejects underpayment", async () => {
    receipt.logs[0].data = "0x1";
    await expect(verifyTransfer(intent, hash)).rejects.toThrow("not received");
  });
  it("rejects a different recipient", async () => {
    receipt.logs[0].topics[2] = `0x${sender.slice(2).padStart(64, "0")}`;
    await expect(verifyTransfer(intent, hash)).rejects.toThrow("not received");
  });
  it("rejects a late mined payment", async () => {
    block.timestamp = "0x900";
    await expect(verifyTransfer(intent, hash)).rejects.toThrow("outside");
  });
  it("rejects a reorganized block", async () => {
    block.hash = "block-b";
    await expect(verifyTransfer(intent, hash)).rejects.toThrow("outside");
  });
  it("rejects malformed hashes before calling RPC", async () => {
    await expect(verifyTransfer(intent, "bad")).rejects.toThrow("hash");
    expect(fetch).not.toHaveBeenCalled();
  });
});

it('does not accept an event removed by a reorg',async()=>{receipt.logs[0].removed=true;await expect(verifyTransfer(intent,hash)).rejects.toThrow('not received')});
it('rechecks canonical block hash after observing finality',async()=>{
 const f=vi.mocked(fetch),original=f.getMockImplementation()!;let blocks=0;
 f.mockImplementation(async(url,init)=>{const q=JSON.parse(String(init!.body));if(q.method==='eth_getBlockByNumber'&&q.params[0]!=='finalized'&&++blocks>1)return Response.json({result:{...block,hash:'replacement'}});return original(url,init)});
 expect(await verifyTransfer(intent,hash)).toBe(false);
});
