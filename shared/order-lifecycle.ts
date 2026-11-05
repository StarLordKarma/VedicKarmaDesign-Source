/** Pure contract shared by workers and owner views. No browser-controlled timestamps. */
export type OrderArea = "tarot" | "western" | "vedic";
export type OrderLocale = "en" | "ru" | "es" | "de";
export const DELIVERY_MINUTES = {
  tarot: [15, 20],
  western: [15, 30],
  vedic: [20, 40],
} as const;
export function orderArea(product: string): OrderArea {
  if (product === "tarot") return "tarot";
  if (["vedic_basic", "vedic_plus", "basic", "basic_plus"].includes(product))
    return "vedic";
  if (["portrait", "daily", "monthly"].includes(product)) return "western";
  throw Error("Unknown product; delivery timing requires review");
}
export function orderLocale(value: string): OrderLocale {
  const locales: Record<string, OrderLocale> = {
    en: "en",
    English: "en",
    ru: "ru",
    Русский: "ru",
    es: "es",
    Español: "es",
    de: "de",
    Deutsch: "de",
  };
  if (!locales[value]) throw Error("Unknown order language");
  return locales[value];
}
export function chooseDelaySeconds(
  area: OrderArea,
  random: () => number
): number {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1)
    throw Error("Invalid random sample");
  const [min, max] = DELIVERY_MINUTES[area];
  return min * 60 + Math.floor(n * ((max - min) * 60 + 1));
}
export type MailState =
  | "pending"
  | "sending"
  | "accepted"
  | "delivered"
  | "retry"
  | "failed"
  | "reconcile";
export type PreparationState =
  | "queued"
  | "calculating"
  | "writing"
  | "rendering"
  | "quality_review"
  | "owner_review"
  | "ready"
  | "failed";
export type Lifecycle = {
  schemaVersion: 1;
  locale: OrderLocale;
  area: OrderArea;
  delaySeconds: number;
  acceptedAt: number;
  acknowledgement: MailState;
  acknowledgementAcceptedAt: number | null;
  preparation: PreparationState;
  mode: "manual" | "automatic";
  authorizedPdf: {
    versionId: number;
    sha256: string;
    recipient: string;
  } | null;
  finalMail: MailState | "not_authorized";
  held: boolean;
};
export function deliveryDueAt(s: Lifecycle): number | null {
  if (s.acknowledgementAcceptedAt === null) return null;
  if (
    !Number.isSafeInteger(s.acknowledgementAcceptedAt) ||
    s.acknowledgementAcceptedAt < s.acceptedAt
  )
    throw Error("Invalid acknowledgement time");
  const [min, max] = DELIVERY_MINUTES[s.area];
  if (
    !Number.isInteger(s.delaySeconds) ||
    s.delaySeconds < min * 60 ||
    s.delaySeconds > max * 60
  )
    throw Error("Invalid persisted delay");
  return s.acknowledgementAcceptedAt + s.delaySeconds * 1000;
}
export type DeliveryGate =
  | "held"
  | "already_sent"
  | "sending"
  | "reconcile"
  | "mail_failed"
  | "awaiting_acknowledgement"
  | "preparing"
  | "awaiting_approval"
  | "snapshot_changed"
  | "scheduled"
  | "due";
export function deliveryGate(
  s: Lifecycle,
  current: { versionId: number; sha256: string; recipient: string },
  now: number
): DeliveryGate {
  if (s.held) return "held";
  if (["accepted", "delivered"].includes(s.finalMail)) return "already_sent";
  if (s.finalMail === "sending") return "sending";
  if (s.finalMail === "reconcile" || s.acknowledgement === "reconcile")
    return "reconcile";
  if (s.finalMail === "failed" || s.acknowledgement === "failed")
    return "mail_failed";
  if (
    !["accepted", "delivered"].includes(s.acknowledgement) ||
    s.acknowledgementAcceptedAt === null
  )
    return "awaiting_acknowledgement";
  if (s.preparation !== "ready") return "preparing";
  const a = s.authorizedPdf;
  if (!a) return "awaiting_approval";
  if (
    !/^[a-f0-9]{64}$/.test(a.sha256) ||
    a.versionId !== current.versionId ||
    a.sha256 !== current.sha256 ||
    a.recipient !== current.recipient
  )
    return "snapshot_changed";
  return now < deliveryDueAt(s)! ? "scheduled" : "due";
}
/** Only pass history obtained from a verified customer identity, never an unverified email lookup. */
export function recommendProducts(input: {
  current: string;
  verifiedPurchased: readonly string[];
  available: readonly string[];
  promotionsAllowed: boolean;
}): string[] {
  if (!input.promotionsAllowed) return [];
  const excluded = new Set([input.current, ...input.verifiedPurchased]);
  const area = orderArea(input.current);
  const ranked =
    area === "tarot"
      ? ["portrait", "vedic_basic", "daily", "monthly", "vedic_plus"]
      : area === "western"
        ? ["tarot", "vedic_basic", "vedic_plus", "monthly", "daily", "portrait"]
        : ["tarot", "portrait", "monthly", "daily"];
  return ranked
    .filter(p => input.available.includes(p) && !excluded.has(p))
    .slice(0, 2);
}
