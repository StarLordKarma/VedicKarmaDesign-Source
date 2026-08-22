# Этап два — развитие и масштабирование Vedic Astrology Booking

## Назначение

Этап два превращает текущий multilingual booking site в устойчивый сервис с повторными продажами, понятным клиентским кабинетом, управляемой delivery-инфраструктурой и готовностью к росту заказов. Документ предназначен для владельца проекта, разработчика или другой нейронной сети, которая будет продолжать работу с архивом этапа один.

Текущая база этапа один включает React 19 + Vite, Express + tRPC, Drizzle ORM + MySQL/TiDB, private S3-compatible storage, NOWPayments, Resend, Manus OAuth/owner gate, Heartbeat cleanup, receipt history/cooldown/alerts и локализацию EN/RU/DE/ES.

> Принцип этапа два: сначала безопасность и наблюдаемость, затем денежные и клиентские сценарии, затем автоматизация и масштабирование. Нельзя ускорять разработку удалением owner-only authorization, IPN verification, PDF privacy controls или backup discipline.

## Цели и критерии успеха

К концу этапа два пользователь должен пройти путь от выбора языка и заполнения birth details до оплаты, получения результата, просмотра статуса и повторного обращения без ручного вмешательства владельца в типовом случае. Владелец должен видеть очередь работ, delivery status, платежные исключения, backups и audit history в одном защищённом workspace.

| Область | Целевой результат |
|---|---|
| Надёжность | Повторяемые операции имеют idempotency keys, retries с backoff и понятные failure states |
| Клиентский опыт | Есть status page/клиентская ссылка, повторная отправка receipt и понятные локализованные статусы |
| Доход | Есть безопасные add-ons, promo/coupon rules и прозрачный pricing audit без скрытых изменений |
| Операции | Владелец получает alert по payment/email/backup failures и видит action queue |
| Данные | Database и private files имеют проверяемые независимые backups и restore drill |
| Масштабирование | Долгие PDF/email работы отделены от синхронного checkout request |
| Безопасность | Secrets server-only, admin полностью owner-gated, персональные данные минимизируются и удаляются по policy |
| Локализация | EN/RU/DE/ES синхронно покрывают UI, emails, PDFs, errors и legal copy |

## Приоритетная последовательность

### Фаза 2.0 — стабилизация и измеримость

Сначала добавь correlation ID для booking, payment, PDF, email и backup flows. Введи структурированные server logs без email, birth details, tokens, PDF contents и secrets. Подключи error tracking с masking персональных данных, health/readiness endpoint, slow-query logging и dashboard базовых метрик.

Добавь rate limits на public booking, receipt email, payment creation, IPN и export endpoints. Для каждого rate limit определи user/IP/email scope, response code, localized message и owner-visible event. Проверь, что proxy правильно передаёт client IP и что rate limiting не позволяет угадывать booking IDs.

**Definition of done:** владелец видит ошибки по correlation ID; тесты подтверждают отсутствие sensitive fields в logs; rate limits имеют regression coverage; health check не раскрывает secret/config details.

### Фаза 2.1 — клиентский статус и delivery queue

Создай безопасную client-facing status link с криптографически случайным, одноразовым или ограниченно действующим token. Не используй последовательный booking ID в URL. Клиент должен видеть payment state, preparation state, delivery state, email receipt state и дату следующего действия, но не внутренние notes, owner identity, database IDs или другие клиентов.

Перенеси PDF generation и email delivery в job-oriented flow. Синхронный request должен быстро создать job и вернуть status, а worker/Heartbeat handler должен выполнять генерацию, upload, email и retry. Используй idempotency key для каждого logical delivery; повторный callback не должен создавать второй invoice, второй PDF object или дубликат письма.

**Definition of done:** timeout provider не создаёт дубликаты; owner UI показывает queue; клиентская ссылка имеет expiry/revocation; каждое состояние покрыто EN/RU/DE/ES.

### Фаза 2.2 — улучшение продукта и повторные продажи

Добавь отдельные service packages с версионированным price snapshot: basic reading, numerology add-on, relationship/career themes и expedited delivery только после проверки фактической операционной способности. Цена заказа должна фиксироваться при создании booking и не меняться при последующем редактировании глобального прайс-листа.

Добавь промокоды только как серверные правила с периодом действия, лимитом использования, валютной политикой и audit trail. В UI всегда показывай обычную цену, скидку и итог. Не создавай фальшивые отзывы, ratings или testimonials. Для повторной покупки используй email consent и privacy-safe transactional messaging; marketing consent должен быть отдельным и добровольным.

Добавь клиентский order history только после внедрения безопасного account/link model. Дай пользователю скачать receipt и запросить resend без доступа к внутренней админке.

### Фаза 2.3 — owner operations workspace

Расширь Admin в операционную очередь: new bookings, unpaid/incomplete payments, paid-but-undelivered, failed email, expired files, pending owner action и backup health. Добавь bulk operations с явным confirmation, dry-run preview и limit per batch.

Добавь фильтры по SLA age, language, currency, payment state и delivery state. Сохрани audit event для каждой ручной операции: actor, timestamp UTC, target, before/after summary и result. Никогда не сохраняй access tokens или полные персональные данные в audit payload.

Добавь export profiles: financial CSV без лишних birth details, operational CSV с минимально необходимыми полями и legal/data-request export с явным confirmation. Все exports должны иметь срок действия и owner-only access.

### Фаза 2.4 — платежи, reconciliation и refunds

Сделай reconciliation job, который сравнивает локальный booking/payment state с provider data, не меняя статус автоматически без проверяемого правила. IPN/webhook handlers должны быть signature-verified, idempotent и защищены от replay. Сохраняй provider event ID и обработанный timestamp.

Добавь owner workflow для manual review: payment mismatch, underpayment, overpayment, expired invoice, duplicate callback и refund request. До реализации refunds проверь правила NOWPayments и юридические требования целевых стран; не обещай refund, который provider или policy не поддерживает.

### Фаза 2.5 — privacy, retention и legal operations

Создай отдельные страницы Privacy Notice, Terms of Service, Refund/Cancellation Policy и Contact/Complaints. Свяжи тексты с текущими EN/RU/DE/ES locale contracts. Версионируй acceptance text и сохраняй только timestamp, locale, policy version и минимальный identifier, необходимый для доказательства согласия.

Добавь owner-triggered data deletion/export workflow. Удали или анонимизируй booking, email attempts, logs и uploaded files по policy, учитывая финансовые и обязательные retention requirements. Receipt retention и natal PDF retention должны быть раздельными настройками.

Legal disclaimer должен оставаться ограниченным и честным: он объясняет interpretive/personal-reflection nature услуги, отсутствие профессиональной консультации и отсутствие гарантии результата, но не пытается отменить обязательные consumer rights или non-excludable liability. Перед коммерческим запуском отдай Terms, Privacy и Refund policy юристу в фактических jurisdictions.

### Фаза 2.6 — backups и disaster recovery

Активируй backup endpoint только после выбора независимого provider и добавления `BACKUP_*` secrets из инструкции этапа один. Ежедневно сохраняй encrypted database export/snapshot и versioned private object manifest. Используй отдельную identity с минимальными правами, retention 30–90 дней, checksum manifest и alert при отсутствии успешного backup.

Добавь ежемесячный staging restore drill. Проверяй не только наличие backup object, но и восстановление базы, representative natal PDF, receipt PDF, schema version и application compatibility. Храни RPO/RTO results и уведомляй владельца при превышении порога.

### Фаза 2.7 — масштабирование и cost control

До роста нагрузки измерь реальные bottlenecks. Добавь database indexes под фактические фильтры Admin, pagination everywhere, bounded query limits и select only needed columns. Не загружай PDF bytes в database и не возвращай их через tRPC, если достаточно private signed URL.

Для высокого объёма вынеси jobs в managed queue, используй concurrency limits, exponential backoff и dead-letter queue. Cache только безопасные immutable/public values; не кэшируй персональные booking responses без строгого key isolation. Для файлов включи lifecycle policies, но не удаляй объект до истечения legal/operational retention.

Frontend продолжай оптимизировать через route-level lazy loading, stable vendor chunks, compressed assets, responsive images, accessible loading states и bundle budget. Установи budget: initial JS, CSS, LCP, error rate, checkout conversion и email delivery success; любое превышение должно быть видимо в CI или release checklist.

## Рекомендуемая модель данных

Добавляй таблицы только вместе с migration, indexes, ownership rules и tests. Основные новые сущности: `payment_events` для provider callbacks; `delivery_jobs` для async PDF/email work; `client_access_tokens` для безопасных status links; `promo_codes` и `promo_redemptions`; `consent_records`; `data_requests`; `backup_runs`; `operational_alerts`.

Каждая сущность должна иметь UTC timestamps, created/updated actor policy, status enum и уникальный idempotency constraint там, где возможен повторный callback. Персональные поля должны иметь минимальный срок хранения и не попадать в analytics events.

## Секреты второго этапа

Новые credentials добавляй только через platform secret manager. Помимо существующих secrets, вероятно понадобятся:

| Secret | Когда нужен | Правило |
|---|---|---|
| `BACKUP_S3_*` | Внешние database/file backups | Отдельный private bucket и least privilege |
| `BACKUP_ENCRYPTION_KEY` | Шифрование экспортов | KMS/Vault preferred, rotation documented |
| `ERROR_TRACKING_DSN` | Error tracking | DSN без server secrets и без PII payload |
| `QUEUE_CONNECTION_URL` | Managed job queue | Только server-side |
| `QUEUE_SIGNING_SECRET` | Подпись worker callbacks | Rotate and never log |
| `STATUS_LINK_SIGNING_SECRET` | Client status tokens | Отдельный secret, не reuse JWT |
| `ANALYTICS_WRITE_KEY` | Privacy-safe analytics | Не отправлять birth details/email |

Перед production rollout создай staging secrets отдельно от production. Ротация должна проходить через add-new → test → switch → revoke-old. Для каждого secret зафиксируй владельца, provider, дату последней ротации, scope и процедуру восстановления.

## Roadmap по релизам

| Release | Состав | Gate перед следующим release |
|---|---|---|
| 2.0.0 | Observability, rate limits, health checks, correlation IDs, privacy-safe logs | Security tests, no PII logs, baseline metrics |
| 2.1.0 | Delivery jobs, idempotency, status link, resend workflow | Duplicate/retry tests, mobile verification |
| 2.2.0 | Packages, promo rules, client history, operational queue | Price snapshot tests, owner audit and export review |
| 2.3.0 | Reconciliation, refund/manual review, backup activation | Provider sandbox, restore drill, alert drill |
| 2.4.0 | Privacy pages, data requests, queue scaling, performance budget | Legal review, load test, rollback rehearsal |

Каждый release должен иметь migration plan, backward-compatible API period, test report, rollback point, updated restore instructions и explicit owner acceptance. Не объединяй database schema migration, payment behavior change и large UI rewrite в один неотслеживаемый release.

## План тестирования

Минимальный CI pipeline должен выполнять `pnpm check`, `pnpm test`, `pnpm build`, migration validation, secret-scan, dependency audit и smoke tests. Добавь contract tests для tRPC procedures, authorization matrix tests для owner/non-owner/anonymous, provider failure tests, idempotency tests, localization snapshot tests и PDF text extraction tests.

Для production-like staging проверь payment creation, signed IPN, receipt/email delivery, cooldown, retry, backup creation, restore, cleanup, expiry, CSV export, timezone/date formatting и mobile keyboard flow. Используй test markers и automatic cleanup; не загрязняй production business data.

## Rollback и аварийные сценарии

Для каждой миграции сначала сделай database backup, затем deploy backward-compatible code, затем migrate, затем enable feature flag. Если ошибка обнаружена, выключи feature flag и откати приложение через checkpoint/deployment rollback; destructive database rollback выполняй только после отдельной backup verification.

При проблеме payment provider останови только новые checkout attempts, не удаляй существующие bookings и не меняй paid status без reconciliation. При проблеме storage отключи новые uploads/delivery, сохрани metadata и восстанови объект из independent backup. При проблеме email оставь job retryable, показывай owner alert и не создавай дубликат при повторной отправке.

## Prompt для другой нейронной сети

> Используй архив этапа один и этот документ как specification для Stage Two. Сначала составь inventory текущих routes, tRPC procedures, tables, storage keys, cron jobs, secrets и tests. Не придумывай provider capabilities или credentials. Предложи migration-first implementation plan и раздели работу на releases 2.0.0–2.4.0. Сначала реализуй observability, authorization matrix, rate limiting и idempotency; затем delivery jobs/status links; затем product packages/promo/reconciliation; затем privacy/backup/scale. Каждое изменение должно иметь schema migration, server helper, tRPC contract, UI state, localization EN/RU/DE/ES, regression tests, rollback note и acceptance criteria. Не публикуй secrets, не отключай owner gate, не добавляй fake reviews/testimonials, не храни PDF bytes в database и не активируй scheduled backup без независимого destination. Перед production migration создай backup и staging restore drill. В финале выдай таблицу restored/implemented, requires secret, requires external provider, requires legal review, requires owner decision.

## Итоговая проверка этапа два

Перед выпуском проверь: owner-only Admin, all public flows, localized UI/emails/PDFs, provider callbacks, rate limits, idempotency, queue retries, private storage, backup checksum and restore, expiry cleanup, data deletion/export, legal pages, accessibility, bundle budget, error tracking masking, mobile layouts and rollback procedure. Только после этого обнови архив этапа один, этот roadmap и checksum.

Дата подготовки: 2026-08-23.
