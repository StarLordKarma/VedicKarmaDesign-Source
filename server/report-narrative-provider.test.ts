import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
import { invokeLLM } from "./_core/llm";
import { generateNarrativeDraft } from "./report-narrative";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("production narrative provider", () => {
  it("uses the configured model and excludes raw birth and contact data", async () => {
    vi.stubEnv("REPORT_AI_MODEL", "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ schemaVersion: "vedic-narrative.v1", locale: "en", sections: [{ sectionKey: "core-themes", title: "Reflection", paragraphs: ["A reflective theme."], factRefs: ["ascendant.sign"], warnings: [] }], disclaimerKey: "interpretive-practice", modelVersion: "test", promptVersion: "report-narrative-v1" }) } }] } as any);
    const result = await generateNarrativeDraft({ locale: "en", facts: { ascendant: { sign: 1 }, input: { localDate: "1990-01-01", latitude: 55 }, email: "private@example.com", name: "Private person" } });
    const call = vi.mocked(invokeLLM).mock.calls[0][0];
    expect(call.model).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    const transmitted = JSON.stringify(call.messages);
    expect(transmitted).not.toContain("1990-01-01");
    expect(transmitted).not.toContain("private@example.com");
    expect(transmitted).not.toContain("Private person");
    expect(result.modelVersion).toBe(call.model);
  });
  it("rejects an unsupported configured provider model before making a request", async () => {
    vi.stubEnv("REPORT_AI_MODEL", "unsupported-model");
    await expect(generateNarrativeDraft({ locale: "en", facts: {} })).rejects.toThrow("Unsupported");
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});
