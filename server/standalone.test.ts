import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), sign: vi.fn() }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = mocks.send; },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class { constructor(public input: unknown) {} },
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.sign }));
import { storagePut, storageGetSignedUrl } from "./storage";
import { notifyOwner } from "./_core/notification";
import { assertOwnerClaims } from "./_core/oidc";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("independent providers", () => {
  it("stores private PDFs in S3 and issues five-minute download URLs", async () => {
    vi.stubEnv("STORAGE_PROVIDER", "s3"); vi.stubEnv("S3_BUCKET", "test-private");
    mocks.send.mockResolvedValue({}); mocks.sign.mockResolvedValue("https://storage.example.test/signed");
    const result = await storagePut("reports/test.pdf", Buffer.from("%PDF"), "application/pdf");
    expect(result.key).toMatch(/^reports\/test_[a-f0-9]+\.pdf$/);
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({ Bucket: "test-private", ContentType: "application/pdf", CacheControl: "private, no-store" });
    await storageGetSignedUrl(result.key);
    expect(mocks.sign.mock.calls[0][2]).toEqual({ expiresIn: 300 });
    await expect(storageGetSignedUrl("../private.pdf")).rejects.toThrow("Invalid storage key");
  });
  it("sends owner notifications without the Manus service", async () => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "resend");
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetch);
    expect(await notifyOwner({ title: "Booking received", content: "Review booking #7 in the dashboard." })).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe("https://api.resend.com/emails");
    expect(JSON.parse(fetch.mock.calls[0][1].body).text).toContain("#7");
  });
  it("rejects a non-owner, wrong nonce, or conflicting authorized party", () => {
    const claims = { sub: "owner", nonce: "nonce", aud: "client", exp: 9999999999, iat: 1 };
    expect(() => assertOwnerClaims(claims, "client", "nonce", "owner")).not.toThrow();
    for (const patch of [{ sub: "other" }, { nonce: "other" }, { azp: "other" }, { aud: ["client", "other"] }]) {
      expect(() => assertOwnerClaims({ ...claims, ...patch }, "client", "nonce", "owner")).toThrow();
    }
  });
});
