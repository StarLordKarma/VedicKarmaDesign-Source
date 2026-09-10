# Доступы для полного тестирования

**Дата:** 2026-09-10

## Локальный бесплатный цикл

Для запуска `docker-compose.sandbox.yml` внешние аккаунты и API-ключи **не нужны**.
Все значения берутся из локального `.env.sandbox`, а интеграции эмулируются.

## Что нужно от владельца для внешней staging-приёмки

Передавать секреты в чат или Git нельзя. Создайте `.env.sandbox`/защищённые GitHub
Environment secrets либо заполните secret manager сервера. Достаточно сообщить,
что переменные установлены; их значения не нужны в отчёте.

- **Публичный corresponding source:** сделать текущий репозиторий публичным либо
  дать URL публичного зеркала точного deployed commit. Требуется общий read-access;
  write-доступ пользователям не нужен. Это обязательное условие выбранного AGPL.
- **OIDC test app:** issuer, client ID, client secret и subject owner-аккаунта с
  MFA. Callback: `https://<staging-domain>/api/oauth/callback`. Создаётся в выбранном
  OIDC provider; права — только `openid profile email`.
- **NOWPayments:** отдельные test/ограниченные `NOWPAYMENTS_API_KEY` и
  `NOWPAYMENTS_IPN_SECRET`, если провайдер разрешил безопасную test-приёмку.
  Для повседневной разработки используется локальный mock, а live-payment флаг
  остаётся false. Никаких production кошельков в sandbox.
- **Resend:** test API key, verified staging subdomain/from-address и allowlist
  получателей. Нужны только права отправки с этого домена. Локальный mock ключа не
  требует: <https://resend.com/docs>.
- **Maps:** отдельный Google Cloud key для Geocoding и Time Zone APIs, ограниченный
  этими API, server IP и дневной квотой: <https://developers.google.com/maps/documentation>.
  Локально используется детерминированный mock.
- **LLM:** отдельный OpenAI-compatible project key, base URL, модель, hard budget
  и запрет обучения/retention по возможности. Локально narrative создаёт mock;
  альтернативно можно тестировать self-hosted Ollama без API-ключа.
- **S3:** отдельный staging bucket, endpoint/region и scoped access key только к
  этому bucket/prefix. Локально применяется MinIO; внешний S3 не требуется.
- **MySQL:** отдельная staging DB и least-privilege application user; временная
  migration identity имеет DDL-права. Локально база создаётся автоматически.
- **Домен/DNS:** временный staging subdomain и возможность добавить A/AAAA записи,
  если требуется проверить реальный HTTPS, OAuth callback и почтовый домен.
- **GitHub:** разрешить Actions и при необходимости добавить Environment `staging`
  с required reviewers. Перечень имён secrets должен совпадать с `.env.example`.

Production-реквизиты, реальные клиентские данные и приватные ключи кошельков для
этого этапа не нужны и не должны предоставляться.
