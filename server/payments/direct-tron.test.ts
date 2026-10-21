import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TronWeb } from "tronweb";
import {
  verifyTronTransfer,
  tronTransferData,
  tronAddressHex,
  estimateTronPayment,
} from "./direct-tron";
import { TRON_PAYMENT } from "../../shared/tron-payment";
import type { Intent } from "./direct";
const payer = "TLjWhpJwVAmYYv55CVYDVppenstMXvX3si";
const raw = "abcd",
  hash = createHash("sha256").update(Buffer.from(raw, "hex")).digest("hex");
const intent: Intent = {
  bookingId: 1,
  id: "ef".repeat(32),
  recipient: `0x${"12".repeat(20)}`,
  amount: "25.00",
  units: "25000000",
  startBlock: "0x1",
  deadline: 2000,
  tron: { recipient: payer, startBlock: 10 },
};
let tx: any, info: any, block: any, genesis: string;
beforeEach(() => {
  vi.stubEnv("DIRECT_TRON_API_URL", "https://tron.example.test");
  genesis = "00".repeat(28) + "2b6653dc";
  tx = {
    txID: hash,
    raw_data_hex: raw,
    ret: [{ contractRet: "SUCCESS" }],
    raw_data: {
      contract: [
        {
          type: "TriggerSmartContract",
          parameter: {
            value: {
              owner_address: tronAddressHex(payer),
              contract_address: tronAddressHex(TRON_PAYMENT.token),
              data: tronTransferData(intent),
            },
          },
        },
      ],
    },
  };
  info = {
    id: hash,
    blockNumber: 11,
    receipt: { result: "SUCCESS" },
    log: [
      {
        address: tronAddressHex(TRON_PAYMENT.token).slice(2),
        topics: [
          "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          tronAddressHex(payer).slice(2).padStart(64, "0"),
          tronAddressHex(payer).slice(2).padStart(64, "0"),
        ],
        data: BigInt(intent.units).toString(16),
      },
    ],
  };
  block = {
    transactions: [{ txID: hash }],
    block_header: { raw_data: { number: 11, timestamp: 1900000 } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async url => {
      const path = new URL(String(url)).pathname;
      const value =
        path === "/wallet/getblockbynum"
          ? { blockID: genesis }
          : path === "/walletsolidity/gettransactionbyid"
            ? tx
            : path === "/walletsolidity/gettransactioninfobyid"
              ? info
              : block;
      return new Response(JSON.stringify(value));
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("USDT TRC-20 solidified-chain verification", () => {
  it("accepts an exact confirmed transfer from the bound payer", async () => {
    await expect(verifyTronTransfer(intent, hash, payer)).resolves.toBe(true);
  });
  it("does not accept an unconfirmed transfer", async () => {
    info = {};
    await expect(verifyTronTransfer(intent, hash, payer)).resolves.toBe(false);
  });
  it("rejects a testnet node", async () => {
    genesis = "00".repeat(28) + "94a9059e";
    await expect(verifyTronTransfer(intent, hash, payer)).rejects.toThrow(
      "Mainnet"
    );
  });
  it("rejects another order's calldata", async () => {
    tx.raw_data.contract[0].parameter.value.data += "00";
    await expect(verifyTronTransfer(intent, hash, payer)).rejects.toThrow(
      "does not match"
    );
  });
  it("rejects underpayment even with a successful receipt", async () => {
    info.log[0].data = "1";
    await expect(verifyTronTransfer(intent, hash, payer)).rejects.toThrow(
      "not received"
    );
  });
  it("rejects a fake token contract", async () => {
    info.log[0].address = "12".repeat(20);
    await expect(verifyTronTransfer(intent, hash, payer)).rejects.toThrow(
      "not received"
    );
  });
  it("rejects a transaction that is absent from the solidified block", async () => {
    block.transactions = [];
    await expect(verifyTronTransfer(intent, hash, payer)).rejects.toThrow(
      "confirmed block"
    );
  });
  it("keeps late payments for owner review", async () => {
    block.block_header.raw_data.timestamp = 2100000;
    await expect(verifyTronTransfer(intent, hash, payer)).rejects.toThrow(
      "Late"
    );
  });
  it("rejects a different payer", async () => {
    await expect(
      verifyTronTransfer(intent, hash, TRON_PAYMENT.token)
    ).rejects.toThrow("payer");
  });
  it("validates the owner's actual base58 checksum", () => {
    expect(TronWeb.isAddress(payer)).toBe(true);
    expect(() => tronAddressHex(payer.slice(0, -1) + "x")).toThrow();
  });
});
