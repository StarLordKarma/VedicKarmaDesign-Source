# Этап один — восстановление Vedic Astrology Booking

## Назначение

Этот документ предназначен для другой нейронной сети, разработчика или DevOps-инженера. Он должен использоваться вместе с архивом исходного кода `vedic-astrology-booking-source.tar.gz`. Цель — восстановить сайт с теми же основными функциями на Manus WebDev, VPS, Docker-хостинге или другой Node.js-платформе.

> Важно: архив исходного кода не содержит секреты, cookies, production-базу данных, содержимое S3/storage или управление доменом. Поэтому он является переносимой копией кода и конфигурации, но не полной копией данных. Для полноценного восстановления данных потребуются отдельные экспорт базы данных, backup файлового хранилища и повторный ввод секретов.

## 1. Сначала изучи архив

Распакуй архив в новый каталог и не запускай неизвестные скрипты до проверки содержимого. Прочитай `README.md`, `package.json`, `drizzle/schema.ts`, `drizzle/migrations/`, `server/_core/env.ts`, `server/routers.ts`, `server/db.ts`, `server/client-delivery.ts`, `server/receipt-retention.ts`, `client/src/App.tsx`, `client/src/pages/Home.tsx` и `client/src/pages/Admin.tsx`. Проверь, что архив не содержит файлов `.env`, приватных ключей, JWT, cookies, production database dumps или credentials.

Проект представляет собой full-stack приложение: React 19 + Vite на клиенте, Express + tRPC на сервере, Drizzle ORM + MySQL/TiDB для базы данных, S3-compatible storage для PDF-файлов, Manus OAuth для входа владельца, NOWPayments для crypto checkout и Resend для email-доставки.

## 2. Требуемое окружение

Используй Node.js 20 или новее, pnpm 10.x, Git и MySQL 8/TiDB-compatible database. Для production-сервера необходим HTTPS, корректный reverse proxy и переменная `PORT`, которую приложение получает от платформы. Не фиксируй port в коде.

Установи зависимости и проверь проект:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Локальный запуск:

```bash
pnpm dev
```

Production-запуск после сборки:

```bash
pnpm build
pnpm start
```

## 3. Переменные окружения и секреты

Создай секреты в панели выбранной платформы, secret manager или `.env` только локально. Никогда не добавляй реальные значения в Git или в публичный архив. Названия должны соответствовать фактическому использованию в `server/_core/env.ts`.

| Переменная | Назначение | Обязательность |
|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string с SSL в production | Обязательно |
| `JWT_SECRET` | Подпись session cookies | Обязательно |
| `OWNER_OPEN_ID` | Единственный OpenID владельца для admin authorization | Обязательно |
| `OWNER_NAME` | Отображаемое имя владельца и audit history | Обязательно |
| `VITE_APP_ID` | OAuth application ID | Для Manus OAuth |
| `OAUTH_SERVER_URL` | OAuth backend base URL | Для Manus OAuth |
| `VITE_OAUTH_PORTAL_URL` | OAuth login portal URL | Для Manus OAuth |
| `BUILT_IN_FORGE_API_URL` | Server-side Manus APIs, storage/notification helpers | При использовании Manus services |
| `BUILT_IN_FORGE_API_KEY` | Server-side Manus API key | При использовании Manus services |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend Manus API URL | При использовании frontend helpers |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key | При использовании frontend helpers |
| `NOWPAYMENTS_API_KEY` | Создание crypto invoices | Для crypto payments |
| `NOWPAYMENTS_IPN_SECRET` | Проверка NOWPayments IPN signatures | Для crypto payments |
| `RESEND_API_KEY` | Отправка email | Для email delivery |
| `RESEND_FROM_EMAIL` | Verified sender address | Для email delivery |
| `VITE_APP_TITLE` | Название сайта | Рекомендуется |
| `VITE_APP_LOGO` | URL логотипа | Опционально |
| `VITE_ANALYTICS_ENDPOINT` | Analytics endpoint | Опционально |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website ID | Опционально |

### 3.1 Безопасная настройка секретов

Используй secret manager выбранной платформы: Manus Secrets, Render Environment Groups, Railway Variables, Fly.io secrets, Docker Swarm/Kubernetes Secrets, GitHub Actions Encrypted Secrets или Vault/1Password Secrets Automation. В production не храни секреты в `.env` внутри сервера, Docker image, Git, архиве, issue, screenshots или командной строке.

Настрой секреты в следующем порядке: сначала `DATABASE_URL` и `JWT_SECRET`, затем `OWNER_OPEN_ID`/`OWNER_NAME`, OAuth values, private storage credentials, NOWPayments, Resend и только потом optional analytics values. Server-only keys (`DATABASE_URL`, `JWT_SECRET`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_KEY`, `NOWPAYMENTS_*`, `RESEND_API_KEY`, backup credentials) не должны иметь префикс `VITE_`; всё с `VITE_` потенциально попадает в browser bundle и должно считаться публичным.

После добавления каждого secret выполни deployment/restart и проверь только факт наличия, не выводя значение:

```bash
node -e 'for (const k of ["DATABASE_URL","JWT_SECRET","OWNER_OPEN_ID","NOWPAYMENTS_API_KEY","RESEND_API_KEY"]) console.log(k, Boolean(process.env[k]))'
pnpm check
pnpm test
pnpm build
```

Не логируй `process.env`, connection strings, Authorization headers или email API keys. Для ротации создай новый credential у провайдера, добавь его как новую версию secret, выполни smoke test, затем отзови старый credential. После смены `JWT_SECRET` существующие sessions станут недействительными; планируй это как контролируемый maintenance step. Для backup credentials используй отдельного пользователя с минимальными правами: database export/read-only и object-storage write-only в отдельный private bucket.

При переносе за пределы Manus замени Manus OAuth, built-in Forge storage/notification и scheduled Heartbeat на эквивалентные сервисы. Не отключай owner-only checks как временный способ запуска.

## 4. Восстановление базы данных

Создай пустую MySQL/TiDB database и настрой `DATABASE_URL`. Затем проверь схему и миграции. Для проекта предусмотрен script `db:push`, однако перед production применением необходимо проверить generated SQL и убедиться, что операции не destructive:

```bash
pnpm drizzle-kit generate
# Просмотреть новый SQL в drizzle/migrations/
pnpm drizzle-kit migrate
```

Если база восстанавливается из отдельного SQL backup, сначала восстанови backup, затем проверь наличие таблиц bookings, service pricing/history, receipt files/retention, client history, smoke-test journal, receipt email attempts и failure alerts. Не запускай destructive `DROP` или reset-команды без отдельной проверенной копии.

Секретные и персональные данные не входят в исходный архив. Для production нужен отдельный database export, полученный владельцем с соблюдением требований privacy/data protection. После восстановления проверь, что даты и timestamps остаются UTC.

## 5. Восстановление файлового хранилища

PDF natal charts и receipt PDFs должны храниться в S3-compatible object storage, а не в базе данных. Перенеси объекты в новый bucket и восстанови metadata mapping: storage key, URL/reference, MIME type, owner/booking relation, creation time и expiry time.

При смене storage-провайдера реализуй эквиваленты `storagePut`, `storageGet`/signed URL и protected storage proxy. Receipt URLs должны истекать согласно retention setting 24/48/72 часа; просроченные metadata и объекты должны очищаться scheduled job или безопасным manual cleanup.

Проверь CORS, private bucket policy, signed URL expiration и отсутствие публичного листинга bucket. Никогда не включай публичный доступ ко всем PDF только для упрощения миграции.

## 6. OAuth и безопасность владельца

Настрой OAuth callback URL для нового домена и добавь его в OAuth application. В production убедись, что запросы идут через HTTPS и secure cookies. Сохрани точное значение владельца в `OWNER_OPEN_ID`; все admin procedures должны оставаться недоступными другим users, даже если у них есть обычный authenticated account или role.

Проверь следующие security flows:

1. unauthenticated visitor не видит Admin data;
2. authenticated non-owner получает forbidden;
3. owner может открыть dashboard, edit client, export, attach/send PDF, manage prices, retention, cleanup и smoke tools;
4. public receipt email endpoint не раскрывает booking data и не принимает произвольные storage keys;
5. NOWPayments IPN signature validation включена;
6. secrets не попадают в client bundle, logs, CSV, PDF или email body.

## 7. Payments и email

Создай NOWPayments API credentials, настрой callback/IPN URL нового deployment и проверь signature secret. Выполни sandbox/test checkout, если provider account это поддерживает. Не используй production money flow для smoke tests без explicit test marker и automatic cleanup.

Для Resend создай verified sender/domain, задай `RESEND_FROM_EMAIL`, проверь DNS records и отправь тестовое письмо на контролируемый адрес. Убедись, что receipt email cooldown, audit history, failed status и repeated-failure owner notification сохраняются при provider errors.

## 8. Scheduled jobs

В Manus текущая очистка receipt metadata выполняется Heartbeat job через `POST /api/scheduled/cleanup-receipts`. При переносе на другую платформу замени это на cron, GitHub Actions, Cloud Scheduler, platform cron или очередь jobs. Endpoint должен иметь отдельную authorization mechanism, не принимать публичные cleanup requests и быть idempotent.

Рекомендуемая периодичность — ежедневно, например 03:00 UTC. Сначала запускай cleanup в dry-run или staging, затем включай production. Записывай результат, количество удалённых объектов и ошибки.

### 8.1 Автоматические резервные копии базы и пользовательских файлов

Для независимой защиты данных настрой отдельный scheduled backup job, который запускается ежедневно и хранит копии вне основного database/storage account. Предпочтительная схема: managed database snapshot или read-only export в зашифрованное хранилище для базы, плюс versioned private S3-compatible bucket для пользовательских PDF и других файлов. Не сохраняй backup только в том же bucket или в той же database, которую он должен защищать.

Задай отдельные server-only secrets для backup destination:

| Secret | Назначение |
|---|---|
| `BACKUP_S3_ENDPOINT` | S3-compatible endpoint отдельного backup provider |
| `BACKUP_S3_REGION` | Region backup bucket |
| `BACKUP_S3_BUCKET` | Private versioned backup bucket |
| `BACKUP_S3_ACCESS_KEY_ID` | Dedicated write-only backup identity |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Secret for that identity |
| `BACKUP_ENCRYPTION_KEY` | Key managed by KMS/Vault or platform secret manager |
| `BACKUP_RETENTION_DAYS` | Retention policy, for example 30 or 90 |
| `BACKUP_CRON_SECRET` | Secret or signed authorization for the scheduled endpoint, if required by the platform |

The backup job should create an immutable, timestamped manifest containing UTC time, schema version, application version, database export checksum, object count, object checksums, and completion status. Encrypt database exports before upload, enable bucket versioning and object lock where available, and apply lifecycle retention only after the chosen recovery window. Never include backup credentials in the archive or in application client variables.

For a WebDev/Heartbeat implementation, add a POST endpoint under `/api/scheduled/backup-site`, authenticate it as a cron-only request, and make it idempotent. It should read database rows and referenced private object keys, stream or fetch the referenced files, encrypt the export, upload to the external backup bucket, and return a JSON summary. The endpoint must fail closed when backup secrets are missing, must not accept a bucket/key from request body, and must not expose backup URLs publicly. The job should be created only after the production callback is deployed and the user has verified the backup credentials; the platform cron expression is six-field UTC, for example `0 0 3 * * *`.

A safer alternative for the database is the managed provider's native automated backups or point-in-time recovery, combined with a separate object-storage replication policy for user files. Prefer that option when supported because it avoids loading a large database export into a short-lived web request. Test restoration at least monthly in an isolated staging environment; a backup is not considered reliable until both the database and representative PDFs have been restored and verified.

Suggested restore drill:

```text
1. Provision an isolated database and private object bucket.
2. Restore the newest complete database backup and verify schema/migrations.
3. Restore the matching object manifest and verify checksums.
4. Load secrets into staging only.
5. Run pnpm check, pnpm test, pnpm build, and a read-only smoke test.
6. Verify owner login, one booking, one receipt PDF, one customer email, and cleanup.
7. Record restore duration, missing objects, and corrective actions.
```

Do not enable the schedule until the owner has selected the external backup provider and supplied these secrets through a secret manager. If no external destination is configured, document the site as having no independent off-platform backup rather than claiming that the existing Manus storage is a disaster-recovery copy.

## 9. Деплой на типовых платформах

### Manus WebDev

Импортируй Task Data Backup для полного восстановления Manus-specific database, storage, secrets, integrations и schedules. Source archive сам по себе не является заменой Task Data Backup. После восстановления проверь OAuth, domain, NOWPayments IPN, Resend sender, Heartbeat job и owner login.

### VPS или Docker

Используй Node.js 20+, `pnpm install --frozen-lockfile`, `pnpm build` и `pnpm start`. Передай env через systemd, Docker secrets или внешний secret manager. Используй reverse proxy (например, Nginx/Caddy) с HTTPS. Для базы и object storage используй managed services и регулярные backups.

Пример Docker-последовательности без помещения секретов в Dockerfile:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
NODE_ENV=production node dist/index.js
```

### PaaS с build/start commands

Build command: `pnpm install --frozen-lockfile && pnpm build`

Start command: `pnpm start`

Добавь все необходимые environment variables в dashboard платформы. Убедись, что платформа передаёт `PORT` и разрешает outbound HTTPS к database, S3, NOWPayments, Resend и OAuth services. Если платформа не поддерживает persistent scheduled jobs, настрой внешний cron.

## 10. Что ещё оптимизировать после восстановления

После успешного запуска я бы внедрял улучшения в следующем порядке.

| Приоритет | Улучшение | Практический результат |
|---|---|---|
| P0 | Централизованный error tracking без персональных данных | Быстрее обнаруживать ошибки checkout, email, storage и cron |
| P0 | Database indexes и slow-query monitoring | Меньше задержек в Admin history, filters и booking list |
| P0 | Rate limiting для public booking/email/IPN endpoints | Снижение spam, abuse и неожиданных provider costs |
| P1 | Очередь для PDF generation/email delivery | Короткие HTTP requests и повторная доставка без дублей |
| P1 | Idempotency keys для checkout, email и scheduled backups | Безопасные retries при timeout/provider failures |
| P1 | Content Security Policy, HSTS и security headers | Более сильная защита browser surface |
| P1 | Automated restore drill и alert on stale backup | Проверяем не только наличие backup, но и его восстановимость |
| P2 | Dynamic import для редко используемых Admin modules | Меньше JS при навигации внутри приватной панели |
| P2 | Image/font optimization и preload только критичных ресурсов | Улучшение LCP и mobile data usage |
| P2 | Accessibility audit with keyboard/screen reader checks | Надёжнее формы, dialogs, tables и localized controls |
| P2 | Privacy/Terms pages, consent records и data deletion workflow | Более понятная обработка персональных данных и запросов клиентов |

Не оптимизируй за счёт безопасности: не переносить server secrets во frontend, не делать PDFs публичными, не удалять owner gate, не отключать IPN verification и не хранить backup в том же failure domain без отдельной копии.

## 11. После деплоя

Проверь health endpoint или главную страницу, public booking form, language switch EN/RU/DE/ES, USD/EUR/GBP pricing, checkout creation, success state, receipt PDF download, Web Share/copy-link fallback, receipt email, cooldown response, owner login, Admin history, cleanup, CSV/PDF exports и mobile layout.

Затем выполни:

```bash
pnpm check
pnpm test
pnpm build
```

Сохрани commit/tag вместе с checksum архива. Делай отдельные backups database и object storage; исходный код и database snapshot должны храниться раздельно и шифроваться.

## 11. Результаты проверки юридического disclaimer

Проверка текущего архива подтверждает четыре локали: English, Русский, Deutsch и Español. Public booking flow получает `legalDisclaimer` из `shared/i18n.ts`; этот текст отображается пользователю и передаётся в checkout price-breakdown PDF builder. `server/export.ts` печатает disclaimer в receipt PDF. `server/client-delivery.ts` добавляет локализованный disclaimer в оба customer email paths: natal-chart delivery и receipt delivery.

В ходе проверки был найден и исправлен дефект: тело receipt email оставалось на английском при выборе русского, немецкого или испанского языка. Теперь для всех четырёх языков локализованы subject context, greeting, receipt body, disclaimer и signoff. Regression test `server/client-delivery.test.ts` проверяет receipt body и disclaimer для всех четырёх языков; `server/export.test.ts` проверяет PDF builder; `shared/admin-localization.test.ts` проверяет локализованный Admin/public copy. После исправления targeted validation прошла: 16 тестов, TypeScript check без ошибок.

Есть важное ограничение: natal-chart PDF, который владелец загружает в private storage, может быть создан сторонней программой и не переписывается автоматически. При отправке такого файла система добавляет локализованный disclaimer в email body, но не вставляет страницу внутрь уже загруженного PDF. Если disclaimer должен присутствовать именно внутри natal-chart PDF, другая нейронная сеть должна добавить отдельный PDF post-processing step с поддержкой Unicode-шрифтов и повторно сохранить новый private object; это нужно проверить на реальном файле каждого языка.

Проверенные файлы:

| Файл | Роль в disclaimer coverage | Статус |
|---|---|---|
| `shared/i18n.ts` | Public EN/RU/DE/ES disclaimer | Проверено |
| `server/export.ts` | Receipt PDF disclaimer | Проверено |
| `server/client-delivery.ts` | Natal-chart и receipt email disclaimers/body | Проверено и исправлено |
| `server/client-delivery.test.ts` | Email localization regression | 4 языка пройдены |
| `server/export.test.ts` | PDF regression | Пройдено |
| `shared/admin-localization.test.ts` | Localization regression | Пройдено |
| `ETAP-ODIN-RESTORE-INSTRUCTIONS.md` | Restore, secret and backup instructions | Обновлено |

Юридический текст является осторожным информационным уведомлением, а не гарантией полного освобождения от ответственности. Перед коммерческим запуском его следует проверить юристом для стран, где фактически продаётся услуга, особенно в отношении consumer rights, privacy, refunds, advertising claims и mandatory liability.

## 12. Инструкция для другой нейронной сети

Передай другой нейронной сети следующий prompt вместе с архивом:

> Ты восстанавливаешь production-ready full-stack проект из архива `vedic-astrology-booking-source.tar.gz`. Сначала изучи этот файл инструкций и весь исходный код, затем составь inventory функций и missing dependencies. Не придумывай секреты, database data, storage objects, domains или owner identity. Запроси у владельца только недостающие values через безопасные environment variables. Сохрани React/Vite frontend, Express/tRPC server, Drizzle schema/migrations, MySQL/TiDB compatibility, S3-compatible private storage, OAuth owner-only authorization, NOWPayments IPN verification, Resend delivery, receipt retention/cooldown/history/alerts, Heartbeat-equivalent cleanup и EN/RU/DE/ES localization. Не отключай authorization, не хранить PDF bytes в database, не делать destructive migrations и не публиковать secrets. Сначала создай staging deployment, восстанови schema, затем выполни `pnpm check`, `pnpm test`, `pnpm build`, проведи smoke tests с test marker/cleanup и только после подтверждения владельца включи production domain, payment callbacks и scheduled cleanup. В финале выдай таблицу: restored, requires secret, requires data backup, requires manual verification.

## 13. Что нужно сохранить отдельно

Для независимого запуска сохраните не только этот исходный архив. Нужны также зашифрованный database dump, отдельный backup S3 objects, список DNS/domain settings, OAuth application settings, NOWPayments callback configuration, Resend DNS verification, scheduler configuration и secret values в password manager. Никогда не объединяйте эти секреты с публичным source archive.

Дата подготовки: 2026-08-23.
