import { z } from "zod";
import { invokeLLM } from "./_core/llm";

export const narrativeDraftSchema = z.object({
  schemaVersion: z.literal("vedic-narrative.v1"),
  locale: z.enum(["ru", "en", "de"]),
  sections: z.array(z.object({
    sectionKey: z.string().regex(/^[a-z0-9-]{3,80}$/),
    title: z.string().min(1).max(140),
    paragraphs: z.array(z.string().min(1).max(1800)).min(1).max(4),
    factRefs: z.array(z.string().min(1).max(120)).max(16),
    warnings: z.array(z.string().max(300)).max(8),
  })).min(1).max(12),
  disclaimerKey: z.literal("interpretive-practice"),
  modelVersion: z.string().min(1).max(100),
  promptVersion: z.literal("report-narrative-v1"),
});
export type NarrativeDraft = z.infer<typeof narrativeDraftSchema>;

const prohibitedClaims = /\b(cure|diagnos|лечит|диагноз|гарантиру|guarantee|garantier|legal advice|юридическ(ая|ое)|финансов(ая|ое) консультац|financial advice|medizinische Beratung|medizinisch|insurance|страхов)/i;

function resolveFactPath(facts: unknown, reference: string) {
  const parts = reference.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let value: unknown = facts;
  for (const part of parts) {
    if (value === null || value === undefined || (typeof value !== "object" && !Array.isArray(value))) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

export function validateNarrativeDraft(input: unknown, facts: unknown) {
  const parsed = narrativeDraftSchema.parse(input);
  for (const section of parsed.sections) {
    for (const reference of section.factRefs) {
      if (resolveFactPath(facts, reference) === undefined) throw new Error(`Narrative references missing fact: ${reference}`);
    }
    if (section.paragraphs.some((paragraph) => paragraph.length > 1800 || prohibitedClaims.test(paragraph))) throw new Error(`Narrative section contains a prohibited or oversized claim: ${section.sectionKey}`);
  }
  return parsed;
}

const outputSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "string", enum: ["vedic-narrative.v1"] },
    locale: { type: "string", enum: ["ru", "en", "de"] },
    sections: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", properties: { sectionKey: { type: "string" }, title: { type: "string" }, paragraphs: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } }, factRefs: { type: "array", maxItems: 16, items: { type: "string" } }, warnings: { type: "array", maxItems: 8, items: { type: "string" } } }, required: ["sectionKey", "title", "paragraphs", "factRefs", "warnings"], additionalProperties: false } },
    disclaimerKey: { type: "string", enum: ["interpretive-practice"] },
    modelVersion: { type: "string" },
    promptVersion: { type: "string", enum: ["report-narrative-v1"] },
  },
  required: ["schemaVersion", "locale", "sections", "disclaimerKey", "modelVersion", "promptVersion"],
  additionalProperties: false,
} as const;

export const AI_NARRATIVE_MODELS = ["gpt-5-nano", "gpt-5-mini", "gpt-5", "claude-haiku-4-5", "claude-sonnet-4-6", "gemini-3-flash-preview"] as const;
export type NarrativeGenerationSettings = { aiModel: typeof AI_NARRATIVE_MODELS[number]; maxTokens: number; maxSections: number; maxParagraphChars: number };

export async function generateNarrativeDraft(input: { facts: unknown; locale: "ru" | "en" | "de"; settings?: NarrativeGenerationSettings }) {
  const factsJson = JSON.stringify(input.facts);
  const settings = input.settings ?? { aiModel: "gpt-5-mini", maxTokens: 5000, maxSections: 6, maxParagraphChars: 1800 };
  if (!AI_NARRATIVE_MODELS.includes(settings.aiModel)) throw new Error("Unsupported narrative model.");
  if (settings.maxTokens < 1000 || settings.maxTokens > 12000 || settings.maxSections < 1 || settings.maxSections > 12 || settings.maxParagraphChars < 300 || settings.maxParagraphChars > 1800) throw new Error("Narrative generation limits are outside the supported range.");
  const response = await invokeLLM({
    model: settings.aiModel,
    messages: [
      { role: "system", content: "You write cautious, reflective Vedic astrology narrative. Output JSON only. Use only facts present in the supplied facts JSON. Do not invent dates, placements, events, diagnoses, legal/financial/medical advice, or guaranteed outcomes. Keep the tone clear and non-deterministic." },
      { role: "user", content: `Return a validated vedic-narrative.v1 draft in locale ${input.locale}. Include no more than ${settings.maxSections} concise sections for ascendant/core themes, planetary emphasis, nakshatra/dasha context, and practical reflection. Keep every paragraph at or below ${settings.maxParagraphChars} characters. Every paragraph must cite one or more exact factRefs. Facts JSON:\n${factsJson}` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "vedic_narrative_v1", strict: true, schema: outputSchema } },
    maxTokens: settings.maxTokens,
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Narrative model returned no JSON content.");
  const validated = validateNarrativeDraft(JSON.parse(content), input.facts);
  if (validated.sections.length > settings.maxSections || validated.sections.some((section) => section.paragraphs.some((paragraph) => paragraph.length > settings.maxParagraphChars))) throw new Error("Narrative output exceeded the configured limits.");
  return { ...validated, modelVersion: settings.aiModel, promptVersion: "report-narrative-v1" as const };
}
