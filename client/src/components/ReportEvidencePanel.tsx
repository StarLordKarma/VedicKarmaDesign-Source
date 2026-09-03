import React, { useEffect, useState } from "react";
type Section = { title?: string; paragraphs?: string[]; factRefs?: string[]; warnings?: string[] };
function parseJson(value?: string | null) { try { return value ? JSON.parse(value) : null; } catch { return null; } }

export default function ReportEvidencePanel({ factsJson, narrativeJson, versions, onRevise, saving }: {
  factsJson?: string | null; narrativeJson?: string | null;
  versions: Array<{ id: number; versionNumber: number; status: string; pdfStorageKey?: string | null }>;
  onRevise?: (json: string) => void; saving?: boolean;
}) {
  const facts = parseJson(factsJson);
  const narrative = parseJson(narrativeJson) as { sections?: Section[] } | null;
  const [draft, setDraft] = useState<{ sections?: Section[] } | null>(null);
  useEffect(() => { setDraft(parseJson(narrativeJson)); }, [narrativeJson]);
  return <div className="mb-6 space-y-3">
    <details className="rounded-xl border border-[#28231f]/15 bg-white p-4">
      <summary className="cursor-pointer font-semibold">Source facts · read-only</summary>
      <p className="mt-3 text-xs text-[#635a52]">Compare the birth input, timezone, chart positions and calculation engine with the report before approving.</p>
      <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-[#f8f5f0] p-3 text-xs" aria-label="Calculation facts">{facts ? JSON.stringify(facts, null, 2) : "No calculation facts available."}</pre>
    </details>
    {onRevise && draft?.sections && <details className="rounded-xl border border-[#28231f]/15 bg-white p-4">
      <summary className="cursor-pointer font-semibold">Edit narrative · create a new PDF version</summary>
      <p className="mt-3 text-xs text-[#635a52]">Only text can change. Source facts and previous PDF versions remain unchanged. The new PDF needs a fresh review.</p>
      <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); onRevise(JSON.stringify(draft)); }}>
        {draft.sections.map((section, index) => <label key={index} className="block text-sm font-semibold">{section.title}<textarea aria-label={`Edit ${section.title}`} rows={6} className="mt-2 w-full rounded-lg border p-3 font-normal" value={section.paragraphs?.join("\n\n") ?? ""} onChange={event => { const paragraphs = event.target.value.split(/\n\s*\n/); setDraft(previous => ({ ...previous, sections: previous?.sections?.map((entry, i) => i === index ? { ...entry, paragraphs } : entry) })); }} /></label>)}
        <button type="submit" disabled={saving} className="rounded-lg bg-[#a04d30] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Rendering new version…" : "Save text & render new PDF"}</button>
      </form>
    </details>}
    <details className="rounded-xl border border-[#28231f]/15 bg-white p-4">
      <summary className="cursor-pointer font-semibold">Full narrative · all sections</summary>
      {narrative?.sections?.length ? narrative.sections.map((section, index) => <article key={index} className="mt-4 border-t border-[#28231f]/10 pt-4">
        <h3 className="font-serif text-xl">{section.title}</h3>
        {section.paragraphs?.map((paragraph, i) => <p key={i} className="mt-2 text-sm leading-7">{paragraph}</p>)}
        <p className="mt-2 text-xs text-[#635a52]">Fact references: {section.factRefs?.join(", ") || "None"}</p>
        {section.warnings?.map((warning, i) => <p key={i} className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{warning}</p>)}
      </article>) : <p className="mt-3 text-sm">No narrative available.</p>}
    </details>
    {versions.length > 1 && <details className="rounded-xl border border-[#28231f]/15 bg-white p-4"><summary className="cursor-pointer font-semibold">Version history · compare PDFs</summary><ul className="mt-3 space-y-2 text-sm">{versions.map(version => <li key={version.id}>Version {version.versionNumber} · {version.status} {version.pdfStorageKey && <a className="ml-2 underline" target="_blank" rel="noreferrer" href={`/manus-storage/${version.pdfStorageKey}`}>Open PDF</a>}</li>)}</ul></details>}
  </div>;
}
