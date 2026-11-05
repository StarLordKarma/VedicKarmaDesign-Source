import { describe, it, expect } from "vitest";
import {
  chooseDelaySeconds,
  deliveryDueAt,
  deliveryGate,
  orderArea,
  orderLocale,
  recommendProducts,
  type Lifecycle,
} from "../shared/order-lifecycle";
const pdf = {
  versionId: 7,
  sha256: "a".repeat(64),
  recipient: "synthetic@sandbox.invalid",
};
const state = (): Lifecycle => ({
  schemaVersion: 1,
  locale: "ru",
  area: "vedic",
  delaySeconds: 1200,
  acceptedAt: 1000,
  acknowledgement: "accepted",
  acknowledgementAcceptedAt: 2000,
  preparation: "ready",
  mode: "manual",
  authorizedPdf: pdf,
  finalMail: "pending",
  held: false,
});
describe("persisted order lifecycle", () => {
  it.each([
    ["tarot", 900, 1200],
    ["western", 900, 1800],
    ["vedic", 1200, 2400],
  ] as const)("keeps %s delay inside inclusive bounds", (area, min, max) => {
    expect(chooseDelaySeconds(area, () => 0)).toBe(min);
    expect(chooseDelaySeconds(area, () => 1 - Number.EPSILON)).toBe(max);
  });
  it.each([NaN, -1, 1, Infinity])("rejects invalid randomness %s", n =>
    expect(() => chooseDelaySeconds("tarot", () => n)).toThrow()
  );
  it("restarts preserve the same deadline and the exact boundary", () => {
    const s = state();
    const due = deliveryDueAt(s)!;
    expect(deliveryDueAt(JSON.parse(JSON.stringify(s)))).toBe(due);
    expect(deliveryGate(s, pdf, due - 1)).toBe("scheduled");
    expect(deliveryGate(s, pdf, due)).toBe("due");
  });
  it("starts from acknowledgement acceptance, not payment", () => {
    const s = state();
    s.acknowledgementAcceptedAt = 600000;
    expect(deliveryDueAt(s)).toBe(1800000);
  });
  it("cannot release while acknowledgement is retrying", () => {
    const s = state();
    s.acknowledgement = "retry";
    expect(deliveryGate(s, pdf, 9e9)).toBe("awaiting_acknowledgement");
  });
  it("never replaces manual authorization with elapsed time", () => {
    const s = state();
    s.authorizedPdf = null;
    expect(deliveryGate(s, pdf, 9e9)).toBe("awaiting_approval");
  });
  it.each(["manual", "automatic"] as const)(
    "applies the same guards in %s mode",
    mode => {
      const s = state();
      s.mode = mode;
      s.held = true;
      expect(deliveryGate(s, pdf, 9e9)).toBe("held");
      s.held = false;
      s.preparation = "failed";
      expect(deliveryGate(s, pdf, 9e9)).toBe("preparing");
    }
  );
  it.each([
    { ...pdf, recipient: "other@sandbox.invalid" },
    { ...pdf, versionId: 8 },
    { ...pdf, sha256: "b".repeat(64) },
  ])("blocks a changed delivery snapshot", p =>
    expect(deliveryGate(state(), p, 9e9)).toBe("snapshot_changed")
  );
  it.each(["accepted", "delivered", "sending", "failed", "reconcile"] as const)(
    "does not duplicate final %s state",
    finalMail => {
      const s = state();
      s.finalMail = finalMail;
      expect(deliveryGate(s, pdf, 9e9)).not.toBe("due");
    }
  );
  it("rejects corrupted persisted timing", () => {
    const s = state();
    s.delaySeconds = 1;
    expect(() => deliveryDueAt(s)).toThrow();
    s.delaySeconds = 1200;
    s.acknowledgementAcceptedAt = 0;
    expect(() => deliveryDueAt(s)).toThrow();
  });
  it("does not send promotions after opt out", () =>
    expect(
      recommendProducts({
        current: "tarot",
        verifiedPurchased: [],
        available: ["portrait"],
        promotionsAllowed: false,
      })
    ).toEqual([]));
  it("excludes purchased and unavailable services", () =>
    expect(
      recommendProducts({
        current: "tarot",
        verifiedPurchased: ["portrait", "daily"],
        available: ["portrait", "daily", "vedic_basic", "monthly"],
        promotionsAllowed: true,
      })
    ).toEqual(["vedic_basic", "monthly"]));
  it("has no recommendations when nothing remains", () =>
    expect(
      recommendProducts({
        current: "tarot",
        verifiedPurchased: ["portrait"],
        available: ["tarot", "portrait"],
        promotionsAllowed: true,
      })
    ).toEqual([]));
  it("recognizes all supported products and fails closed otherwise", () => {
    for (const p of ["basic", "basic_plus", "vedic_basic", "vedic_plus"])
      expect(orderArea(p)).toBe("vedic");
    for (const p of ["portrait", "daily", "monthly"])
      expect(orderArea(p)).toBe("western");
    expect(() => orderArea("unknown")).toThrow();
  });
  it("freezes explicit supported locale without silent fallback", () => {
    expect(orderLocale("Русский")).toBe("ru");
    expect(orderLocale("de")).toBe("de");
    expect(() => orderLocale("unknown")).toThrow();
  });
});
