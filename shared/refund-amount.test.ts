import { describe, it, expect } from "vitest";
import { refundAmount } from "./refund-amount";
describe("net token refund", () => {
 it.each(["polygon", "tron", "bnb"] as const)("subtracts a disclosed token fee exactly on %s", network => { const r = refundAmount("9.99", "0.12", network); expect(Number(r.amount)).toBe(9.87); expect(r.units).toBe(network === "bnb" ? "9870000000000000000" : "9870000"); });
 it("permits waiving the fee and rejects excessive, negative or imprecise deductions", () => {expect(Number(refundAmount("9.99","0","tron").amount)).toBe(9.99); for (const fee of ["9.99","10","-1","NaN","0.0000001"]) expect(()=>refundAmount("9.99",fee,"tron")).toThrow();});
});
