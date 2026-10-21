import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  readIntent: vi.fn(),
  booking: vi.fn(),
  verify: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("./payments/direct", async importOriginal => ({
  ...(await importOriginal<typeof import("./payments/direct")>()),
  LatePaymentError: class LatePaymentError extends Error {},
  readIntent: mocks.readIntent,
  verifyTransfer: mocks.verify,
  transferData: () => "0xdata",
  DIRECT_CHAIN: "0xa86a",
  DIRECT_TOKEN: "0xtoken",
  TRANSFER_TOPIC: "topic",
  rpc: vi.fn(),
}));
vi.mock("./db", () => ({
  getBookingRequestById: mocks.booking,
  getDb: vi.fn(),
}));
vi.mock("./payment-notification", () => ({
  processPaymentNotification: mocks.notify,
}));
import { registerDirectPaymentRoutes } from "./direct-payment-routes";
const handlers = new Map<string, any>();
const app = {
  get: (p: string, h: any) => handlers.set(`GET ${p}`, h),
  post: (p: string, h: any) => handlers.set(`POST ${p}`, h),
  use: vi.fn(),
};
function response() {
  const res: any = { setHeader: vi.fn(), json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  registerDirectPaymentRoutes(app as any);
  mocks.readIntent.mockResolvedValue({
    bookingId: 42,
    amount: "25",
    recipient: `0x${"12".repeat(20)}`,
    units: "25000000",
    startBlock: "0x10",
    id: "ab".repeat(32),
  });
  mocks.booking.mockResolvedValue({
    id: 42,
    paymentUrl: "https://site.test/pay/token",
    paymentStatus: "waiting",
    language: "Русский",
  });
});
describe("wallet payment API", () => {
  it("never exposes personal birth data in a payment quote", async () => {
    const res = response();
    await handlers.get("GET /api/direct-payment/:token")(
      { params: { token: "token" } },
      res
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "25", paid: false })
    );
    expect(res.json.mock.calls[0][0]).not.toHaveProperty("bookingId");
  });
  it("rejects a signed link that is not the persisted invoice", async () => {
    const res = response();
    await handlers.get("GET /api/direct-payment/:token")(
      { params: { token: "other" } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it("cannot mark a pending transaction as paid", async () => {
    mocks.verify.mockResolvedValue(false);
    const res = response();
    await handlers.get("POST /api/direct-payment/:token")(
      { params: { token: "token" }, body: { hash: `0x${"ab".repeat(32)}` } },
      res
    );
    expect(res.json).toHaveBeenCalledWith({ paid: false });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("only accepts independently verified transactions", async () => {
    mocks.verify.mockResolvedValue(true);
    const res = response();
    const hash = `0x${"ab".repeat(32)}`;
    await handlers.get("POST /api/direct-payment/:token")(
      { params: { token: "token" }, body: { hash } },
      res
    );
    expect(mocks.notify).toHaveBeenCalledWith({
      bookingId: 42,
      paymentId: `0xa86a:${hash}`,
      paymentStatus: "confirmed",
    });
    expect(res.json).toHaveBeenCalledWith({ paid: true });
  });
  it("rejects malformed candidate hashes", async () => {
    const res = response();
    await handlers.get("POST /api/direct-payment/:token")(
      { params: { token: "token" }, body: { hash: "bad" } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
