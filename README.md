# Vedic Karma Design

Многоязычное full-stack приложение для заказа ведических натальных разборов:
React/Vite, Express/tRPC, Drizzle/MySQL, приватное S3-хранилище, OIDC-доступ
владельца, криптооплата NOWPayments, Resend и управляемая генерация PDF.

## Возможности

- публичная форма заказа и согласие на обработку данных;
- цены и пакеты услуг с owner-only аудитом;
- подписанные платёжные callbacks и идемпотентная очередь Report Studio;
- локальный расчёт Lahiri: планеты, Ascendant, D1, D9, nakshatra/pada,
  Parashari full-sign graha drishti и Vimshottari mahadasha;
- AI создаёт только текст по зафиксированным фактам; владелец проверяет,
  редактирует, утверждает и только затем отправляет PDF;
- отзываемые status-ссылки и защищённое скачивание отправленного отчёта;
- интерфейсы RU/EN/DE/ES.

## Быстрый локальный запуск

Требуются Node.js 22, pnpm 10.4.1 и MySQL 8/TiDB.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm exec drizzle-kit migrate
pnpm dev
```

Заполните `.env` собственными значениями. Секреты, клиентские данные, PDF и
database dumps нельзя добавлять в Git.

## Структура проекта

- `client/` — React/Vite интерфейс и четыре локали;
- `server/` — Express/tRPC, платежи, расчёты, Report Studio и PDF;
- `shared/` — общие schemas, currency и i18n contracts;
- `drizzle/` — схема и миграции `0000`–`0029`;
- `deploy/` — production и staging Docker Compose;
- `scripts/` — smoke checks и безопасный staging seed;
- `docs/` — эксплуатационные, privacy и release документы.

## Локальный staging

Локальный профиль включает MySQL 8 и приватный MinIO. Подробный порядок,
sandbox credentials и acceptance-сценарии приведены в
[STAGING-GUIDE.md](docs/STAGING-GUIDE.md).

```bash
cp deploy/.env.staging.example deploy/.env.staging
docker compose --env-file deploy/.env.staging -f deploy/compose.staging.yml \
  --profile tools run --rm migrate
docker compose --env-file deploy/.env.staging -f deploy/compose.staging.yml \
  --profile tools run --rm seed
pnpm deploy:staging
```

## Полный sandbox без внешних ключей

Sandbox воспроизводит полный пользовательский цикл без денег и внешних аккаунтов:
MySQL, приватный MinIO, локальные заглушки NOWPayments, Resend, Maps и LLM, а также
одноразовый тестовый вход владельца. Все порты доступны только с localhost.

```bash
cp .env.sandbox.example .env.sandbox
pnpm sandbox:up
pnpm sandbox:seed
pnpm test:e2e
pnpm sandbox:down
```

Подробности: [SANDBOX-GUIDE.md](docs/SANDBOX-GUIDE.md),
[E2E-сценарии](docs/E2E-TEST-SCENARIOS.md) и
[необходимые внешние доступы](docs/SANDBOX-CREDENTIALS-NEEDED.md). Для локального
цикла реальные credentials не нужны.

## Проверка и сборка

```bash
pnpm lint
pnpm check
pnpm test
pnpm build
# весь локальный release gate:
pnpm deploy:check
```

Тесты внешних credentials выключены. `RUN_EXTERNAL_CREDENTIAL_TESTS=true`
разрешается только в изолированном staging с тестовыми ключами. Живые платёжные
операции дополнительно требуют `RUN_LIVE_PAYMENT_TESTS=true` и не должны
выполняться локально с production-реквизитами.

## Расчётный движок и лицензия

`server/vedic-astrology-calculator.ts` использует локальный `sweph@2.10.3-5`.
Swiss Ephemeris вычисляет положения и Ascendant; правила D1/D9, nakshatra/pada,
полных знаковых аспектов Парашары и Vimshottari находятся в проекте. Rahu/Ketu
special drishti намеренно не заявлены: правила отличаются между школами. Язык
отчёта не влияет на числовой snapshot; RU/EN/DE/ES применяются на narrative/PDF.

Выбран бесплатный режим **AGPL-3.0-or-later**. Перед публичным запуском оператор
обязан предоставить соответствующий исходный код точной запущенной версии.
Independent production блокируется без `CALCULATION_ENGINE_LICENSE` и
`VITE_SOURCE_CODE_URL`. В выбранной модели коммерческая лицензия не покупается:
если corresponding source нельзя открыть, публичный запуск блокируется.
См. [LICENSE](LICENSE) и [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

### Лицензирование и AGPL

Footer получает ссылку из `VITE_SOURCE_CODE_URL`. Она должна вести не просто на
похожий проект, а на полный corresponding source точной версии, доступной
пользователю сетевого сервиса, включая изменения и инструкции сборки. Новый код
проекта также распространяется под AGPL-3.0-or-later. Notices находятся в
`NOTICE` и `THIRD_PARTY_LICENSES.md`. Оператор обязан выполнять AGPL для каждой
развёрнутой версии; приватный URL origin не является публичным source offer.

Moshier fallback используется, если `SWE_EPHE_PATH` не задан; режим записывается
в snapshot. До релиза нужен reference benchmark на независимых эталонных картах:
regression-тесты подтверждают стабильность кода, но не являются сертификацией.

## Независимый deployment

Production-профиль находится в `deploy/`:

```bash
cp deploy/.env.standalone.example deploy/.env.standalone
docker compose --env-file deploy/.env.standalone -f deploy/compose.yml \
  --profile tools run --rm migrate
docker compose --env-file deploy/.env.standalone -f deploy/compose.yml up -d --build
```

Актуальный корневой production-профиль и полный шаблон переменных:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile tools run --rm migrate
# Только при первом запуске, после установки PRODUCTION_SEED_CONFIRM:
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile tools run --rm seed
pnpm deploy:prod
```

Реальные adapters переключаются переменными окружения: OIDC, NOWPayments,
Resend, S3, Google Maps и OpenAI-compatible LLM. Mock endpoints разрешены только
в локальном sandbox; independent production принимает только HTTPS endpoints.
Перед запуском заполните [список production-доступов](docs/PRODUCTION-CREDENTIALS-NEEDED.md).

Caddy выпускает HTTPS-сертификат и проксирует приложение. Бюджетный production
держит MySQL в private Docker network/persistent volume, а PDF — во внешнем R2;
off-site DB/PDF backup и restore репетируются до первого заказа.

- [План deployment](docs/DEPLOYMENT-PLAN.md)
- [Release runbook](deploy/RELEASE-RUNBOOK.md)
- [Финальный отчёт](docs/FINAL-REPORT-2026-09-08.md)
- [Staging guide](docs/STAGING-GUIDE.md)
- [Pre-launch checklist](docs/PRE-LAUNCH-CHECKLIST.md)
- [Отчёт staging/production preparation](docs/PROGRESS-REPORT-2026-09-10.md)
- [Sandbox guide](docs/SANDBOX-GUIDE.md)
- [Минимизация расходов](docs/COST-MINIMIZATION.md)
- [Отчёт sandbox](docs/SANDBOX-REPORT-2026-09-10.md)
- [Production credentials](docs/PRODUCTION-CREDENTIALS-NEEDED.md)
- [Публикация AGPL source](docs/AGPL-PUBLIC-SOURCE.md)
- [Release report](docs/RELEASE-REPORT-2026-09-10.md)
- [Cost analysis and selected stack](docs/COST-ANALYSIS-2026-09-10.md)
- [Server setup](docs/SETUP-SERVER.md)
- [DNS and TLS setup](docs/SETUP-DNS.md)
- [Secrets setup](docs/SETUP-SECRETS.md)
- [Independent chart verification](docs/CHART-VERIFICATION.md)
- [Спецификация Report Studio](ETAP-DVA-REPORT-STUDIO-SPEC.md)

## Миграции

Версионированные SQL-файлы находятся в `drizzle/` (`0000`–`0029`). Перед
миграцией делайте snapshot, применяйте `pnpm exec drizzle-kit migrate`, проверяйте
`/ready`. Не выполняйте destructive rollback автоматически.

## Ограничения перед production

Нужны сервер и домен, OIDC с MFA, MySQL, приватный S3, Maps, LLM, Resend,
NOWPayments, backup/monitoring и юридическая проверка платежей/персональных данных.
Browser fixtures не подтверждают настоящие внешние интеграции.

## Резервное копирование

`pnpm backup:prod` создаёт сжатый consistent MySQL dump, SHA-256 checksum,
удаляет только просроченные файлы своего шаблона в заданном `BACKUP_DIR` и может
отправить копию в `BACKUP_S3_URI`. Требуются `mysqldump`, gzip и, для off-site,
AWS CLI. Восстановление обязательно репетируется в отдельной базе.
