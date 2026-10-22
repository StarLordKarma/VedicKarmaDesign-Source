type Locale = "en" | "ru" | "de" | "es";
import { NAKSHATRA_LABELS } from "../shared/vedic-labels";
import { numerologyReflection } from "../shared/numerology-reflection";
export type ReportPage = { title: string; body: string; chart?: "d1" | "d9" };

const labels = {
  en: ["Birth data and calculation", "Ascendant and houses", "Planetary profile", "Zodiac emphasis", "Planetary aspects", "Vimshottari periods", "Life path and birth number", "Personal year", "Sign", "Degree in sign", "Whole-sign house", "Nakshatra / pada", "Retrograde", "Birth date / local time", "UTC offset (minutes)", "Coordinates", "Method", "Reflect on how this symbolic theme appears in your choices, relationships and daily habits. Record one concrete example and one small action you can try. These symbols do not determine events or replace your judgment.", "A house describes an area of experience; a sign describes its symbolic style. Read the ascendant together with the complete chart, rather than as a fixed personality label.", "Numerology is a symbolic reflection practice, not a prediction or a scientific assessment."],
  ru: ["Данные рождения и расчёт", "Асцендент и дома", "Профиль планеты", "Акценты зодиака", "Аспекты планет", "Периоды Vimshottari", "Жизненный путь и число рождения", "Личный год", "Знак", "Градус в знаке", "Дом целых знаков", "Накшатра / пада", "Ретроградность", "Дата и местное время рождения", "Смещение UTC (минуты)", "Координаты", "Метод", "Подумайте, как эта символическая тема проявляется в ваших решениях, отношениях и повседневных привычках. Запишите один конкретный пример и одно небольшое действие, которое можно попробовать. Символы не определяют события и не заменяют ваше суждение.", "Дом обозначает область опыта, а знак — её символический стиль. Рассматривайте асцендент вместе со всей картой, без жёстких ярлыков личности.", "Нумерология — символическая практика размышления, а не предсказание или научная оценка."],
  de: ["Geburtsdaten und Berechnung", "Aszendent und Häuser", "Planetenprofil", "Tierkreis-Schwerpunkte", "Planetenaspekte", "Vimshottari-Perioden", "Lebensweg und Geburtszahl", "Persönliches Jahr", "Zeichen", "Grad im Zeichen", "Ganzzeichenhaus", "Nakshatra / Pada", "Rückläufig", "Geburtsdatum / Ortszeit", "UTC-Abweichung (Minuten)", "Koordinaten", "Methode", "Überlegen Sie, wie dieses symbolische Thema in Entscheidungen, Beziehungen und Alltagsgewohnheiten erscheint. Notieren Sie ein konkretes Beispiel und einen kleinen nächsten Schritt. Symbole bestimmen keine Ereignisse und ersetzen nicht Ihr Urteil.", "Ein Haus beschreibt einen Erfahrungsbereich, ein Zeichen dessen symbolischen Stil. Betrachten Sie den Aszendenten im Zusammenhang der gesamten Karte, nicht als starres Persönlichkeitsmerkmal.", "Numerologie ist eine symbolische Reflexionspraxis, keine Vorhersage oder wissenschaftliche Beurteilung."],
  es: ["Datos de nacimiento y cálculo", "Ascendente y casas", "Perfil planetario", "Énfasis zodiacal", "Aspectos planetarios", "Periodos Vimshottari", "Camino de vida y número natal", "Año personal", "Signo", "Grado en el signo", "Casa de signo completo", "Nakshatra / pada", "Retrógrado", "Fecha y hora local de nacimiento", "Diferencia UTC (minutos)", "Coordenadas", "Método", "Reflexiona sobre cómo aparece este tema simbólico en tus decisiones, relaciones y hábitos. Anota un ejemplo concreto y una pequeña acción que puedas probar. Los símbolos no determinan los acontecimientos ni sustituyen tu criterio.", "Una casa describe un ámbito de experiencia; un signo, su estilo simbólico. Lee el ascendente junto con toda la carta, sin etiquetas rígidas de personalidad.", "La numerología es una práctica simbólica de reflexión, no una predicción ni una evaluación científica."],
} as const;
const signs = {
  en: "Aries Taurus Gemini Cancer Leo Virgo Libra Scorpio Sagittarius Capricorn Aquarius Pisces".split(" "),
  ru: "Овен Телец Близнецы Рак Лев Дева Весы Скорпион Стрелец Козерог Водолей Рыбы".split(" "),
  de: "Widder Stier Zwillinge Krebs Löwe Jungfrau Waage Skorpion Schütze Steinbock Wassermann Fische".split(" "),
  es: "Aries Tauro Géminis Cáncer Leo Virgo Libra Escorpio Sagitario Capricornio Acuario Piscis".split(" "),
};
const planetNames = {
  en: ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"],
  ru: ["Солнце", "Луна", "Меркурий", "Венера", "Марс", "Юпитер", "Сатурн", "Раху", "Кету"],
  de: ["Sonne", "Mond", "Merkur", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"],
  es: ["Sol", "Luna", "Mercurio", "Venus", "Marte", "Júpiter", "Saturno", "Rahu", "Ketu"],
};
const themes = {
  en: ["Purpose, visibility and responsibility", "Emotional needs, security and habits", "Learning, language and communication", "Values, affection and reciprocity", "Initiative, boundaries and conflict", "Learning, meaning and generosity", "Patience, structure and commitments", "Unfamiliar experiences, ambition and discernment", "Detachment, established patterns and letting go"],
  ru: ["Цель, проявленность и ответственность", "Эмоциональные потребности, безопасность и привычки", "Обучение, язык и общение", "Ценности, привязанность и взаимность", "Инициатива, границы и конфликты", "Обучение, смысл и щедрость", "Терпение, структура и обязательства", "Новый опыт, амбиции и различение", "Отстранённость, знакомые модели и отпускание"],
  de: ["Sinn, Sichtbarkeit und Verantwortung", "Emotionale Bedürfnisse, Sicherheit und Gewohnheiten", "Lernen, Sprache und Kommunikation", "Werte, Zuneigung und Gegenseitigkeit", "Initiative, Grenzen und Konflikte", "Lernen, Bedeutung und Großzügigkeit", "Geduld, Struktur und Verpflichtungen", "Ungewohnte Erfahrungen, Ehrgeiz und Unterscheidung", "Distanz, vertraute Muster und Loslassen"],
  es: ["Propósito, visibilidad y responsabilidad", "Necesidades emocionales, seguridad y hábitos", "Aprendizaje, lenguaje y comunicación", "Valores, afecto y reciprocidad", "Iniciativa, límites y conflicto", "Aprendizaje, sentido y generosidad", "Paciencia, estructura y compromisos", "Experiencias nuevas, ambición y discernimiento", "Desapego, patrones conocidos y soltar"],
};
const reduceNumber = (number: number): number => number > 9 && ![11, 22, 33].includes(number) ? reduceNumber(String(number).split("").reduce((sum, digit) => sum + Number(digit), 0)) : number;
const clean = (text: string) => text.replace(/\s*\(factRefs?:.*?\)/gi, "").replace(/\b\d+\.\d{3,}\b/g, value => Number(value).toFixed(2)).trim();

export function buildReportContent(input: { locale: Locale; packageType: "basic" | "basic_plus"; facts: any; narrative: { sections: Array<{ title: string; paragraphs: string[] }> } }): ReportPage[] {
  const l = labels[input.locale]; const f = input.facts;
  const planet = (name: string) => planetNames[input.locale][planetNames.en.indexOf(name)] || name;
  const sign = (value: number) => signs[input.locale][value] || String(value);
  const ascSign = Number(f.ascendant?.sign ?? f.d1?.find((p: any) => p.planet === "Ascendant")?.sign ?? 0);
  const house = (value: number) => ((value - ascSign + 12) % 12) + 1;
  const pages: ReportPage[] = [
    { title: "D1 · Rāśi", body: "", chart: "d1" },
    { title: l[0], body: `${l[13]}: ${f.input?.localDate ?? "—"} / ${f.input?.localTime ?? "—"}\n${l[14]}: ${f.input?.timeZoneOffsetMinutes ?? "—"}\n${l[15]}: ${f.input?.latitude ?? "—"}, ${f.input?.longitude ?? "—"}\n\n${l[16]}: Swiss Ephemeris · Lahiri · sidereal · whole-sign\n\n${l[18]}` },
    { title: l[1], body: `${l[8]}: ${sign(ascSign)}\n${l[9]}: ${Number(f.ascendant?.degreeInSign ?? 0).toFixed(2)}°\n\n${Array.from({ length: 12 }, (_, i) => `${i + 1}. ${sign((ascSign + i) % 12)}`).join("\n")}\n\n${l[18]}` },
  ];
  for (const p of f.planets || []) pages.push({ title: `${planet(p.planet)} · ${l[2]}`, body: `${l[8]}: ${sign(p.sign)}\n${l[9]}: ${Number(p.degreeInSign).toFixed(2)}°\n${l[10]}: ${house(p.sign)}\n${l[11]}: ${NAKSHATRA_LABELS[p.nakshatra] || "—"} (${Number(p.nakshatra) + 1}) / ${p.pada}\n${l[12]}: ${p.retrograde ? "✓" : "—"}\n\n${themes[input.locale][planetNames.en.indexOf(p.planet)] || ""}\n\n${l[17]}` });
  pages.push({ title: l[3], body: signs[input.locale].map((name, index) => `${name}: ${(f.planets || []).filter((p: any) => p.sign === index).map((p: any) => planet(p.planet)).join(", ") || "—"}`).join("\n\n") });
  pages.push({ title: l[4], body: (f.aspects || []).map((a: any) => `${planet(a.source)} → ${a.target === "Ascendant" ? l[1] : planet(a.target)} (${a.housesForward})`).join("\n") || "—" });
  const date = (value: string) => new Intl.DateTimeFormat(input.locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
  pages.push({ title: l[5], body: (f.vimshottari?.periods || []).map((period: any) => `${planet(period.lord)}: ${date(period.startUtc)} → ${date(period.endUtc)}`).join("\n\n") + `\n\n${l[17]}` });
  for (const section of input.narrative.sections) pages.push({ title: section.title, body: section.paragraphs.map(clean).join("\n\n") });
  if (input.packageType === "basic_plus") {
    pages.push({ title: "D9 · Navāṁśa", body: "", chart: "d9" });
    const digits = String(f.input?.localDate || "").replace(/\D/g, "");
    const lifePath = reduceNumber(digits.split("").reduce((sum, digit) => sum + Number(digit), 0));
    const day = Number(String(f.input?.localDate || "").slice(8, 10));
    const year = new Date().getUTCFullYear();
    const yearDigits = `${String(f.input?.localDate || "").slice(5).replace(/\D/g, "")}${year}`;
    const personalYear = reduceNumber(yearDigits.split("").reduce((sum, digit) => sum + Number(digit), 0));
    const reflection = numerologyReflection(input.locale, lifePath, reduceNumber(day), personalYear);
    pages.push({ title: l[6], body: `${f.input?.localDate}\n${digits.split("").join(" + ")} = ${digits.split("").reduce((sum, digit) => sum + Number(digit), 0)} → ${lifePath}\n\n${day} → ${reduceNumber(day)}\n\n${reflection.life}\n\n${reflection.method}\n\n${l[19]}` });
    pages.push({ title: `${l[7]} · ${year}`, body: `${yearDigits.split("").join(" + ")} → ${personalYear}\n\n${reflection.year}\n\n${l[19]}` });
  }
  return pages;
}
