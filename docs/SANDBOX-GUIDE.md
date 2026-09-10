# Локальный sandbox

**Дата:** 2026-09-10

Sandbox предназначен для полного тестирования без реальных денег, писем и
клиентских данных. Он поднимает приложение, MySQL 8, приватный MinIO и локальный
mock-сервис для NOWPayments, Resend, Google Maps и OpenAI-compatible LLM.

## Требования и запуск

Нужны Docker Engine/Compose и свободные порты 3000, 3308, 4010, 9010, 9011.

```bash
cp .env.sandbox.example .env.sandbox
# Заменить все значения с change-me, не коммитить файл.
pnpm sandbox:up
pnpm sandbox:seed
pnpm test:e2e
```

Приложение: `http://127.0.0.1:3000`; тестовый checkout: ссылка из созданного
заказа; MinIO console: `http://127.0.0.1:9011`. Owner-вход выполняется только в
sandbox через `/api/auth/login?token=<SANDBOX_AUTH_TOKEN>`. Этот provider сервер
отвергает во всех остальных deployment modes.

Миграции отдельно: `pnpm db:migrate:sandbox`. Остановка: `pnpm sandbox:down`.
Данные сохраняются в именованных volumes. Для полного сброса следует явно удалить
только volumes этого Compose-проекта после проверки их имён.

## Что эмулируется

- платёж: создаётся фиктивный checkout; кнопка отправляет правильно подписанный
  IPN в приложение, деньги и внешний провайдер не участвуют;
- почта: сообщения и PDF-вложения сохраняются только в памяти mock-контейнера;
- S3: MinIO, приватный bucket `vedic-sandbox`;
- Maps: детерминированные координаты и часовой пояс;
- LLM: локализованный структурированный narrative на основании переданных фактов;
- auth: локальный owner session с отдельным длинным токеном.

## Ручная приёмка

1. Открыть форму на RU, EN, DE и ES, создать заказ и принять privacy consent.
2. Открыть checkout, подтвердить test payment и убедиться, что заказ стал paid.
3. Войти владельцем, открыть Report Studio, запустить calculation/narrative/PDF.
4. Проверить snapshot D1/D9, nakshatra/pada, аспекты и Vimshottari, затем вручную
   утвердить и отправить PDF.
5. По status-ссылке скачать PDF, проверить expiry/revoke и отсутствие storage key.
6. Проверить письмо в `http://127.0.0.1:4010/messages` и audit trail.

Автоматизированный вариант приведён в [E2E-TEST-SCENARIOS.md](E2E-TEST-SCENARIOS.md).
Mock подтверждает код интеграции, но не заменяет отдельную приёмку настоящих
provider sandbox/API перед production.

## Безопасность

Sandbox привязан к localhost, содержит только синтетические данные и не должен
публиковаться в интернет. Не используйте production secrets. `.env.sandbox`
игнорируется Git. После теста проверьте `git status` и журналы на отсутствие PII.
