export const GUIDE_PATHS = ["/guides/unknown-birth-time", "/guides/vedic-and-western", "/guides/tarot-reflection"] as const;
type Language = "en" | "ru" | "de" | "es";
type Guide = { title: string; description: string; paragraphs: string[]; view: "western" | "vedic" | "tarot" };
export const guideUi = {
  en: { label: "Reading guides", home: "Explore readings", sample: "View a fictional sample", note: "Automated symbolic readings for reflection. Not a scientific prediction or professional consultation. Payment is cryptocurrency-only; check the currency, network and total at checkout.", privacy: "Privacy", refunds: "Payments and refunds" },
  ru: { label: "Как выбрать разбор", home: "Посмотреть разборы", sample: "Посмотреть вымышленный образец", note: "Автоматизированные символические разборы для размышления. Не научный прогноз и не профессиональная консультация. Оплата только криптовалютой: проверьте валюту, сеть и сумму при оформлении.", privacy: "Конфиденциальность", refunds: "Оплата и возвраты" },
  de: { label: "Ratgeber zu den Deutungen", home: "Deutungen entdecken", sample: "Fiktives Muster ansehen", note: "Automatisierte symbolische Deutungen zur Reflexion. Keine wissenschaftliche Vorhersage oder persönliche Fachberatung. Zahlung ausschließlich mit Kryptowährung; Währung, Netzwerk und Gesamtbetrag im Checkout prüfen.", privacy: "Datenschutz", refunds: "Zahlungen und Erstattungen" },
  es: { label: "Guías para elegir una lectura", home: "Explorar lecturas", sample: "Ver una muestra ficticia", note: "Interpretaciones simbólicas automatizadas para la reflexión. No son predicciones científicas ni consultas profesionales. Pago exclusivamente con criptomonedas: comprueba moneda, red e importe al realizar el pedido.", privacy: "Privacidad", refunds: "Pagos y reembolsos" },
};
export const readingGuides: Record<Language, Guide[]> = {
  en: [
    { title: "An astrology reading without a known birth time", description: "What changes when your birth time is unknown, which details are omitted and how to inspect a sample before ordering.", view: "western", paragraphs: [
      "Separate known details from guesses. If you know your birth date and city but not the time, do not enter a random hour just to complete a form. A polished PDF does not remove uncertainty in its starting information.",
      "Within astrological practice, birth time is used to determine houses and the ascendant. Our Western reading offers an unknown-time option: houses and the ascendant are omitted and uncertain placements are explained. Check the requirements of your chosen product; this option does not imply that every reading supports missing times.",
      "First check any available birth records or family notes. If no reliable time is available, say so. Inspect the fictional sample to assess the layout and writing style. It is a demonstration, not your personal result or evidence of predictive accuracy.",
      "The report is prepared automatically and read independently, rather than discussed in a one-to-one consultation. Public questions about its format do not require sharing your full birth details or a private order link on a forum.",
    ] },
    { title: "Choosing between Vedic and Western astrology PDFs", description: "Compare the formats of our Vedic and Western readings before choosing a report.", view: "vedic", paragraphs: [
      "Vedic and Western astrology are different interpretive traditions. Do not assume that two reports use the same zodiac, chart conventions or period system, or that different labels necessarily indicate an input error. Compare the stated method as well as the birth details.",
      "Karma Life Design offers a Vedic birth-chart report and an extended option. The Western section offers a personal overview and separate daily and monthly readings. These are different products, rather than interchangeable names for the same document.",
      "Choose according to the format you want to read: a broader natal exploration or a shorter period-focused reflection. Inspect each fictional sample and the actual product description. The sample shows selected pages and does not promise that your report will match its interpretation.",
      "Calculation and text preparation are automated. Astrology is presented here as a symbolic interpretive practice, not an established way to predict events or make medical, legal or financial decisions. Check the price and crypto payment conditions before submitting an order.",
    ] },
    { title: "Using three Tarot cards as prompts for reflection", description: "How to frame a question around your own choices and understand the limits of an automated Tarot reading.", view: "tarot", paragraphs: [
      "A useful question leaves room for your own decisions. Instead of asking what another person secretly thinks, consider what you notice in the situation, what remains unclear and what conversation you could begin.",
      "Our three-card format offers a symbolic perspective on the situation, a less obvious influence and a possible next step. The automated interpretation does not establish facts about another person or guarantee what will happen.",
      "Read the text as a prompt, then separate observation from interpretation. Write down one question to investigate and one small action you can choose yourself. You can disagree with a passage rather than making events fit it.",
      "The fictional sample lets you inspect the style before buying. This is not a personal consultation or a substitute for professional advice. Do not use the cards to determine health outcomes or investment decisions, and do not post private order links publicly.",
    ] },
  ],
  ru: [
    { title: "Астрологический разбор, если время рождения неизвестно", description: "Какие разделы исключаются без времени рождения и как проверить формат отчёта до покупки.", view: "western", paragraphs: [
      "Отделите известные данные от предположений. Если вы знаете дату и город рождения, но не время, не вводите случайные часы ради заполнения анкеты. Красивый PDF не устраняет неопределённость исходной информации.",
      "В астрологической практике время используют для определения домов и восходящей точки. В нашем западном разборе есть вариант с неизвестным временем: дома и восходящая точка исключаются, а неопределённые положения поясняются. Проверяйте требования выбранного продукта — эта возможность не означает, что любой отчёт поддерживает отсутствие времени.",
      "Сначала проверьте доступные записи о рождении или семейные заметки. Если надёжного времени нет, так и укажите. Вымышленный образец помогает оценить оформление и стиль текста, но не показывает ваш будущий результат и не доказывает точность прогнозов.",
      "Отчёт готовится автоматически для самостоятельного чтения, а не для личной беседы с астрологом. Для публичного вопроса о формате не нужно раскрывать полные данные рождения или приватную ссылку на заказ.",
    ] },
    { title: "Как выбрать между ведическим и западным разбором", description: "Сравните форматы ведических и западных PDF перед выбором отчёта.", view: "vedic", paragraphs: [
      "Ведическая и западная астрология — разные интерпретационные традиции. Не стоит предполагать, что два отчёта используют один зодиак, одинаковые правила карты и систему периодов. Различия названий не обязательно означают ошибку ввода: проверяйте заявленный метод и исходные данные.",
      "В Karma Life Design есть основной и расширенный ведические отчёты. В западном разделе доступны личный обзор, отдельный прогноз на день и отдельный прогноз на месяц. Это разные продукты, а не взаимозаменяемые названия одного документа.",
      "Выбирайте по желаемому формату чтения: подробное знакомство с натальной картой или более короткое размышление о выбранном периоде. Посмотрите вымышленные образцы и описание конкретного продукта. Образец показывает избранные страницы и не обещает такую же интерпретацию для ваших данных.",
      "Расчёт и подготовка текста автоматизированы. Здесь астрология представлена как символическая практика, а не достоверный способ предсказывать события или принимать медицинские, правовые и финансовые решения. До заказа проверьте цену и условия криптооплаты.",
    ] },
    { title: "Три карты Таро как вопросы к себе", description: "Как сформулировать вопрос о собственном выборе и понимать ограничения автоматизированного расклада.", view: "tarot", paragraphs: [
      "Полезный вопрос оставляет место вашему решению. Вместо попытки узнать чужие тайные мысли можно спросить: что я замечаю в ситуации, что остаётся непонятным и какой разговор могу начать?",
      "Наш формат трёх карт предлагает символический взгляд на ситуацию, менее заметное влияние и возможный следующий шаг. Автоматизированная интерпретация не устанавливает факты о другом человеке и не гарантирует будущее.",
      "Прочитайте текст как приглашение к размышлению, затем отделите наблюдения от толкования. Запишите один вопрос для проверки и одно небольшое действие, которое выбираете сами. Не обязательно соглашаться с каждым абзацем или подгонять под него события.",
      "Вымышленный образец позволяет оценить стиль до покупки. Это не персональная консультация и не замена профессиональной помощи. Не используйте карты для определения исходов болезней или инвестиционных решений; приватные ссылки заказов не публикуйте.",
    ] },
  ],
  de: [
    { title: "Astrologische Deutung ohne bekannte Geburtszeit", description: "Welche Angaben ohne Geburtszeit fehlen und wie Sie vor dem Kauf ein Berichtsmuster prüfen können.", view: "western", paragraphs: [
      "Trennen Sie bekannte Angaben von Vermutungen. Wenn Sie Geburtsdatum und Geburtsort kennen, aber keine Uhrzeit, tragen Sie nicht einfach eine beliebige Stunde ein. Ein schön gestaltetes PDF beseitigt keine Unsicherheit in den Ausgangsdaten.",
      "In der astrologischen Praxis wird die Uhrzeit unter anderem zur Bestimmung der Häuser und des Aszendenten verwendet. Unsere westliche Deutung bietet eine Option für unbekannte Geburtszeiten: Häuser und Aszendent entfallen, unsichere Positionen werden erläutert. Prüfen Sie die Anforderungen des gewählten Produkts; diese Möglichkeit gilt nicht automatisch für jeden Bericht.",
      "Sehen Sie zunächst in vorhandenen Geburtsunterlagen oder familiären Notizen nach. Ist keine verlässliche Uhrzeit verfügbar, geben Sie das an. Ein fiktives Muster zeigt Gestaltung und Schreibstil, nicht Ihr persönliches Ergebnis oder einen Nachweis von Vorhersagegenauigkeit.",
      "Der Bericht wird automatisch zum selbständigen Lesen erstellt. Es findet kein persönliches Beratungsgespräch statt. Für eine öffentliche Frage zum Format müssen Sie weder vollständige Geburtsdaten noch einen privaten Bestelllink in einem Forum veröffentlichen.",
    ] },
    { title: "Vedische oder westliche Astrologie: Welches PDF passt?", description: "Vergleichen Sie die Formate der vedischen und westlichen Berichte vor Ihrer Auswahl.", view: "vedic", paragraphs: [
      "Vedische und westliche Astrologie sind unterschiedliche Deutungstraditionen. Zwei Berichte verwenden nicht zwangsläufig denselben Tierkreis, dieselben Darstellungsregeln oder dasselbe Periodensystem. Unterschiedliche Bezeichnungen bedeuten daher nicht automatisch einen Eingabefehler. Vergleichen Sie auch die angegebene Methode.",
      "Karma Life Design bietet einen vedischen Geburtsbericht und eine erweiterte Variante. Im westlichen Bereich gibt es einen persönlichen Überblick sowie eigenständige Tages- und Monatsdeutungen. Es handelt sich um unterschiedliche Produkte, nicht um austauschbare Namen für dasselbe Dokument.",
      "Wählen Sie nach dem gewünschten Leseformat: eine ausführlichere Beschäftigung mit dem Geburtshoroskop oder eine kürzere, zeitbezogene Reflexion. Prüfen Sie die fiktiven Muster und die jeweilige Produktbeschreibung. Die Muster zeigen ausgewählte Seiten und versprechen keine identische persönliche Deutung.",
      "Berechnung und Textaufbereitung erfolgen automatisiert. Astrologie dient hier als symbolische Deutungspraxis, nicht als gesicherte Ereignisvorhersage oder Grundlage für medizinische, rechtliche oder finanzielle Entscheidungen. Prüfen Sie vor der Bestellung Preis und Bedingungen der Kryptozahlung.",
    ] },
    { title: "Drei Tarotkarten als Anregung zur Selbstreflexion", description: "Eine Frage zum eigenen Handlungsspielraum formulieren und die Grenzen einer automatisierten Tarotdeutung verstehen.", view: "tarot", paragraphs: [
      "Eine hilfreiche Frage lässt Raum für Ihre eigenen Entscheidungen. Fragen Sie statt nach geheimen Gedanken anderer Menschen lieber: Was nehme ich wahr, was ist noch unklar und welches Gespräch könnte ich beginnen?",
      "Unser Drei-Karten-Format bietet eine symbolische Perspektive auf die Situation, einen weniger sichtbaren Einfluss und einen möglichen nächsten Schritt. Die automatisierte Deutung stellt keine Tatsachen über andere Personen fest und garantiert keine zukünftigen Ereignisse.",
      "Nutzen Sie den Text als Denkanstoß und unterscheiden Sie Beobachtung und Interpretation. Notieren Sie eine Frage, die Sie überprüfen möchten, und eine kleine Handlung, die Sie selbst wählen. Sie dürfen einer Passage widersprechen, statt Erlebnisse passend zu machen.",
      "Das fiktive Muster hilft Ihnen, den Stil vor dem Kauf einzuschätzen. Es ersetzt weder persönliche Beratung noch professionelle Hilfe. Verwenden Sie die Karten nicht zur Beurteilung von Krankheitsverläufen oder Anlageentscheidungen. Private Bestelllinks gehören nicht in öffentliche Beiträge.",
    ] },
  ],
  es: [
    { title: "Una lectura astrológica sin conocer la hora de nacimiento", description: "Qué cambia sin una hora de nacimiento fiable y cómo revisar una muestra antes de comprar.", view: "western", paragraphs: [
      "Distingue los datos conocidos de las suposiciones. Si conoces la fecha y la ciudad de nacimiento, pero no la hora, no introduzcas una hora al azar solo para completar el formulario. Un PDF bien presentado no elimina la incertidumbre de los datos iniciales.",
      "En la práctica astrológica, la hora se utiliza para determinar las casas y el ascendente. Nuestra lectura occidental ofrece una opción para horas desconocidas: se omiten las casas y el ascendente y se explican las posiciones inciertas. Comprueba los requisitos del producto elegido; esta opción no significa que todos los informes admitan la falta de hora.",
      "Revisa primero los registros de nacimiento o las notas familiares disponibles. Si no encuentras una hora fiable, indícalo. La muestra ficticia permite evaluar el diseño y el estilo del texto, pero no muestra tu resultado personal ni demuestra precisión predictiva.",
      "El informe se prepara automáticamente para leerlo por tu cuenta, no mediante una conversación individual con un astrólogo. Para preguntar públicamente por el formato no hace falta publicar todos tus datos de nacimiento ni un enlace privado de tu pedido.",
    ] },
    { title: "Cómo elegir entre astrología védica y occidental", description: "Compara los formatos de nuestros PDF védicos y occidentales antes de elegir un informe.", view: "vedic", paragraphs: [
      "La astrología védica y la occidental son tradiciones interpretativas distintas. Dos informes no tienen por qué utilizar el mismo zodiaco, las mismas convenciones de carta o el mismo sistema de periodos. Las diferencias de nombres no indican necesariamente un error: compara también el método declarado.",
      "Karma Life Design ofrece un informe natal védico y una opción ampliada. La sección occidental incluye un panorama personal y lecturas independientes para el día y el mes. Son productos diferentes, no nombres intercambiables del mismo documento.",
      "Elige según el formato que quieres leer: una exploración natal más amplia o una reflexión breve sobre un periodo. Revisa las muestras ficticias y la descripción de cada producto. Una muestra presenta páginas seleccionadas y no promete la misma interpretación para tus datos.",
      "El cálculo y la preparación del texto son automatizados. Aquí la astrología se presenta como una práctica simbólica, no como un método comprobado para predecir sucesos o tomar decisiones médicas, jurídicas o financieras. Antes del pedido, revisa el precio y las condiciones del pago con criptomonedas.",
    ] },
    { title: "Tres cartas del tarot como preguntas para reflexionar", description: "Cómo formular una pregunta sobre tus propias decisiones y comprender los límites de una lectura automatizada.", view: "tarot", paragraphs: [
      "Una pregunta útil deja espacio para tus propias decisiones. En vez de intentar conocer los pensamientos secretos de otra persona, puedes preguntar qué observas, qué sigue sin estar claro y qué conversación podrías iniciar.",
      "Nuestro formato de tres cartas propone una perspectiva simbólica sobre la situación, una influencia menos visible y un posible siguiente paso. La interpretación automatizada no establece hechos sobre otras personas ni garantiza sucesos futuros.",
      "Lee el texto como una invitación a reflexionar y separa observación e interpretación. Anota una pregunta que puedas investigar y una acción pequeña que elijas por ti mismo. Puedes discrepar de un párrafo sin intentar que tus experiencias encajen en él.",
      "La muestra ficticia permite valorar el estilo antes de comprar. No es una consulta individual ni sustituye la ayuda profesional. No utilices las cartas para determinar resultados médicos o decisiones de inversión y no compartas enlaces privados de pedidos en público.",
    ] },
  ],
};
export function readingGuide(path: string, locale: Language) {
  const index = GUIDE_PATHS.indexOf(path as typeof GUIDE_PATHS[number]);
  return index < 0 ? undefined : readingGuides[locale][index];
}
