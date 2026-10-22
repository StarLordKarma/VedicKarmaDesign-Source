import { validateNarrativeDraft } from "./report-narrative";
import { TECHNICAL_FACT_TEXT } from "../shared/vedic-labels";

export function assertAutomaticReportQuality(input: {
  factsJson: string;
  narrativeJson: string;
  locale: string;
}) {
  const facts = JSON.parse(input.factsJson);
  const narrative = validateNarrativeDraft(
    JSON.parse(input.narrativeJson),
    facts
  );
  if (narrative.locale !== input.locale)
    throw new Error("Report language does not match the order");
  if (
    narrative.sections.length < 3 ||
    new Set(narrative.sections.map(s => s.sectionKey)).size !==
      narrative.sections.length ||
    narrative.sections.some(
      s => !s.title.trim() || s.paragraphs.length < 2 || s.paragraphs.join(" ").trim().length < 250 || s.paragraphs.some(p => !p.trim() || TECHNICAL_FACT_TEXT.test(p))
    ) ||
    narrative.sections.some(s => !s.factRefs.length || s.warnings.length)
  )
    throw new Error("Report requires owner review");
  return narrative;
}
