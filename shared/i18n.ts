export type Locale = "en" | "ru" | "de" | "es";

export type Copy = {
  localeLabel: string;
  questionsLabel: string;
  questionsTitle: string;
  footerBody: string;
  footerNote: string;
  navReading: string;
  navHow: string;
  navFaq: string;
  book: string;
  badge: string;
  heroTitle: string;
  heroBody: string;
  features: readonly string[];
  highlightQuestions: string;
  rasiChart: string;
  patternTitle: string;
  patternBody: string;
  basicLabel: string;
  begin: string;
  explore: string;
  offering: string;
  offeringTitle: string;
  offeringBody: string;
  vedicDifferenceEyebrow: string;
  vedicDifferenceTitle: string;
  vedicDifferenceBody: readonly string[];
  basicTitle: string;
  basicBody: string;
  optional: string;
  addOn: string;
  addOnBody: string;
  process: string;
  processTitle: string;
  steps: readonly { title: string; text: string }[];
  bookSection: string;
  bookTitle: string;
  bookBody: string;
  name: string;
  email: string;
  date: string;
  dateHint: string;
  time: string;
  timeHint: string;
  generatedAt: string;
  city: string;
  country: string;
  language: string;
  interest: string;
  request: string;
  optionalInterest: string;
  placeholderName: string;
  placeholderCity: string;
  placeholderCountry: string;
  pdfReading: string;
  requestReading: string;
  birthDetails: string;
  noteHeading: string;
  faqs: readonly { question: string; answer: string }[];
  note: string;
  legalDisclaimer: string;
  successTitle: string;
  continueCheckout: string;
  anotherRequest: string;
  privacy: string;
  languageOptions: readonly { value: string; label: string }[];
  checkoutPending: string;
  priceBreakdown: string;
  priceBasic: string;
  priceBasicHint: string;
  priceAddon: string;
  priceAddonHint: string;
  priceTotal: string;
  priceTotalHint: string;
  priceAddonNotSelected: string;
  downloadBreakdown: string;
  downloadingBreakdown: string;
  shareReceipt: string;
  shareNative: string;
  sharingReceipt: string;
  shareUnavailable: string;
  shareWhatsApp: string;
  shareTelegram: string;
  copyReceiptLink: string;
  linkCopied: string;
  sendReceiptEmail: string;
  receiptEmailPlaceholder: string;
  sendingReceiptEmail: string;
  receiptEmailSent: string;
  receiptEmailFailed: string;
  receiptEmailCooldown: string;
  checkoutSuccess: (total: number, formattedTotal?: string) => string;
};

export const COPY: Record<Locale, Copy> = {
  en: {
    localeLabel: "Language",
    questionsLabel: "Questions",
    questionsTitle: "Before you book",
    footerBody: "A thoughtful reading of your inner sky.",
    footerNote: "Interpretive practice for reflection",
    navReading: "The reading",
    navHow: "How it works",
    navFaq: "FAQ",
    book: "Book a reading",
    badge: "Vedic astrology · Jyotish",
    heroTitle: "A clearer map for your inner sky.",
    heroBody: "A personalized Vedic birth chart reading, prepared with care and delivered as a detailed multi-page PDF for reflection, self-understanding, and spiritual exploration.",
    features: ["4 languages", "Multi-page PDF", "Personal & structured"],
    highlightQuestions: "One round of clarification questions",
    rasiChart: "Rasi chart",
    patternTitle: "Read the patterns.",
    patternBody: "A grounded interpretation of the symbols, houses, and planetary placements that shape your chart.",
    basicLabel: "basic reading",
    begin: "Begin your reading",
    explore: "Explore the reading",
    offering: "The offering",
    offeringTitle: "A reading made to be returned to.",
    offeringBody: "Your chart is translated into a calm, readable document — something you can sit with, revisit, and use as a prompt for reflection.",
    vedicDifferenceEyebrow: "Two traditions, two lenses",
    vedicDifferenceTitle: "Why Vedic astrology can offer finer detail",
    vedicDifferenceBody: ["Western and Vedic astrology are both rich interpretive traditions; they simply begin from different reference frames. Most Western practice uses the tropical zodiac, anchored to the seasons. Jyotish uses the sidereal zodiac, referenced to the background of fixed stars, and applies an ayanamsha to account for the gradual precession of the equinoxes. This reading uses the widely adopted Lahiri ayanamsha.", "Jyotish adds another layer through 27 nakshatras, or lunar mansions, each divided into four padas. These 108 sections create a finer vocabulary for describing how a placement may be expressed. Vimshottari dasha then offers a traditional time model: instead of treating the birth chart as static, it explores which planetary themes may be more prominent during different periods of life.", "The value is not that one tradition invalidates the other. It lies in combining several perspectives—natal chart, dasha periods, and current transits—into one coherent reading. The result is a more granular framework for reflection, not a promise of certainty or a substitute for professional advice."],
    basicTitle: "Basic Vedic chart reading",
    basicBody: "A personal Jyotish natal chart interpretation, focused on key planetary placements, houses, strengths, tendencies, and areas for reflection.",
    optional: "Optional add-on",
    addOn: "Indian numerology & traditional symbols",
    addOnBody: "D9 chart, life-path and birth-number calculations with symbolic interpretation, plus a personal-year reflection plan.",
    process: "The process",
    processTitle: "Simple to begin. Thoughtful in delivery.",
    steps: [
      {
        title: "Share your birth details",
        text: "Provide your place of birth, date of birth, and exact time of birth. These details shape the accuracy and completeness of the chart interpretation.",
      },
      {
        title: "Receive your reading",
        text: "Your personalized interpretation is prepared as a detailed, multi-page PDF document in your preferred language.",
      },
      {
        title: "Return to the insight",
        text: "Read at your own pace and ask one round of clarification questions about the delivered document.",
      },
    ],
    bookSection: "Book your reading",
    bookTitle: "Bring the right details.",
    bookBody: "The city, country, date, and exact time of birth are required. The more accurate the information, the more precise and complete the chart interpretation can be.",
    name: "Preferred name",
    email: "Email",
    date: "Date of birth",
    dateHint: "Use your local calendar date of birth.",
    time: "Exact time of birth",
    timeHint: "Enter the local birth time as precisely as possible, including minutes.",
    generatedAt: "Generated",
    city: "City of birth",
    country: "Country of birth",
    language: "Preferred language",
    interest: "What would you like to reflect on?",
    request: "Request my reading",
    optionalInterest: "Optional: themes, questions, or areas of interest",
    placeholderName: "Your name",
    placeholderCity: "City",
    placeholderCountry: "Country",
    pdfReading: "PDF reading",
    requestReading: "Request a reading",
    birthDetails: "Your birth details",
    noteHeading: "A note on the practice.",
    faqs: [
      {
        question: "What details do I need to provide?",
        answer: "Please provide your place of birth (city and country), date of birth, and exact time of birth. The accuracy and completeness of the reading depend on the correctness of these details.",
      },
      {
        question: "What will I receive?",
        answer: "You will receive a detailed, multi-page PDF document with the main themes of your Vedic natal chart explained in clear language.",
      },
      {
        question: "What is included in the numerology add-on?",
        answer: "The add-on includes a D9 chart, life-path and birth-number calculations with their method, symbolic interpretations, and a personal-year reflection plan.",
      },
      {
        question: "Is this medical, legal, or financial advice?",
        answer: "No. Astrology and numerology are interpretive practices for reflection and spiritual exploration. They are not a substitute for qualified professional advice.",
      },
    ],
    note: "Astrology and numerology are interpretive practices for reflection and spiritual exploration, not medical, legal, financial, psychological, or professional advice.",
    legalDisclaimer: "Important: This service is provided for personal reflection and spiritual exploration only. It is not medical, legal, financial, psychological, or other professional advice and does not guarantee predictions or specific outcomes. You remain responsible for decisions you make. To the extent permitted by applicable law, the author and operator are not responsible for decisions or results based on this material. Nothing in this notice limits mandatory consumer rights or liability that cannot legally be excluded.",
    successTitle: "Your request is received.",
    continueCheckout: "Continue to crypto checkout",
    anotherRequest: "Send another request",
    privacy: "Your details are used only to prepare and respond to your reading request. Cryptocurrency payment is handled by the selected payment provider; this site does not store wallet private keys.",
    languageOptions: [
      { value: "English", label: "English" },
      { value: "Русский", label: "Русский" },
      { value: "Deutsch", label: "Deutsch" },
      { value: "Español", label: "Español" },
    ],
    checkoutPending: "Creating your secure checkout…",
    priceBreakdown: "Price breakdown",
    priceBasic: "Basic reading",
    priceBasicHint: "The core Vedic natal chart interpretation delivered as a detailed multi-page PDF.",
    priceAddon: "Indian numerology add-on",
    priceAddonHint: "An optional D9 chart, birth-date numerology, calculation method and personal-year reflection plan.",
    priceTotal: "Total",
    priceTotalHint: "The amount for the selected services in the currency shown above.",
    priceAddonNotSelected: "Not selected",
    downloadBreakdown: "Download price breakdown PDF",
    downloadingBreakdown: "Preparing PDF…",
    shareReceipt: "Share receipt",
    shareNative: "Share on device",
    sharingReceipt: "Opening share sheet…",
    shareUnavailable: "Sharing is unavailable. Please copy the receipt link instead.",
    shareWhatsApp: "WhatsApp",
    shareTelegram: "Telegram",
    copyReceiptLink: "Copy receipt link",
    linkCopied: "Receipt link copied",
    sendReceiptEmail: "Email this receipt",
    receiptEmailPlaceholder: "your@email.com",
    sendingReceiptEmail: "Sending receipt…",
    receiptEmailSent: "Receipt sent by email.",
    receiptEmailFailed: "Could not send the receipt. Please try again.",
    receiptEmailCooldown: "Please wait about one minute before requesting another receipt.",
    checkoutSuccess: (total, formattedTotal = String(total)) => `Your request is saved. Continue to secure crypto checkout for ${formattedTotal}.`,
  },
  ru: {
    localeLabel: "Язык",
    questionsLabel: "Вопросы",
    questionsTitle: "Перед заказом",
    footerBody: "Вдумчивое чтение вашего внутреннего неба.",
    footerNote: "Интерпретативная практика для размышления",
    navReading: "О чтении",
    navHow: "Как это работает",
    navFaq: "Вопросы",
    book: "Заказать чтение",
    badge: "Ведическая астрология · Джйотиш",
    heroTitle: "Более ясная карта вашего внутреннего неба.",
    heroBody: "Персональное чтение ведической натальной карты, подготовленное бережно и оформленное в подробный многостраничный PDF для самопонимания и духовного исследования.",
    features: ["4 языка", "Многостраничный PDF", "Лично и структурированно"],
    highlightQuestions: "Один раунд уточняющих вопросов",
    rasiChart: "Карта Раши",
    patternTitle: "Читайте закономерности.",
    patternBody: "Взвешенная интерпретация символов, домов и положений планет вашей карты.",
    basicLabel: "базовое чтение",
    begin: "Начать чтение",
    explore: "Подробнее об услуге",
    offering: "Услуга",
    offeringTitle: "К чтению хочется возвращаться.",
    offeringBody: "Ваша карта превращается в спокойный, понятный документ, к которому можно возвращаться и использовать его для размышлений.",
    vedicDifferenceEyebrow: "Две традиции — два взгляда",
    vedicDifferenceTitle: "Почему ведическая астрология даёт более тонкую детализацию",
    vedicDifferenceBody: ["Западная и ведическая астрология — две глубокие интерпретативные традиции, которые используют разные системы отсчёта. Большинство западных школ работает с тропическим зодиаком, связанным с сезонами. Джйотиш опирается на сидерический зодиак, соотнесённый с фоном неподвижных звёзд, и учитывает постепенную прецессию равноденствий через аянамшу. В этом чтении применяется широко используемая аянамша Лахири.", "Дополнительную точность языка даёт система 27 накшатр, или лунных стоянок. Каждая делится на четыре пады, образуя 108 более узких участков зодиака. Благодаря этому одно и то же положение можно описать с большей нюансированностью. Даши Вимшоттари добавляют традиционную временную модель: карта рассматривается не как неподвижный портрет, а как последовательность периодов, в которых разные планетарные темы могут выходить на первый план.", "Речь не о том, что одна традиция отменяет другую. Сила подхода — в совместном рассмотрении натальной карты, периодов даш и текущих транзитов. Такое соединение даёт более подробную структуру для размышления, но не обещает абсолютной точности и не заменяет профессиональную консультацию."],
    basicTitle: "Базовое чтение ведической карты",
    basicBody: "Персональная интерпретация натальной карты в традиции Джйотиш: положения планет, дома, сильные стороны, склонности и темы для размышления.",
    optional: "Дополнительно",
    addOn: "Индийская нумерология и традиционные символы",
    addOnBody: "Карта D9, расчёт жизненного пути и числа рождения с символическим разбором, а также план осмысления личного года.",
    process: "Процесс",
    processTitle: "Начать просто. Результат — продуманный.",
    steps: [
      {
        title: "Передайте данные рождения",
        text: "Укажите место, дату и точное время рождения. Эти данные влияют на точность и полноту интерпретации карты.",
      },
      {
        title: "Получите чтение",
        text: "Персональная интерпретация будет подготовлена в виде подробного многостраничного PDF на выбранном языке.",
      },
      {
        title: "Возвращайтесь к инсайтам",
        text: "Читайте в удобном темпе и задайте один раунд уточняющих вопросов по готовому документу.",
      },
    ],
    bookSection: "Заказать чтение",
    bookTitle: "Укажите точные данные.",
    bookBody: "Необходимы город, страна, дата и точное время рождения. Чем точнее данные, тем полнее и точнее интерпретация натальной карты.",
    name: "Имя",
    email: "Email",
    date: "Дата рождения",
    dateHint: "Укажите дату рождения по местному календарю.",
    time: "Точное время рождения",
    timeHint: "Укажите местное время рождения как можно точнее, включая минуты.",
    generatedAt: "Сформировано",
    city: "Город рождения",
    country: "Страна рождения",
    language: "Язык чтения",
    interest: "На что вы хотели бы обратить внимание?",
    request: "Заказать чтение",
    optionalInterest: "Необязательно: темы, вопросы или интересующие области",
    placeholderName: "Ваше имя",
    placeholderCity: "Город",
    placeholderCountry: "Страна",
    pdfReading: "Чтение в PDF",
    requestReading: "Заказать чтение",
    birthDetails: "Данные рождения",
    noteHeading: "Важно знать.",
    faqs: [
      {
        question: "Какие данные нужно предоставить?",
        answer: "Укажите место рождения (город и страну), дату и точное время рождения. Точность и полнота чтения зависят от корректности этих данных.",
      },
      {
        question: "Что я получу?",
        answer: "Вы получите подробный многостраничный PDF с основными темами вашей ведической натальной карты, изложенными понятным языком.",
      },
      {
        question: "Что входит в дополнение по нумерологии?",
        answer: "Дополнение включает карту D9, расчёт жизненного пути и числа рождения с объяснением метода, символический разбор и план осмысления личного года.",
      },
      {
        question: "Это медицинская, юридическая или финансовая консультация?",
        answer: "Нет. Астрология и нумерология — интерпретативные практики для размышления и духовного исследования, а не замена профессиональной консультации.",
      },
    ],
    note: "Астрология и нумерология являются интерпретативными практиками для размышления и духовного исследования, а не медицинской, юридической, финансовой, психологической или профессиональной консультацией.",
    legalDisclaimer: "Важно: услуга предоставляется только для личного осмысления и духовного исследования. Это не медицинская, юридическая, финансовая, психологическая или иная профессиональная консультация; прогнозы и конкретные результаты не гарантируются. Вы самостоятельно отвечаете за принимаемые решения. В пределах, допускаемых применимым правом, автор и оператор не отвечают за решения или последствия, основанные на этих материалах. Настоящее уведомление не ограничивает обязательные права потребителя или ответственность, которую нельзя исключить по закону.",
    successTitle: "Заявка получена.",
    continueCheckout: "Перейти к криптооплате",
    anotherRequest: "Отправить ещё одну заявку",
    privacy: "Ваши данные используются только для подготовки и обработки запроса на консультацию. Криптовалютный платёж обрабатывает выбранный платёжный оператор; сайт не хранит приватные ключи кошелька.",
    languageOptions: [
      { value: "English", label: "Английский" },
      { value: "Русский", label: "Русский" },
      { value: "Deutsch", label: "Немецкий" },
      { value: "Español", label: "Испанский" },
    ],
    checkoutPending: "Создание защищённой оплаты…",
    priceBreakdown: "Разбивка стоимости",
    priceBasic: "Базовое чтение",
    priceBasicHint: "Основная интерпретация ведической натальной карты в подробном многостраничном PDF.",
    priceAddon: "Дополнение: индийская нумерология",
    priceAddonHint: "Дополнительная карта D9, нумерология даты рождения с объяснением метода и план осмысления личного года.",
    priceTotal: "Итого",
    priceTotalHint: "Сумма выбранных услуг в указанной выше валюте.",
    priceAddonNotSelected: "Не выбрано",
    downloadBreakdown: "Скачать PDF с разбивкой стоимости",
    downloadingBreakdown: "Подготовка PDF…",
    shareReceipt: "Поделиться квитанцией",
    shareNative: "Поделиться на устройстве",
    sharingReceipt: "Открытие меню отправки…",
    shareUnavailable: "Отправка недоступна. Скопируйте ссылку на квитанцию.",
    shareWhatsApp: "WhatsApp",
    shareTelegram: "Telegram",
    copyReceiptLink: "Скопировать ссылку на квитанцию",
    linkCopied: "Ссылка на квитанцию скопирована",
    sendReceiptEmail: "Отправить квитанцию на email",
    receiptEmailPlaceholder: "ваш@email.com",
    sendingReceiptEmail: "Отправка квитанции…",
    receiptEmailSent: "Квитанция отправлена на email.",
    receiptEmailFailed: "Не удалось отправить квитанцию. Попробуйте ещё раз.",
    receiptEmailCooldown: "Подождите около минуты перед повторной отправкой квитанции.",
    checkoutSuccess: (total, formattedTotal = String(total)) => `Ваша заявка сохранена. Перейдите к безопасной криптооплате на сумму ${formattedTotal}.`,
  },
  de: {
    localeLabel: "Sprache",
    questionsLabel: "Fragen",
    questionsTitle: "Vor der Buchung",
    footerBody: "Eine achtsame Deutung Ihres inneren Himmels.",
    footerNote: "Interpretative Praxis zur Reflexion",
    navReading: "Die Deutung",
    navHow: "So funktioniert es",
    navFaq: "FAQ",
    book: "Deutung buchen",
    badge: "Vedische Astrologie · Jyotish",
    heroTitle: "Eine klarere Karte für Ihren inneren Himmel.",
    heroBody: "Eine persönliche vedische Geburtschart-Deutung, sorgfältig erstellt und als ausführliches mehrseitiges PDF für Reflexion, Selbsterkenntnis und spirituelle Orientierung geliefert.",
    features: ["4 Sprachen", "Mehrseitiges PDF", "Persönlich & strukturiert"],
    highlightQuestions: "Eine Runde Rückfragen",
    rasiChart: "Rasi-Chart",
    patternTitle: "Muster erkennen.",
    patternBody: "Eine bodenständige Deutung der Symbole, Häuser und Planetenkonstellationen Ihrer Karte.",
    basicLabel: "Basisdeutung",
    begin: "Deutung beginnen",
    explore: "Deutung entdecken",
    offering: "Das Angebot",
    offeringTitle: "Eine Deutung, zu der man zurückkehrt.",
    offeringBody: "Ihre Karte wird zu einem ruhigen, gut lesbaren Dokument — zum Verweilen, Wiederlesen und Reflektieren.",
    vedicDifferenceEyebrow: "Zwei Traditionen, zwei Perspektiven",
    vedicDifferenceTitle: "Warum vedische Astrologie feiner differenzieren kann",
    vedicDifferenceBody: ["Westliche und vedische Astrologie sind beides vielschichtige Deutungstraditionen, doch sie beginnen mit unterschiedlichen Bezugssystemen. Die meisten westlichen Schulen nutzen den tropischen Tierkreis, der an die Jahreszeiten gebunden ist. Jyotish arbeitet mit dem siderischen Tierkreis vor dem Hintergrund der Fixsterne und berücksichtigt die langsame Präzession der Tagundnachtgleichen durch eine Ayanamsha. Für diese Deutung wird die weit verbreitete Lahiri-Ayanamsha verwendet.", "Eine weitere Ebene bilden die 27 Nakshatras oder Mondhäuser. Jedes ist in vier Padas unterteilt, sodass 108 feinere Abschnitte entstehen. Sie bieten eine differenziertere Sprache dafür, wie sich eine Stellung ausdrücken kann. Die Vimshottari-Dasha ergänzt ein traditionelles Zeitmodell: Das Geburtshoroskop bleibt kein statisches Bild, sondern wird im Zusammenhang mit Lebensphasen betrachtet, in denen unterschiedliche planetare Themen hervortreten können.", "Der Wert liegt nicht darin, eine Tradition gegen die andere auszuspielen. Er entsteht aus der Verbindung von Geburtshoroskop, Dasha-Perioden und aktuellen Transiten zu einer zusammenhängenden Betrachtung. Das schafft einen detaillierten Rahmen für Reflexion, jedoch kein Versprechen absoluter Gewissheit und keinen Ersatz für professionelle Beratung."],
    basicTitle: "Vedische Basis-Chart-Deutung",
    basicBody: "Eine persönliche Jyotish-Deutung Ihrer Geburtskarte mit Fokus auf wichtige Planetenkonstellationen, Häuser, Stärken, Tendenzen und Reflexionsthemen.",
    optional: "Optionale Ergänzung",
    addOn: "Indische Numerologie & traditionelle Symbole",
    addOnBody: "D9-Horoskop, Lebensweg- und Geburtszahl mit symbolischer Deutung sowie ein Reflexionsplan für das persönliche Jahr.",
    process: "Der Ablauf",
    processTitle: "Einfach beginnen. Sorgfältig geliefert.",
    steps: [
      {
        title: "Geburtsdaten teilen",
        text: "Geben Sie Geburtsort, Geburtsdatum und die genaue Geburtszeit an. Diese Angaben beeinflussen Genauigkeit und Vollständigkeit der Deutung.",
      },
      {
        title: "Deutung erhalten",
        text: "Ihre persönliche Interpretation wird als ausführliches mehrseitiges PDF in Ihrer bevorzugten Sprache erstellt.",
      },
      {
        title: "Zu den Einsichten zurückkehren",
        text: "Lesen Sie in Ihrem Tempo und stellen Sie eine Runde von Rückfragen zum gelieferten Dokument.",
      },
    ],
    bookSection: "Deutung buchen",
    bookTitle: "Die richtigen Angaben.",
    bookBody: "Geburtsstadt, Land, Datum und genaue Uhrzeit sind erforderlich. Je genauer die Angaben, desto vollständiger und präziser die Interpretation.",
    name: "Name",
    email: "E-Mail",
    date: "Geburtsdatum",
    dateHint: "Geben Sie Ihr Geburtsdatum nach dem örtlichen Kalender an.",
    time: "Genaue Geburtszeit",
    timeHint: "Geben Sie die lokale Geburtszeit möglichst genau einschließlich Minuten an.",
    generatedAt: "Erstellt",
    city: "Geburtsstadt",
    country: "Geburtsland",
    language: "Bevorzugte Sprache",
    interest: "Worüber möchten Sie reflektieren?",
    request: "Deutung anfordern",
    optionalInterest: "Optional: Themen, Fragen oder Interessengebiete",
    placeholderName: "Ihr Name",
    placeholderCity: "Stadt",
    placeholderCountry: "Land",
    pdfReading: "PDF-Deutung",
    requestReading: "Deutung anfordern",
    birthDetails: "Ihre Geburtsdaten",
    noteHeading: "Hinweis zur Praxis.",
    faqs: [
      {
        question: "Welche Angaben brauche ich?",
        answer: "Bitte nennen Sie Geburtsort (Stadt und Land), Geburtsdatum und genaue Geburtszeit. Die Genauigkeit und Vollständigkeit hängen von diesen Angaben ab.",
      },
      {
        question: "Was erhalte ich?",
        answer: "Sie erhalten ein ausführliches mehrseitiges PDF mit den wichtigsten Themen Ihrer vedischen Geburtskarte in verständlicher Sprache.",
      },
      {
        question: "Was beinhaltet die Numerologie-Ergänzung?",
        answer: "Die Ergänzung umfasst ein D9-Horoskop, Lebensweg- und Geburtszahl mit Rechenweg, symbolische Deutungen und einen Reflexionsplan für das persönliche Jahr.",
      },
      {
        question: "Ist das medizinische, rechtliche oder finanzielle Beratung?",
        answer: "Nein. Astrologie und Numerologie sind interpretative Praktiken zur Reflexion und spirituellen Orientierung und ersetzen keine qualifizierte Fachberatung.",
      },
    ],
    note: "Astrologie und Numerologie sind interpretative Praktiken zur Reflexion und spirituellen Orientierung, keine medizinische, rechtliche, finanzielle, psychologische oder sonstige Fachberatung.",
    legalDisclaimer: "Wichtiger Hinweis: Diese Leistung dient ausschließlich der persönlichen Reflexion und spirituellen Orientierung. Sie ist keine medizinische, rechtliche, finanzielle, psychologische oder sonstige Fachberatung und garantiert weder Vorhersagen noch bestimmte Ergebnisse. Für Ihre Entscheidungen bleiben Sie selbst verantwortlich. Soweit gesetzlich zulässig, haften Autor und Betreiber nicht für Entscheidungen oder Folgen, die auf diesen Inhalten beruhen. Zwingende Verbraucherrechte und gesetzlich nicht ausschließbare Haftung bleiben unberührt.",
    successTitle: "Ihre Anfrage ist eingegangen.",
    continueCheckout: "Zur Krypto-Zahlung",
    anotherRequest: "Weitere Anfrage senden",
    privacy: "Ihre Angaben werden nur zur Vorbereitung und Bearbeitung Ihrer Anfrage verwendet. Die Kryptozahlung wird vom ausgewählten Zahlungsanbieter verarbeitet; diese Website speichert keine privaten Wallet-Schlüssel.",
    languageOptions: [
      { value: "English", label: "Englisch" },
      { value: "Русский", label: "Russisch" },
      { value: "Deutsch", label: "Deutsch" },
      { value: "Español", label: "Spanisch" },
    ],
    checkoutPending: "Sichere Zahlung wird erstellt…",
    priceBreakdown: "Preisübersicht",
    priceBasic: "Basisdeutung",
    priceBasicHint: "Die zentrale vedische Geburtskarten-Deutung als ausführliches mehrseitiges PDF.",
    priceAddon: "Zusatz: indische Numerologie",
    priceAddonHint: "Optionales D9-Horoskop, Geburtsdatumsnumerologie mit Rechenweg und Reflexion zum persönlichen Jahr.",
    priceTotal: "Gesamtsumme",
    priceTotalHint: "Der Betrag für die ausgewählten Leistungen in der oben angezeigten Währung.",
    priceAddonNotSelected: "Nicht ausgewählt",
    downloadBreakdown: "Preisübersicht als PDF herunterladen",
    downloadingBreakdown: "PDF wird vorbereitet…",
    shareReceipt: "Quittung teilen",
    shareNative: "Auf dem Gerät teilen",
    sharingReceipt: "Freigabe wird geöffnet…",
    shareUnavailable: "Teilen ist nicht verfügbar. Bitte kopieren Sie den Quittungslink.",
    shareWhatsApp: "WhatsApp",
    shareTelegram: "Telegram",
    copyReceiptLink: "Quittungslink kopieren",
    linkCopied: "Quittungslink kopiert",
    sendReceiptEmail: "Quittung per E-Mail senden",
    receiptEmailPlaceholder: "ihre@email.com",
    sendingReceiptEmail: "Quittung wird gesendet…",
    receiptEmailSent: "Quittung wurde per E-Mail gesendet.",
    receiptEmailFailed: "Quittung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    receiptEmailCooldown: "Bitte warten Sie etwa eine Minute, bevor Sie die Quittung erneut anfordern.",
    checkoutSuccess: (total, formattedTotal = String(total)) => `Ihre Anfrage ist gespeichert. Fahren Sie mit der sicheren Krypto-Zahlung über ${formattedTotal} fort.`,
  },
  es: {
    localeLabel: "Idioma",
    questionsLabel: "Preguntas",
    questionsTitle: "Antes de reservar",
    footerBody: "Una lectura atenta de tu cielo interior.",
    footerNote: "Práctica interpretativa para la reflexión",
    navReading: "La lectura",
    navHow: "Cómo funciona",
    navFaq: "Preguntas",
    book: "Reservar lectura",
    badge: "Astrología védica · Jyotish",
    heroTitle: "Un mapa más claro para tu cielo interior.",
    heroBody: "Una lectura personalizada de tu carta natal védica, preparada con cuidado y entregada como un PDF detallado de varias páginas para la reflexión, el autoconocimiento y la exploración espiritual.",
    features: ["4 idiomas", "PDF de varias páginas", "Personal y estructurada"],
    highlightQuestions: "Una ronda de preguntas",
    rasiChart: "Carta Rasi",
    patternTitle: "Lee los patrones.",
    patternBody: "Una interpretación clara de los símbolos, las casas y las posiciones planetarias de tu carta.",
    basicLabel: "lectura básica",
    begin: "Comenzar lectura",
    explore: "Ver la lectura",
    offering: "El servicio",
    offeringTitle: "Una lectura para volver a ella.",
    offeringBody: "Tu carta se convierte en un documento sereno y fácil de leer, pensado para revisarlo y usarlo como punto de reflexión.",
    vedicDifferenceEyebrow: "Dos tradiciones, dos perspectivas",
    vedicDifferenceTitle: "Por qué la astrología védica puede ofrecer más detalle",
    vedicDifferenceBody: ["La astrología occidental y la védica son tradiciones interpretativas profundas, pero parten de marcos de referencia distintos. La mayoría de las escuelas occidentales utiliza el zodiaco tropical, vinculado a las estaciones. Jyotish emplea el zodiaco sideral, relacionado con el fondo de estrellas fijas, y aplica una ayanamsha para considerar la lenta precesión de los equinoccios. Esta lectura utiliza la ayanamsha Lahiri, una de las más extendidas.", "Los 27 nakshatras o mansiones lunares añaden otra capa. Cada uno se divide en cuatro padas, formando 108 secciones más precisas que permiten describir con mayor matiz cómo puede expresarse una posición. La dasha Vimshottari aporta además un modelo temporal tradicional: la carta natal no se observa como una imagen inmóvil, sino junto a períodos de vida en los que distintos temas planetarios pueden adquirir mayor relevancia.", "El valor no consiste en invalidar una tradición con la otra. Surge al integrar carta natal, períodos dasha y tránsitos actuales en una lectura coherente. El resultado es un marco más granular para la reflexión, no una promesa de certeza absoluta ni un sustituto del asesoramiento profesional."],
    basicTitle: "Lectura básica de carta védica",
    basicBody: "Una interpretación personal de tu carta natal Jyotish, centrada en posiciones planetarias, casas, fortalezas, tendencias y temas de reflexión.",
    optional: "Complemento opcional",
    addOn: "Numerología india y símbolos tradicionales",
    addOnBody: "Carta D9, cálculo e interpretación simbólica del camino de vida y número natal, y un plan de reflexión para el año personal.",
    process: "El proceso",
    processTitle: "Fácil de comenzar. Cuidado en la entrega.",
    steps: [
      {
        title: "Comparte tus datos de nacimiento",
        text: "Indica tu lugar, fecha y hora exacta de nacimiento. Estos datos influyen en la precisión y amplitud de la interpretación.",
      },
      {
        title: "Recibe tu lectura",
        text: "Tu interpretación personalizada se prepara como un PDF detallado de varias páginas en el idioma que prefieras.",
      },
      {
        title: "Vuelve a las ideas",
        text: "Lee a tu ritmo y plantea una ronda de preguntas de aclaración sobre el documento entregado.",
      },
    ],
    bookSection: "Reserva tu lectura",
    bookTitle: "Indica los datos correctos.",
    bookBody: "Necesitamos ciudad, país, fecha y hora exacta de nacimiento. Cuanto más precisos sean los datos, más completa y precisa será la interpretación.",
    name: "Nombre",
    email: "Correo electrónico",
    date: "Fecha de nacimiento",
    dateHint: "Indica tu fecha de nacimiento según el calendario local.",
    time: "Hora exacta de nacimiento",
    timeHint: "Indica la hora local de nacimiento con la mayor precisión posible, incluidos los minutos.",
    generatedAt: "Generado",
    city: "Ciudad de nacimiento",
    country: "País de nacimiento",
    language: "Idioma preferido",
    interest: "¿En qué te gustaría reflexionar?",
    request: "Solicitar mi lectura",
    optionalInterest: "Opcional: temas, preguntas o áreas de interés",
    placeholderName: "Tu nombre",
    placeholderCity: "Ciudad",
    placeholderCountry: "País",
    pdfReading: "Lectura en PDF",
    requestReading: "Solicitar lectura",
    birthDetails: "Tus datos de nacimiento",
    noteHeading: "Nota sobre la práctica.",
    faqs: [
      {
        question: "¿Qué datos debo proporcionar?",
        answer: "Indica tu lugar de nacimiento (ciudad y país), fecha y hora exacta. La precisión y amplitud dependen de que estos datos sean correctos.",
      },
      {
        question: "¿Qué recibiré?",
        answer: "Recibirás un PDF detallado de varias páginas con los temas principales de tu carta natal védica explicados con claridad.",
      },
      {
        question: "¿Qué incluye el complemento de numerología?",
        answer: "Incluye una carta D9, los cálculos y el método del camino de vida y número natal, interpretaciones simbólicas y un plan de reflexión para el año personal.",
      },
      {
        question: "¿Es asesoramiento médico, legal o financiero?",
        answer: "No. La astrología y la numerología son prácticas interpretativas para la reflexión y la exploración espiritual; no sustituyen el asesoramiento profesional.",
      },
    ],
    note: "La astrología y la numerología son prácticas interpretativas para la reflexión y la exploración espiritual, no asesoramiento médico, legal, financiero, psicológico ni profesional.",
    legalDisclaimer: "Aviso importante: este servicio se ofrece únicamente para la reflexión personal y la exploración espiritual. No constituye asesoramiento médico, legal, financiero, psicológico ni profesional, y no garantiza predicciones ni resultados concretos. Usted es responsable de sus decisiones. En la medida permitida por la ley aplicable, el autor y el operador no responden por decisiones o resultados basados en este material. Este aviso no limita los derechos imperativos de los consumidores ni la responsabilidad que legalmente no pueda excluirse.",
    successTitle: "Hemos recibido tu solicitud.",
    continueCheckout: "Continuar al pago cripto",
    anotherRequest: "Enviar otra solicitud",
    privacy: "Tus datos se utilizan solo para preparar y responder a tu solicitud. El proveedor de pago seleccionado procesa el pago en criptomonedas; este sitio no almacena claves privadas de wallets.",
    languageOptions: [
      { value: "English", label: "Inglés" },
      { value: "Русский", label: "Ruso" },
      { value: "Deutsch", label: "Alemán" },
      { value: "Español", label: "Español" },
    ],
    checkoutPending: "Creando tu pago seguro…",
    priceBreakdown: "Desglose del precio",
    priceBasic: "Lectura básica",
    priceBasicHint: "La interpretación principal de tu carta natal védica en un PDF detallado de varias páginas.",
    priceAddon: "Complemento de numerología india",
    priceAddonHint: "Carta D9 opcional, numerología de nacimiento con su método y reflexión sobre el año personal.",
    priceTotal: "Total",
    priceTotalHint: "El importe de los servicios seleccionados en la moneda indicada arriba.",
    priceAddonNotSelected: "No seleccionado",
    downloadBreakdown: "Descargar PDF del desglose del precio",
    downloadingBreakdown: "Preparando PDF…",
    shareReceipt: "Compartir recibo",
    shareNative: "Compartir en el dispositivo",
    sharingReceipt: "Abriendo el menú para compartir…",
    shareUnavailable: "No se puede compartir. Copia el enlace del recibo.",
    shareWhatsApp: "WhatsApp",
    shareTelegram: "Telegram",
    copyReceiptLink: "Copiar enlace del recibo",
    linkCopied: "Enlace del recibo copiado",
    sendReceiptEmail: "Enviar recibo por correo",
    receiptEmailPlaceholder: "tu@email.com",
    sendingReceiptEmail: "Enviando recibo…",
    receiptEmailSent: "Recibo enviado por correo.",
    receiptEmailFailed: "No se pudo enviar el recibo. Inténtalo de nuevo.",
    receiptEmailCooldown: "Espera aproximadamente un minuto antes de volver a solicitar el recibo.",
    checkoutSuccess: (total, formattedTotal = String(total)) => `Tu solicitud está guardada. Continúa con el pago cripto seguro de ${formattedTotal}.`,
  },
};
