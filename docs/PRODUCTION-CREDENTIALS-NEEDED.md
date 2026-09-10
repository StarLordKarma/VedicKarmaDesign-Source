# Доступы для staging и production

**Дата:** 2026-09-10

Секреты нельзя отправлять в чат или коммитить. Владелец создаёт `.env.production`
на сервере с правами `600` либо GitHub Environment `production` с required
reviewer. Разработчику достаточно подтверждения, что переменные установлены.

## Обязательные доступы

- **Домен и DNS:** домен/поддомен, возможность менять A/AAAA/CNAME. Требуется для
  HTTPS, OIDC callback и подтверждения почтового домена.
- **Публичный исходный код:** публичный read-only URL точного deployed commit.
  Можно открыть основной репозиторий либо создать зеркало по
  [AGPL-PUBLIC-SOURCE.md](AGPL-PUBLIC-SOURCE.md). Write-доступ посетителям не нужен.
- **MySQL 8:** `DATABASE_URL` для least-privilege application user; отдельная
  временная migration identity с DDL и backup identity с SELECT/LOCK privileges.
- **S3-compatible storage:** bucket, region, endpoint и scoped access key с
  Get/Put только для production bucket. Public access запрещён.
- **OIDC:** issuer, client ID/secret и точный `sub` owner-аккаунта. Callback:
  `https://<домен>/api/auth/callback`; scopes `openid profile`; MFA обязательно.
- **NOWPayments:** отдельные API key и IPN secret из кабинета провайдера. Callback:
  `https://<домен>/api/nowpayments/ipn`. Не передавать seed phrases/private keys.
- **Resend:** API key с правом отправки только с подтверждённого поддомена,
  `RESEND_FROM_EMAIL` и `OWNER_ALERT_EMAIL`; настроить SPF/DKIM/DMARC.
- **Google Maps:** server key только для Geocoding и Time Zone APIs, ограниченный
  IP сервера, дневной квотой и budget alert.
- **LLM:** отдельный project key и OpenAI-compatible base URL. Установить hard
  budget, минимальное хранение запросов и запрет обучения на данных, где доступно.
- **GitHub Actions:** разрешить workflows; для автоматического deployment — SSH
  deploy key только к серверу и Environment secrets. Production deployment должен
  требовать ручного подтверждения.

## Генерация локальных секретов

Каждый JWT/scheduler/smoke secret должен быть независимым и не короче 32 байт:

```bash
openssl rand -base64 48
```

Заполнить все поля из `.env.production.example`, затем выполнить проверку
конфигурации и controlled smoke test. Production payment/письма включаются только
после успешного staging acceptance.
