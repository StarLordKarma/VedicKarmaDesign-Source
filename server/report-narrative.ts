import { z } from "zod";
import { invokeLLM, type Message } from "./_core/llm";
import { SIGN_LABELS, NAKSHATRA_LABELS, PLANET_LABELS, TECHNICAL_FACT_TEXT } from "../shared/vedic-labels";

export const narrativeDraftSchema = z.object({
  schemaVersion: z.literal("vedic-narrative.v1"),
  locale: z.enum(["ru", "en", "de", "es"]),
  sections: z.array(z.object({
    sectionKey: z.string().regex(/^[a-z0-9-]{3,80}$/),
    title: z.string().min(1).max(140),
    paragraphs: z.array(z.string().min(1).max(1800)).min(1).max(4),
    factRefs: z.array(z.string().min(1).max(120)).min(1).max(16),
    warnings: z.array(z.string().max(300)).max(8),
  })).min(1).max(12),
  disclaimerKey: z.literal("interpretive-practice"),
  modelVersion: z.string().min(1).max(100),
  promptVersion: z.literal("report-narrative-v1"),
});
export type NarrativeDraft = z.infer<typeof narrativeDraftSchema>;

const prohibitedClaims = /\b(cure|diagnos|лечит|диагноз|гарантиру|guarantee|garantier|legal advice|юридическ(ая|ое)|финансов(ая|ое) консультац|financial advice|medizinische Beratung|medizinisch|insurance|страхов)/i;

function resolveFactPath(facts: unknown, reference: string) {
  const parts = reference.startsWith("/")
    ? reference.slice(1).split("/").map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    : reference.replace(/^\$\.?/, "").replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let value: unknown = facts;
  for (const part of parts) {
    if (value === null || value === undefined || (typeof value !== "object" && !Array.isArray(value))) return undefined;
    if (!Object.prototype.hasOwnProperty.call(value, part)) return undefined;
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
    locale: { type: "string", enum: ["ru", "en", "de", "es"] },
    sections: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", properties: { sectionKey: { type: "string", pattern: "^[a-z0-9-]{3,80}$" }, title: { type: "string" }, paragraphs: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 250, maxLength: 1800 } }, factRefs: { type: "array", minItems: 1, maxItems: 16, items: { type: "string" } }, warnings: { type: "array", maxItems: 8, items: { type: "string" } } }, required: ["sectionKey", "title", "paragraphs", "factRefs", "warnings"], additionalProperties: false } },
    disclaimerKey: { type: "string", enum: ["interpretive-practice"] },
    modelVersion: { type: "string" },
    promptVersion: { type: "string", enum: ["report-narrative-v1"] },
  },
  required: ["schemaVersion", "locale", "sections", "disclaimerKey", "modelVersion", "promptVersion"],
  additionalProperties: false,
} as const;

export const AI_NARRATIVE_MODELS = ["gpt-5-nano", "gpt-5-mini", "gpt-5", "claude-haiku-4-5", "claude-sonnet-4-6", "gemini-3-flash-preview", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"] as const;
export type NarrativeGenerationSettings = { aiModel: typeof AI_NARRATIVE_MODELS[number]; maxTokens: number; maxSections: number; maxParagraphChars: number };

export async function generateNarrativeDraft(input: { facts: unknown; locale: "ru" | "en" | "de" | "es"; settings?: NarrativeGenerationSettings }) {
  const sourceFacts = input.facts as Record<string, unknown>;
  // Never send the raw birth date, time, location, or contact details to the text model.
  const allowed = Object.fromEntries(["contractVersion", "engine", "ascendant", "planets", "d1", "d9", "aspects", "vimshottari"].filter(key => Object.prototype.hasOwnProperty.call(sourceFacts, key)).map(key => [key, sourceFacts[key]]));
  const factsJson = JSON.stringify(allowed, (key, value) => {
    if (["longitude", "degreeInSign"].includes(key) && typeof value === "number") return Number(value.toFixed(2));
    if (key === "sign" && typeof value === "number") return SIGN_LABELS[input.locale][value] ?? value;
    if (["nakshatra", "birthNakshatra"].includes(key) && typeof value === "number") return NAKSHATRA_LABELS[value] ?? value;
    if (["planet", "lord", "birthLord", "source", "target"].includes(key) && typeof value === "string") return PLANET_LABELS[input.locale][PLANET_LABELS.en.indexOf(value)] ?? value;
    return value;
  });
  const narrativeFacts = JSON.parse(factsJson);
  const settings = input.settings ?? { aiModel: "gpt-5-mini", maxTokens: 5000, maxSections: 6, maxParagraphChars: 1800 };
  const configuredModel = process.env.REPORT_AI_MODEL || settings.aiModel;
  const languageName = { ru: "Russian (Русский)", en: "English", de: "German (Deutsch)", es: "Spanish (Español)" }[input.locale];
  if (!AI_NARRATIVE_MODELS.includes(configuredModel as typeof AI_NARRATIVE_MODELS[number])) throw new Error("Unsupported narrative model.");
  if (settings.maxTokens < 1000 || settings.maxTokens > 12000 || settings.maxSections < 1 || settings.maxSections > 12 || settings.maxParagraphChars < 300 || settings.maxParagraphChars > 1800) throw new Error("Narrative generation limits are outside the supported range.");
  const schema = { ...outputSchema, properties: { ...outputSchema.properties, sections: { ...outputSchema.properties.sections, minItems: settings.maxSections, maxItems: settings.maxSections, items: { ...outputSchema.properties.sections.items, properties: { ...outputSchema.properties.sections.items.properties, paragraphs: { type: "array", minItems: 2, maxItems: 2, items: { type: "string", minLength: 250, maxLength: settings.maxParagraphChars } } } } } } };
  const request = {
    model: configuredModel,
    messages: [
      { role: "system", content: "You write cautious, reflective Vedic astrology narrative. Output JSON only. Use only facts present in the supplied facts JSON. Do not invent dates, placements, events, diagnoses, legal/financial/medical advice, or guaranteed outcomes. Keep the tone clear and non-deterministic. Sign and nakshatra values are already human-readable names, not numeric indices. Use those exact names, never reinterpret them as ordinal numbers. Use professional capitalization in titles and sentences. Use degreeInSign for within-sign degrees, never longitude. Do not describe a dasha period as current or upcoming; present the supplied timeline as symbolic historical context. Keep factRefs in the separate metadata field only; never print code paths, JSON, or factRefs in paragraph text." },
      { role: "user", content: `Return a validated vedic-narrative.v1 draft in locale ${input.locale}. Write all section titles and narrative paragraphs in ${languageName}; keep the JSON schema keys unchanged. Include exactly ${settings.maxSections} substantive, distinct sections. Cover core themes, learning and communication, relationships and values, nakshatra context, the historical dasha timeline, and practical reflection; avoid repeating the same interpretation across sections. Write two thoughtful paragraphs per section, about 60-90 words each, with at least 300 characters of prose per section. Explain the symbolic context and offer a concrete reflective question; do not merely list placements. Display degrees to at most two decimal places. Keep every paragraph at or below ${settings.maxParagraphChars} characters. Use lowercase ASCII hyphenated sectionKey values, such as core-themes, planetary-emphasis, and practical-reflection. Include all fields in the required JSON schema. Every section must contain at least one exact factRefs path, such as planets[0].sign or ascendant.sign. Facts JSON:\n${factsJson}` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "vedic_narrative_v1", strict: true, schema } },
    maxTokens: settings.maxTokens,
  } satisfies Parameters<typeof invokeLLM>[0];
  const messages: Message[] = [...request.messages];
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await invokeLLM({ ...request, messages });
    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Narrative model returned no JSON content.");
    try {
      const validated = validateNarrativeDraft(JSON.parse(content), narrativeFacts);
      if (validated.locale !== input.locale) throw new Error("Use the requested language.");
      if (validated.sections.length !== settings.maxSections || validated.sections.some(section => section.paragraphs.length < 2 || section.paragraphs.some(paragraph => paragraph.length > settings.maxParagraphChars))) throw new Error("Use the configured section count, two paragraphs per section and paragraph limits.");
      const shortSections = validated.sections.filter(section => section.paragraphs.join(" ").length < 250);
      if (shortSections.length) throw new Error(`Expand short sections: ${shortSections.map(section => `${section.sectionKey} (${section.paragraphs.join(" ").length} characters)`).join(", ")}. Write two substantive paragraphs per section in ${languageName}, at least 300 characters total per section.`);
      if (validated.sections.some(section => section.paragraphs.some(paragraph => TECHNICAL_FACT_TEXT.test(paragraph)))) throw new Error("Remove technical references such as planets[0].sign and ascendant.sign from all paragraphs. Keep them only in factRefs. Write natural prose only.");
      if (validated.sections.some(section => section.paragraphs.some(paragraph => /\bcurrent dasha|\bcurrent period|текущ.{0,15}(?:даш|период)|aktuell.{0,15}(?:dasha|periode)|periodo actual/i.test(paragraph)))) throw new Error("Do not call any period current. Describe the provided period dates as historical symbolic context.");
      return { ...validated, modelVersion: configuredModel, promptVersion: "report-narrative-v1" as const };
    } catch (error) {
      if (attempt === 1) throw error;
      messages.push({ role: "assistant", content }, { role: "user", content: `Correct the JSON draft. Validation failed: ${error instanceof Error ? error.message : "invalid draft"}. Preserve the supplied facts, language and output schema. Return corrected JSON only.` });
    }
  }
  throw new Error("Narrative generation did not produce a valid draft.");
}
