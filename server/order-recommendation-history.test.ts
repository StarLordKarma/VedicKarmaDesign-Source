import { it, expect, afterEach } from "vitest";
import {
  readRecommendationHistory,
  writeRecommendationHistory,
} from "./order-recommendation-history";
const previous = process.env.ORDER_SIGNING_SECRET;
afterEach(() => {
  if (previous === undefined) delete process.env.ORDER_SIGNING_SECRET;
  else process.env.ORDER_SIGNING_SECRET = previous;
});
it("only preserves signed paid history for the same recipient", () => {
  process.env.ORDER_SIGNING_SECRET =
    "synthetic-test-key-at-least-32-characters";
  const token = writeRecommendationHistory(
    "A@sandbox.invalid",
    ["tarot", "tarot", "portrait"],
    1000
  )!;
  expect(readRecommendationHistory(token, "a@sandbox.invalid", 2000)).toEqual([
    "tarot",
    "portrait",
  ]);
  expect(
    readRecommendationHistory(token, "other@sandbox.invalid", 2000)
  ).toEqual([]);
  expect(token).not.toContain("sandbox.invalid");
});
it("rejects tampering and expiry", () => {
  process.env.ORDER_SIGNING_SECRET =
    "synthetic-test-key-at-least-32-characters";
  const token = writeRecommendationHistory(
    "a@sandbox.invalid",
    ["tarot"],
    1000
  )!;
  expect(
    readRecommendationHistory(token + "x", "a@sandbox.invalid", 2000)
  ).toEqual([]);
  expect(
    readRecommendationHistory(token, "a@sandbox.invalid", 400 * 86400000)
  ).toEqual([]);
});
it("does not manufacture history without a configured secret", () => {
  delete process.env.ORDER_SIGNING_SECRET;
  expect(
    writeRecommendationHistory("a@sandbox.invalid", ["tarot"])
  ).toBeUndefined();
  expect(readRecommendationHistory("bad", "a@sandbox.invalid")).toEqual([]);
});
