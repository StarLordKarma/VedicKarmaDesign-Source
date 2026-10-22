import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./llm";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Workers AI native structured output", () => {
  it("sends the actual JSON schema to the native model endpoint and normalizes the result", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://api.cloudflare.com/client/v4/accounts/account123/ai/v1"); vi.stubEnv("LLM_API_KEY", "private-test-key");
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ success: true, result: { response: { checked: true } } }), { status: 200 })); vi.stubGlobal("fetch", fetcher);
    const schema = { type: "object", properties: { checked: { type: "boolean" } }, required: ["checked"] };
    const result = await invokeLLM({ model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", messages: [{ role: "user", content: "Check" }], response_format: { type: "json_schema", json_schema: { name: "check", strict: true, schema } } });
    expect(fetcher.mock.calls[0][0]).toBe("https://api.cloudflare.com/client/v4/accounts/account123/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(JSON.parse(String((fetcher.mock.calls[0] as any)[1].body)).response_format.json_schema).toEqual(schema);
    expect(result.choices[0].message.content).toBe('{"checked":true}');
  });
});
