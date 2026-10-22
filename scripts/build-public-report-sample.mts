// Reproducible public demonstration. All identity/birth details are fictional.
// No production credentials, external AI requests, storage or email are used.
import fs from "node:fs/promises";
import { buildFullNatalReportPdf } from "../server/export";
import { calculateVedicSnapshot } from "../server/vedic-astrology-calculator";

const facts = calculateVedicSnapshot({ localDate: "2000-01-01", localTime: "12:00", timeZoneOffsetMinutes: 60, latitude: 52.52, longitude: 13.405 });
const narrative = { sections: [{
  sectionKey: "learning-and-purpose", title: "Learning, purpose & direction", factRefs: ["planets[0]", "planets[2]"],
  paragraphs: [
    "Elena, in this fictional chart the Sun and Mercury are both in sidereal Sagittarius. Within the Jyotish tradition, this combination can be read as a meeting between purpose and the wish to understand. A useful theme to explore is how a broad idea becomes something you can explain, practise and share. Rather than assuming that one calling is already decided, notice which subjects keep drawing your attention and where your curiosity becomes patient enough to do the work.",
    "Try a small experiment: choose one subject you care about and explain it in a single clear page. Then ask a trusted reader which part feels most useful and which part needs a concrete example. This turns a symbolic theme into an observable habit: learning, communicating and listening to feedback. The chart does not promise a particular career or outcome. It offers a question to return to: where could deeper understanding make your next step more deliberate?",
  ],
}] };
await fs.mkdir("tmp/pdfs", { recursive: true });
const pdf = await buildFullNatalReportPdf({
  background: await fs.readFile("client/public/backgrounds/pdf-meru-cover-300dpi.jpg"),
  locale: "en", clientName: "Elena Marin", birthPlace: "Berlin, Germany", sampleLabel: "FICTIONAL SAMPLE / ELENA MARIN", packageType: "basic", facts, narrative,
});
await fs.writeFile("tmp/pdfs/public-sample-source.pdf", pdf);
console.log("Created fictional source report. Select the cover, D1 chart and timeline; all source pages carry a fictional-sample label.");
