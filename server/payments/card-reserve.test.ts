import { expect, it } from "vitest";
import { summarizeCardFunds, CARD_RESERVE_HOLD_MS } from "./card-reserve";
const now = 1800000000000;
const receipt = {
  bookingId: 1,
  receivedMicroUsdc: "4166650",
  refundedMicroUsdc: "0",
  committedRefundMicroUsdc: "0",
  receivedAt: now,
};
it("reserves the full net receipt for exactly 14 days", () => {
  expect(summarizeCardFunds([receipt], now)).toMatchObject({
    receivedMicroUsdc: "4166650",
    unallocatedMicroUsdc: "4166650",
    distributableMicroUsdc: "0",
    policy: "per_order_net_14_days",
    reservedMicroUsdc: "4166650",
    holdDays: 14,
  });
  expect(
    summarizeCardFunds([receipt], now + CARD_RESERVE_HOLD_MS - 1)
      .distributableMicroUsdc
  ).toBe("0");
  expect(
    summarizeCardFunds([receipt], now + CARD_RESERVE_HOLD_MS)
      .distributableMicroUsdc
  ).toBe("4166650");
});
it("uses released receipts to cover refund shortfalls without consuming another active order's reserve", () => {
  const pending = { ...receipt, committedRefundMicroUsdc: "4990000" };
  expect(summarizeCardFunds([pending], now).shortfallMicroUsdc).toBe("823350");
  expect(
    summarizeCardFunds(
      [
        pending,
        { ...receipt, bookingId: 2, receivedAt: now - CARD_RESERVE_HOLD_MS },
      ],
      now
    ).shortfallMicroUsdc
  ).toBe("0");
  expect(
    summarizeCardFunds([pending, { ...receipt, bookingId: 2 }], now)
      .shortfallMicroUsdc
  ).toBe("823350");
});
it("deducts a confirmed refund once; requesting one only commits funds", () => {
  expect(
    summarizeCardFunds(
      [{ ...receipt, committedRefundMicroUsdc: "3982000" }],
      now
    ).unallocatedMicroUsdc
  ).toBe("4166650");
  expect(
    summarizeCardFunds([{ ...receipt, refundedMicroUsdc: "3982000" }], now)
      .unallocatedMicroUsdc
  ).toBe("184650");
  expect(() => summarizeCardFunds([receipt, receipt])).toThrow(
    /unique booking/
  );
});
it.each([true, false])(
  "keeps open refunds and disputed orders held after day 14: hold=%s",
  hold => {
    const row = {
      ...receipt,
      hold,
      committedRefundMicroUsdc: hold ? "0" : "3982000",
    };
    expect(
      summarizeCardFunds([row], now + CARD_RESERVE_HOLD_MS)
        .distributableMicroUsdc
    ).toBe("0");
  }
);
it("does not invent dates for legacy receipts or prematurely release future-dated receipts", () => {
  for (const receivedAt of [undefined, NaN, 0, now + 1]) {
    expect(summarizeCardFunds([{ ...receipt, receivedAt }], now)).toMatchObject(
      { undatedReceiptCount: 1, distributableMicroUsdc: "0" }
    );
  }
});
it("releases only the remaining net after a refund and treats each order separately", () => {
  const after = now + CARD_RESERVE_HOLD_MS;
  const result = summarizeCardFunds(
    [
      { ...receipt, refundedMicroUsdc: "3982000" },
      { ...receipt, bookingId: 2, receivedAt: after },
    ],
    after
  );
  expect(result).toMatchObject({
    reservedMicroUsdc: "4166650",
    distributableMicroUsdc: "184650",
  });
});
it("shows a shortfall instead of negative spendable funds after an uncovered refund", () => {
  expect(
    summarizeCardFunds([{ ...receipt, refundedMicroUsdc: "4990000" }])
  ).toMatchObject({ unallocatedMicroUsdc: "0", shortfallMicroUsdc: "823350" });
  expect(() =>
    summarizeCardFunds([{ ...receipt, receivedMicroUsdc: "4.99" }])
  ).toThrow(/Invalid reserve/);
});
