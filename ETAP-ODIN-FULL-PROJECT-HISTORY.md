# Полная история формирования проекта

## Назначение документа

Этот документ описывает, как формировался проект `vedic-astrology-booking`, какие продуктовые решения были приняты, какие функции реализованы, какие проверки проведены и что вошло в текущую резервную копию. Он предназначен для владельца проекта, разработчика, DevOps-инженера или другой нейронной сети, которой потребуется понять происхождение и состояние системы.

## 1. Исходная продуктовая идея

Изначально проект задумывался как multilingual-сайт для удалённой работы и профессиональных услуг, а затем был сфокусирован на услуге ведической астрологии. Клиент должен выбрать уровень разбора, указать имя, email, дату, точное местное время и место рождения, выбрать валюту и дополнительные услуги, после чего оплатить заказ криптовалютой и получить подробный PDF-отчёт.

Целевые языки пользовательского интерфейса и документов — русский, английский и немецкий. В публичной части также сохранена поддержка испанской локализации, сформированная на предыдущем этапе. Административная часть предназначена только для владельца.

## 2. Этап One: booking, цены и платежи

Была создана full-stack архитектура на React 19, Vite, Tailwind CSS, Express, tRPC, Drizzle ORM и MySQL/TiDB. Публичная страница получила форму заявки, выбор пакета Basic/Basic+, динамические цены и валюты USD/EUR/GBP, локализованную разбивку стоимости и подсказки для даты, времени и составляющих цены.

В проект добавлен crypto checkout через NOWPayments. Payment flow включает создание checkout, подтверждение статуса через webhook/IPN, проверку подписи и защиту от повторной обработки callback. Smoke-test помечает тестовые заявки и удаляет их после выполнения.

## 3. Email, receipts и storage

Добавлена отправка email через Resend. Сайт формирует локализованные PDF receipts с разбивкой стоимости, хранит PDF в S3-compatible storage и не помещает бинарные файлы в базу данных. Receipt metadata содержит storage key, время создания и expiry.

Для receipts реализованы retention 24/48/72 часа, ежедневная очистка через Heartbeat endpoint, ручная очистка владельцем, Web Share API, ссылки для копирования и fallback-отправка через мессенджеры. Email receipt flow имеет cooldown, журнал попыток, статусы sent/failed и owner notification при повторяющихся ошибках.

## 4. Owner-only administration

Административная панель ограничена `OWNER_OPEN_ID` и не полагается только на скрытие ссылки в интерфейсе. Владелец может просматривать заявки, менять статусы, редактировать данные, оставлять заметки, прикреплять и отправлять PDF, просматривать историю изменений, фильтровать и искать клиентов, экспортировать CSV/PDF, использовать пагинацию и выполнять массовую доставку.

В отдельные owner-only разделы вошли activity dashboard, failed-delivery retry, date-range filters, export activity CSV, настройки timezone/date format, история изменения цен, preview цен, журнал smoke tests, фильтры и массовое скачивание JSON.

## 5. Legal disclaimer and backup work

Во все соответствующие языковые версии публичного интерфейса, receipts, email templates и natal-chart delivery были добавлены осторожные информационные дисклеймеры. Они описывают интерпретационный характер услуги и не формулируют медицинских, юридических, финансовых или гарантированных обещаний.

Был подготовлен Stage One backup package. В него входят исходники, миграции, документация, restoration guide, research notes, checksum и roadmap. Секреты, production database, cookies, S3 bytes и доменное управление намеренно не включаются.

## 6. Stage Two: Report Studio specification

Для автоматического формирования natal reports была утверждена hybrid-модель: расчёты выполняются детерминированно на сервере, AI формирует только осторожное текстовое описание на основе validated facts JSON, а владелец проверяет и утверждает PDF перед отправкой.

Архитектурная спецификация определила таблицы `report_jobs`, `calculation_snapshots`, `calculation_results`, `narrative_drafts`, `report_versions`, `report_sections`, `report_delivery_attempts` и `report_audit_events`. Статусная модель разделяет payment confirmation, queue, calculation, narrative, rendering, review, approval, sending, sent и failure states.

## 7. Calculation adapter

Были исследованы бесплатные и permissive alternatives. Для требуемых Lahiri sidereal, D1/D9 и Vimshottari расчётов выбран server-side Swiss Ephemeris binding `sweph` с AGPL/LGPL licensing notice. Опубликованный пакет `openastrology-library` оказался неполным для production runtime, поэтому он не используется как основной executable path.

`VedicAstrologyCalculator` реализует reproducible JSON contract `vedic-report-calculation/v1`, UTC/JD нормализацию, sidereal Lahiri, D1/Rāśi, D9/Navāṁśa, planetary positions, nakshatra/pada, retrograde flag и Vimshottari periods. Production client delivery остаётся gated by owner workflow and benchmark coverage.

## 8. Payment-to-report queue and worker

После первого verified successful payment создаётся идемпотентный `report_job`. Повторный webhook не создаёт дубликат благодаря unique idempotency key. Worker автоматически разрешает город и страну в координаты, IANA timezone и birth-time offset через configured Maps proxy, сохраняет provenance/quality flags, запускает deterministic calculation, создаёт validated narrative draft и готовит PDF preview.

Автоматическая обработка новых jobs управляется persistent owner-only setting и по умолчанию выключена. При выключенном toggle задача остаётся в очереди для ручного запуска. Ошибки расчёта, геокодирования, AI или rendering переводят job в retryable failure state и не должны ломать payment webhook.

## 9. Geocoding and timezone

Worker использует введённые город и страну как исходные данные, получает latitude/longitude, formatted address, IANA timezone и offset для конкретных даты/времени рождения. В calculation snapshot сохраняются source, timezone, location type, warnings и input hash. Это позволяет владельцу проверять неоднозначные результаты до утверждения.

## 10. AI narrative layer

AI не рассчитывает положения планет и не имеет права менять facts. Structured request использует JSON Schema `vedic-narrative.v1`, exact fact references, разделы, paragraphs, warnings, locale и disclaimer key. Server-side validation проверяет существование referenced facts, длину текста и запрещённые medical/legal/financial/guarantee claims.

Текущий owner может выбирать allowlisted model: `gpt-5-nano`, `gpt-5-mini`, `gpt-5`, `claude-haiku-4-5`, `claude-sonnet-4-6` или `gemini-3-flash-preview`. Настраиваются `maxTokens` от 1000 до 12000, `maxSections` от 1 до 12 и `maxParagraphChars` от 300 до 1800. Значения проверяются на сервере и сохраняются вместе с provenance фактически использованной модели.

## 11. PDF Report Studio

Одностраничный visual prototype был расширен до 22 страниц для Basic и 25 страниц для Basic+. Макет использует светлое editorial-направление Parasara Light 9, локализованные заголовки, narrative sections, validated fact references, метод расчёта и disclaimer.

В PDF добавлены vector North Indian-style panels для D1/Rāśi и D9/Navāṁśa. Панели показывают 12 house/sign cells, Ascendant, сокращённые названия планет и градусы, вычисленные из validated JSON. D9 включается в Basic+.

## 12. Owner review and delivery

Report Studio доступен на `/admin/report-studio`. Владелец видит очередь, данные клиента, status, automatic location resolution, AI narrative draft с fact references, PDF preview и approval note. До approval письмо клиенту не отправляется.

После approval approved PDF передаётся в Resend с private storage fetch, attachment size limit, локализованным текстом, delivery attempt metadata, provider response и audit event. Manual resend разрешён только если текущая задача находится в `delivery_failed`; успешная отправка защищена idempotency.

## 13. Проверки и качество

В репозитории присутствуют unit и integration tests для authentication, booking, pricing, payments, NOWPayments, receipts, Resend, retention, admin access, Report Studio queue, calculations, geocoding, narrative validation, PDF page count и UI. Последняя проверка текущего состояния: TypeScript check успешен, полный Vitest suite — 114 passed и 1 credential test skipped, production build успешен, mobile Report Studio preview проверен.

В проекте также сохранены 17 Drizzle migrations, включая Report Studio schema и persistent AI processing settings. Текущая опубликованная версия перед упаковкой — checkpoint `5973ed1c`; после создания обновлённого backup package архив получает собственный timestamp и checksum.

## 14. Что ещё не следует считать завершённым

Необходимо отдельно провести реальные benchmark runs на выбранных reference charts, проверить ambiguous city matches, протестировать Resend/NOWPayments на production-like credentials, выполнить restore drill из backup и проверить юридические/лицензионные обязанности конкретной deployment-модели. Полный PDF сейчас является функциональным многостраничным renderer, но содержание narrative зависит от качества AI draft и owner review.

> Архив является переносимой копией исходников и документации, а не backup production data. Для полного восстановления нужны отдельные database export, object-storage backup, secrets и OAuth/provider configuration.
