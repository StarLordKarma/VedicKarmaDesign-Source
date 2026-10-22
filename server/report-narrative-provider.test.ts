import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
import { invokeLLM } from "./_core/llm";
import { generateNarrativeDraft } from "./report-narrative";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("production narrative provider", () => {
  it("uses the configured model and excludes raw birth and contact data", async () => {
    vi.stubEnv("REPORT_AI_MODEL", "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ schemaVersion: "vedic-narrative.v1", locale: "en", sections: [{ sectionKey: "core-themes", title: "Reflection", paragraphs: ["A reflective theme invites careful consideration of the ways you learn, communicate and respond in daily life. Consider a recent conversation and identify one choice that helped you listen more carefully. Use this symbolic perspective as a question for reflection, with room for your own experience and judgment.", "Write down one observation from that conversation and compare it with the assumption you first made. Ask what information would help you understand the other person more accurately. This separates a useful reflective question from an unsupported conclusion and gives you a practical next step."], factRefs: ["ascendant.sign"], warnings: [] }], disclaimerKey: "interpretive-practice", modelVersion: "test", promptVersion: "report-narrative-v1" }) } }] } as any);
    const result = await generateNarrativeDraft({ locale: "en", settings: { aiModel: "gpt-5-mini", maxTokens: 3000, maxSections: 1, maxParagraphChars: 1800 }, facts: { ascendant: { sign: 1, degreeInSign: 12.1234567 }, input: { localDate: "1990-01-01", latitude: 55 }, email: "private@example.com", name: "Private person" } });
    const call = vi.mocked(invokeLLM).mock.calls[0][0];
    expect(call.model).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    const transmitted = JSON.stringify(call.messages);
    expect(transmitted).not.toContain("1990-01-01");
    expect(transmitted).not.toContain("private@example.com");
    expect(transmitted).not.toContain("Private person");
    expect(transmitted).toContain("12.12");
    expect(transmitted).toContain("Taurus");
    expect(transmitted).not.toContain("12.1234567");
    expect(result.modelVersion).toBe(call.model);
  });
  it("rejects an unsupported configured provider model before making a request", async () => {
    vi.stubEnv("REPORT_AI_MODEL", "unsupported-model");
    await expect(generateNarrativeDraft({ locale: "en", facts: {} })).rejects.toThrow("Unsupported");
    expect(invokeLLM).not.toHaveBeenCalled();
  });
  it("retries an invalid draft once and stops if the corrected draft is still invalid", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: "{}" } }] } as any);
    await expect(generateNarrativeDraft({ locale: "en", facts: { ascendant: { sign: 1 } } })).rejects.toThrow();
    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(invokeLLM).mock.calls[1][0].messages)).toContain("Correct the JSON draft");
  });
});
