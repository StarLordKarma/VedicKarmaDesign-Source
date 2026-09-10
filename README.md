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
`VITE_SOURCE_CODE_URL`. Если исходный код нельзя открыть, требуется Swiss
Ephemeris Professional License и отдельный пересмотр лицензирования проекта.
См. [LICENSE](LICENSE) и [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

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

Caddy выпускает HTTPS-сертификат и проксирует приложение. База и S3 должны быть
внешними; backup/restore репетируются в staging до первого заказа.

- [План deployment](docs/DEPLOYMENT-PLAN.md)
- [Release runbook](deploy/RELEASE-RUNBOOK.md)
- [Финальный отчёт](docs/FINAL-REPORT-2026-09-08.md)
- [Спецификация Report Studio](ETAP-DVA-REPORT-STUDIO-SPEC.md)

## Миграции

Версионированные SQL-файлы находятся в `drizzle/` (`0000`–`0029`). Перед
миграцией делайте snapshot, применяйте `pnpm exec drizzle-kit migrate`, проверяйте
`/ready`. Не выполняйте destructive rollback автоматически.

## Ограничения перед production

Нужны сервер и домен, OIDC с MFA, MySQL, приватный S3, Maps, LLM, Resend,
NOWPayments, backup/monitoring и юридическая проверка платежей/персональных данных.
Browser fixtures не подтверждают настоящие внешние интеграции.
