// Canonical zero-based calculation labels; names, not ordinal indices, go to prose generation.
export const SIGN_LABELS = {
  en: "Aries Taurus Gemini Cancer Leo Virgo Libra Scorpio Sagittarius Capricorn Aquarius Pisces".split(" "),
  ru: "Овен Телец Близнецы Рак Лев Дева Весы Скорпион Стрелец Козерог Водолей Рыбы".split(" "),
  de: "Widder Stier Zwillinge Krebs Löwe Jungfrau Waage Skorpion Schütze Steinbock Wassermann Fische".split(" "),
  es: "Aries Tauro Géminis Cáncer Leo Virgo Libra Escorpio Sagitario Capricornio Acuario Piscis".split(" "),
};
export const NAKSHATRA_LABELS = ["Ashvini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
export const PLANET_LABELS = {
  en: ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu", "Ascendant"],
  ru: ["Солнце", "Луна", "Меркурий", "Венера", "Марс", "Юпитер", "Сатурн", "Раху", "Кету", "Асцендент"],
  de: ["Sonne", "Mond", "Merkur", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu", "Aszendent"],
  es: ["Sol", "Luna", "Mercurio", "Venus", "Marte", "Júpiter", "Saturno", "Rahu", "Ketu", "Ascendente"],
};
export const TECHNICAL_FACT_TEXT = /factRefs?\s*(?:path)?\s*:|\$\.[a-z]|\b(?:ascendant|planets|d1|d9|aspects|vimshottari|engine)(?:\[\d+\]|\.[a-z_])/i;
