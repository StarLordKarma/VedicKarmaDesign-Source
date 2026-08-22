# PDF Report Layout — Basic и Basic+

## 1. Дизайн-направление

Макет использует светлую editorial-эстетику: ivory `#F8F3E8`, parchment `#EEE2CE`, muted terracotta `#B96B4B`, deep ink `#2E2A25`, bronze `#A8793B`, dusty blue `#71828A` и lotus rose `#C98C86`. Это самостоятельная визуальная система, вдохновлённая атмосферой светлых астрологических desktop-программ, но не копирующая интерфейс, торговые знаки или proprietary assets Parasara Light 9.

Основной формат — A4 portrait, поля 18–22 mm, baseline grid 4 mm. Заголовки — embedded Unicode serif, например Noto Serif; body, tables и metadata — embedded Noto Sans. Для русской, английской и немецкой версий нужно встраивать один и тот же набор шрифтов, чтобы переносы и пагинация были предсказуемыми.

Плотные расчётные таблицы должны иметь ivory content panel с непрозрачностью не менее 92%. Фоновые изображения используются как full-bleed artwork на обложке/разделителях либо как обрезанный боковой декоративный слой с низкой opacity. Нельзя помещать длинный текст непосредственно поверх сложных участков картины.

## 2. Роли предоставленных изображений

Предоставленный набор содержит portrait PNG 1536×2304. `01_original_meru_cosmology.png` — композиция с Mount Meru, планетными орбитами и более свободным пространством слева; она подходит для обложки или первого разделителя с заголовком слева. `02_original_lotus_cosmology.png` — светлое открытое поле слева/в центре, орбиты справа и lotus water внизу; она лучше всего подходит для methodology/introduction divider.

Серия `02_original_generated_series` может использоваться только на коротких тематических opening pages: Surya — для solar/identity раздела, Chandra — для Moon/Nakshatra, Saraswati — для knowledge/interpretation, Ganga — для flow/transits, Lakshmi — для resources. Серия `03_graha_series_available` используется как маленький decorative panel рядом с planet-specific table, а не как фон для плотного текста.

Один и тот же рисунок нельзя растягивать с искажением пропорций. PDF renderer должен поддерживать crop-to-cover, overlay tint и deterministic fallback, если asset недоступен. Exact chart diagrams, planet glyphs, labels и numbers всегда строятся программно, а не запекаются в background image.

## 3. Basic — 22 страницы

| Стр. | Раздел | Содержание и макет |
|---:|---|---|
| 1 | Cover | Full-bleed Meru background, ivory overlay слева, имя клиента, «Vedic Birth Chart Reading», language/date и короткий disclaimer |
| 2 | Welcome | Чистая страница с коротким обращением, package label, methodology note и содержанием |
| 3 | Contents & reading guide | Содержание, условные обозначения, как читать degree/sign/house и предупреждение о точности birth time |
| 4 | Birth data snapshot | Дата, местное время, город, страна, timezone, UTC conversion, coordinates и quality flags в карточках |
| 5 | Chart settings | Sidereal zodiac, Lahiri ayanāṃśa, Vimshottari dasha, house system, engine/template versions |
| 6 | Rāśi / D1 chart | Большая deterministic North Indian или выбранная chart geometry, легенда и текстовая таблица placements |
| 7 | Ascendant & chart anchor | Лагна, её lord, ascendant degree и один narrative block с fact references |
| 8 | Sun & Moon | Две колонки: Sun themes и Moon themes; маленькие solar/lunar decorative panels |
| 9 | Planet placements I | Mercury, Venus, Mars: sign, degree, house, nakshatra, short factual interpretation |
| 10 | Planet placements II | Jupiter, Saturn, Rahu, Ketu: те же поля, отдельные warnings where relevant |
| 11 | Nakshatra | Moon nakshatra, pada, lord, symbolic themes and practical reflection prompts |
| 12 | House themes I | Houses 1–6; compact table plus 2–3 generated narrative paragraphs |
| 13 | House themes II | Houses 7–12; compact table plus 2–3 generated narrative paragraphs |
| 14 | Relationships | 7th-house/related factors as interpretive themes, without deterministic promises or professional advice |
| 15 | Work & direction | 10th-house/related factors, strengths, questions and reflection prompts |
| 16 | Wellbeing reflection | Symbolic self-reflection only; explicit note that this is not medical advice or diagnosis |
| 17 | Yogas & doshas | Only rules present in the validated rule set; each item shows rule reference, contributing facts and cautious interpretation |
| 18 | Vimshottari dasha | Current mahadasha/antardasha, start/end dates, timezone and methodology note |
| 19 | Period overview | Selected upcoming periods, themes and questions; no guaranteed predictions |
| 20 | Synthesis | Three-column structure: observable chart facts, interpretive themes, reflection questions |
| 21 | Methodology & limitations | Engine/ephemeris versions, input quality, rounding policy, data retention summary and disclaimer |
| 22 | Closing & legal page | Contact, report version, generated/approved timestamps, localized disclaimer and private-document notice |

### 3.1 Пример Basic-раздела

**RU — Лагна и основные акценты**

> Восходящий знак и положение его управителя используются в этой интерпретации как символическая рамка для наблюдения за стилем самовыражения и предпочтительными способами взаимодействия с миром. Ниже приведены исходные положения карты; текст является интерпретацией этих данных, а не гарантированным описанием личности или будущих событий.

**Фактическая опора:** `chart.ascendant.sign`, `chart.ascendant.degree`, `chart.planets[ascendantLord]`.

**Вопросы для самостоятельного размышления:**

> В каких ситуациях вы естественно берёте инициативу? Какие способы выражения помогают вам сохранять ясность и устойчивость?

**EN — Lagna and core themes**

> The ascendant and its ruling planet are used here as a symbolic framework for reflecting on self-expression and preferred ways of engaging with the world. The chart positions below are the factual basis; the text is interpretive and does not guarantee personality traits or future events.

**DE — Lagna und zentrale Themen**

> Der Aszendent und sein Herrscher werden hier als symbolischer Rahmen verwendet, um über Selbstausdruck und bevorzugte Formen der Begegnung mit der Welt nachzudenken. Die unten aufgeführten Stellungen bilden die faktische Grundlage; der Text ist interpretativ und garantiert weder Persönlichkeitsmerkmale noch zukünftige Ereignisse.

## 4. Basic+ — 25 страниц

Basic+ использует те же первые 22 страницы, затем добавляет три страницы D9/Navāṃśa:

| Стр. | Раздел | Содержание и макет |
|---:|---|---|
| 23 | Navāṃśa / D9 chart | Deterministic D9 chart, legend, settings and explicit «Basic+ only» label |
| 24 | D1–D9 synthesis | Сравнение selected placements in D1 and D9; read-only factual table and cautious narrative |
| 25 | Extended synthesis | Integrated summary, additional reflection prompts, version metadata and approval/disclaimer footer |

D9 нельзя показывать в Basic. В Basic+ страница должна иметь заметный label `D9 / Navāṃśa — Basic+`, чтобы клиент понимал разницу пакетов. Если calculation result не прошёл validation, renderer должен остановить выпуск, а не создать пустую или частично выдуманную страницу.

## 5. Reusable page components

Каждая страница должна собираться из контролируемых компонентов: `ReportHeader`, `SectionKicker`, `FactTable`, `ChartFrame`, `NarrativeCard`, `ReflectionPrompt`, `QualityWarning`, `PageFooter`, `DisclaimerBlock` и `BackgroundPanel`. Components принимают typed data и locale copy; они не должны самостоятельно вычислять astrology facts.

`FactTable` использует табличные строки с фиксированными колонками и переносом длинных немецких слов. `ChartFrame` имеет text alternative с placements. `QualityWarning` визуально отличается terracotta border, но не создаёт тревожных медицинских или финансовых обещаний. `DisclaimerBlock` всегда выводится в конце, а на страницах с interpretation — в compact form.

## 6. Responsive/print rules

PDF не является responsive web page, но preview в Report Studio должен показывать A4 proportions и безопасно уменьшаться на мобильном экране. На экране owner preview нужны page thumbnails, zoom, keyboard navigation и доступный text-only fallback. При печати background artwork можно отключить без потери содержания.

Весь body text должен оставаться читаемым в grayscale print. Нельзя использовать цвет как единственный способ отличить D1 от D9, warning или status. Все decorative backgrounds должны иметь alt metadata в preview и не должны изменять расчётные значения.

## 7. Disclaimer placement

Короткая локализованная версия располагается на обложке и в footer narrative pages. Полная версия — на страницах 21–22 и 25 для Basic+. В receipt/price-breakdown PDF сохраняется отдельный короткий disclaimer о том, что документ описывает стоимость и не является астрологическим отчётом. Email body содержит ту же локаль, что и PDF.

Формулировка должна оставаться юридически осторожной: услуга является interpretive/spiritual reflection, не заменяет медицинскую, психологическую, юридическую или финансовую консультацию, не гарантирует результат и не отменяет обязательные права потребителя. Фактические Terms, Privacy Notice и Refund Policy должны проверяться юристом для стран продаж.

## 8. Renderer acceptance criteria

PDF считается готовым к owner review, если все 22/25 страницы сформированы, charts и tables не переполняют область, русский/английский/немецкий текст корректно отображается embedded fonts, D9 отсутствует в Basic, calculation metadata совпадает с snapshot, disclaimer присутствует на требуемых страницах, а `pdfSha256` сохранён вместе с template/engine versions.

Перед отправкой клиенту владелец должен видеть preview, report status, calculation warnings, narrative version, last editor, approval timestamp и delivery action. Только approved PDF может попасть в `sendClientNatalPdf`; draft storage key не должен использоваться как customer delivery artifact.
