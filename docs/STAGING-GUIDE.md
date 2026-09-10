# Staging: запуск и приёмка

**Дата:** 2026-09-10

## 1. Что входит в локальный контур

`deploy/compose.staging.yml` поднимает приложение, MySQL 8 и приватное
S3-compatible хранилище MinIO. База и object storage доступны только через
loopback. Публичный bucket запрещён. Реальные OIDC, Maps, LLM, Resend и
NOWPayments намеренно не подменяются фиктивными «успешными» сервисами: unit-тесты
используют mocks, а сквозная приёмка выполняется только с sandbox/test credentials.

## 2. Первый запуск

```bash
cp deploy/.env.staging.example deploy/.env.staging
# замените все replace-* и добавьте sandbox credentials
docker compose --env-file deploy/.env.staging -f deploy/compose.staging.yml \
  --profile tools run --rm migrate
docker compose --env-file deploy/.env.staging -f deploy/compose.staging.yml \
  --profile tools run --rm seed
pnpm deploy:staging
docker compose --env-file deploy/.env.staging -f deploy/compose.staging.yml ps
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3000/ready
```

Seed идемпотентно создаёт только эталонные тарифы и RU/EN/DE/ES названия
пакетов. Клиентские данные он не создаёт. Для удалённой staging-БД дополнительно
нужно осознанно установить `ALLOW_REMOTE_STAGING_SEED=true`.

## 3. Sandbox credentials

- OIDC: отдельный test client и test owner subject, MFA включена.
- Maps: key с quota, referrer/IP restrictions и billing alert.
- LLM: отдельный low-limit key; birth data нельзя использовать для обучения.
- Resend: подтверждённый staging subdomain и адрес получателя из allowlist.
- NOWPayments: sandbox/test account и отдельный IPN secret. Никогда не включать
  `RUN_LIVE_PAYMENT_TESTS=1` с production wallet.

## 4. Сценарий приёмки

1. Открыть RU, EN, DE и ES; проверить privacy notice и отсутствие обещания
   анонимности fiat-платежей.
2. Создать по одному тестовому заказу каждого языка и проверить исторический
   timezone/координаты.
3. Провести sandbox checkout, повторить одинаковый IPN и убедиться в
   идемпотентности и подписи.
4. В Report Studio проверить facts → narrative → PDF → owner review. Для каждого
   языка открыть PDF и проверить шрифт, заголовки, D1/D9, накшатру, паду и дашу.
5. Утвердить тестовый клиентский отчёт, проверить email, status-link download,
   затем revoke и expiry. Synthetic test jobs доставляться не должны.
6. Имитировать недоступность LLM/Resend/S3 и проверить retry, audit и отсутствие
   токенов/PII в логах.
7. Создать дамп, удалить staging-копию данных и восстановить её в отдельную БД.

## 5. Внешние credential tests

```bash
RUN_EXTERNAL_CREDENTIAL_TESTS=true pnpm test -- server/resend.credentials.test.ts
RUN_LIVE_PAYMENT_TESTS=1 pnpm test -- server/nowpayments.credentials.test.ts
```

Пропущенные DB-тесты запускаются в GitHub Actions job `database-integration` и
локально при заданном `DATABASE_URL`. Пропуск без credentials — защитный режим,
а не успешная проверка провайдера.

## 6. Остановка и удаление данных

```bash
docker compose --env-file deploy/.env.staging -f deploy/compose.staging.yml down
# Только после сохранения нужных артефактов; -v удаляет staging DB и MinIO data:
docker compose --env-file deploy/.env.staging -f deploy/compose.staging.yml down -v
```
