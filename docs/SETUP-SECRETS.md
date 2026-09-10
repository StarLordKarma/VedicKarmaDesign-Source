# Безопасная настройка production-секретов

## Хранилища

- Runtime: `/opt/vedic-karma/app/.env.production`, owner-only, mode `600`.
- Deployment: GitHub Environment `production` с required reviewer.
- Не использовать Issues, Actions logs, чат, commit, Docker image или frontend env.

Сгенерировать независимые значения:

```bash
openssl rand -base64 48
```

Заполнить по `.env.production.example`. Не использовать один пароль для JWT,
scheduler, smoke, MySQL, OIDC, IPN и S3.

## Минимальные права

- R2 key: только Get/Put/Delete нужного private bucket/prefix; bucket не public.
- Maps: только Geocoding/Time Zone, IP сервера, низкие daily quotas.
- OIDC: redirect только production URL; owner `sub` закреплён; MFA.
- GitHub deploy SSH: только сервер, отдельный от GitHub source deploy key.
- NOWPayments/Resend/LLM: отдельный production project/key; лимиты и alerts.

После установки сообщается только факт: «все required secrets заполнены». Для
диагностики передаются названия отсутствующих переменных, но не значения.

Ротация: немедленно после утечки; планово раз в 90–180 дней. Старый ключ удаляется
только после проверки нового. Backup recovery credentials хранятся отдельно.
