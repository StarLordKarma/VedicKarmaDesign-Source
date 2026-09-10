# План доработки и деплоя сайта

**Дата составления:** 2026-09-08
**Обновлено:** 2026-09-10

## 1. Предварительные требования

Рекомендуемый минимальный вариант — отдельный VPS с Ubuntu 24.04 LTS, 2 vCPU,
4 ГБ RAM и 40+ ГБ SSD. Приложение запускается контейнерами, но MySQL и S3 лучше
использовать как отдельные managed/private services: это снижает риск потери данных
при замене VPS.

До запуска необходимо получить:

- домен, доступ к DNS и публичные A/AAAA записи;
- MySQL 8/TiDB с TLS, отдельными staging/production пользователями и backups;
- приватный S3-compatible bucket и минимальные access credentials;
- OIDC provider, отдельный owner account, MFA, client ID/secret и owner subject;
- Google Maps Geocoding/Timezone key;
- OpenAI-compatible LLM endpoint/key для narrative, но не расчётных фактов;
- Resend key, подтверждённый домен отправителя и owner alert email;
- NOWPayments API/IPN secrets и отдельные staging/production callbacks;
- уникальные JWT, scheduler и production-smoke secrets;
- публичный URL соответствующего исходного кода для AGPL.

### Варианты сервера и бюджет

Цены проверены 2026-09-10 и являются ориентирами без налогов, managed DB,
object storage, snapshots и исходящего трафика; перед покупкой проверить регион и
итоговый счёт на официальной странице.

| Вариант | Стартовый размер | Ориентир | Плюсы | Ограничения |
|---|---|---:|---|---|
| Hetzner Cloud CX22 | 2 vCPU, 4 ГБ, 40 ГБ | €3.79/мес по опубликованному CX22 announcement | лучший бюджет/ресурсы, EU regions | доступность аккаунта/оплаты и цена зависят от региона |
| DigitalOcean Basic | 2 vCPU, 4 ГБ, 80 ГБ | $24/мес | простой UI, managed DB/Spaces | дороже, дополнительные сервисы оплачиваются отдельно |
| AWS Lightsail Medium | 2 vCPU, 4 ГБ, 80 ГБ | $24/мес с IPv4 | предсказуемый bundle, путь к AWS services | IAM/стоимость экосистемы сложнее |

Источники: [Hetzner](https://www.hetzner.com/pressroom/new-cx-plans/),
[DigitalOcean](https://www.digitalocean.com/pricing/droplets),
[AWS Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html).
Практический выбор для первого запуска — Hetzner 4 ГБ, если доступны регистрация
и оплата; DigitalOcean — более простой запасной вариант. Базу допустимо временно
держать на отдельном private volume того же VPS только при ежедневном off-site
backup и успешно проведённом restore rehearsal.

### Расчётный движок

Выбран бесплатный локальный `sweph`/Swiss Ephemeris под AGPL-3.0-or-later.
Планетные положения и Ascendant рассчитываются Swiss Ephemeris; D1, D9,
nakshatra/pada, Parashari full-sign aspects и Vimshottari mahadasha — локальным
версионированным слоем. Числовые факты общие для RU/EN/DE/ES, локализуется только
текст/PDF. Внешний calculation API не используется, поэтому ключа и сетевого кэша
для расчётов нет.

Перед production нужны юридическое принятие AGPL с доступом пользователей к
исходникам и reference benchmark на известных картах. Если исходники нельзя
предоставить, запуск блокируется до покупки Professional License и пересмотра
лицензирования.

## 2. Пошаговая инструкция по деплою

1. Создать VPS, непривилегированного deploy-пользователя, SSH-ключи и firewall;
   открыть только 22 (ограниченно), 80 и 443. Установить Docker Engine и Compose.
2. Создать staging и production базы/buckets. Проверить TLS, lifecycle policy,
   least privilege и восстановление тестовой backup-копии.
3. Клонировать конкретный release tag/commit. Не выполнять deployment из
   изменённой рабочей директории.
4. Скопировать `deploy/.env.standalone.example` в `deploy/.env.standalone`, заполнить
   через secret manager/защищённый файл mode 600. Установить `SITE_DOMAIN`,
   `PUBLIC_BASE_URL`, `VITE_SOURCE_CODE_URL` и все credentials.
5. Выполнить `pnpm deploy:check` в CI, собрать image по commit SHA и сохранить digest.
6. Сделать snapshot и применить миграции командой из release runbook.
7. Запустить Compose. Caddy выполняет reverse proxy и Let's Encrypt. Проверить
   `/health` и `/ready`.
8. Настроить DNS, проверить HSTS, secure cookies, OIDC/MFA и запрет доступа
   не-owner пользователю к `/admin`.
9. Настроить внешний scheduler для трёх `/api/scheduled/*` endpoints с Bearer secret.
10. Настроить ежедневные encrypted DB backups и versioned object manifest,
    30–90 дней хранения, checksum, off-site copy и alert при пропуске backup.
11. В staging проверить checkout/IPN, отчёт RU/EN/DE/ES, owner review, email,
    status-link download, revoke/expiry, retry и provider failures.
12. Сохранить предыдущий image digest и snapshot. При сбое остановить заказы и
    следовать runbook, не откатывая миграции вслепую.

### MySQL production

```sql
CREATE DATABASE vedic_production CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'vedic_app'@'10.%' IDENTIFIED BY '<random-password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON vedic_production.* TO 'vedic_app'@'10.%';
```

Миграции выполняет отдельная release identity с временными DDL-правами через
`pnpm db:migrate`; приложение не должно постоянно иметь `ALTER/DROP`. До миграции
снять consistent snapshot, сохранить checksum и проверить свободное место. Backup:
ежедневный encrypted dump/snapshot, 7 daily + 4 weekly + 6 monthly копий, отдельный
bucket/account, ежемесячное восстановление в изолированную БД.

### S3, email, платежи и LLM

- S3/совместимое хранилище: отдельные staging/prod buckets, Block Public Access,
  encryption, versioning, lifecycle, scoped access key только на нужный prefix.
  PDF выдаются через короткоживущий signed URL/server endpoint с `no-store`.
- Resend: отдельный verified subdomain, SPF/DKIM/DMARC, allowlist в staging,
  bounce/complaint alerts и запрет отправки synthetic jobs. SMTP сейчас не является
  реализованным adapter; его нельзя указать в env без разработки и тестов.
- NOWPayments: отдельные API/IPN secrets, HTTPS callback, подпись и idempotency.
  Stripe/ЮKassa пока не интегрированы: перед добавлением нужны договор, KYC,
  налоги/чеки и review доступности по юрисдикциям. Fiat rail не является анонимным;
  обещается только минимизация данных и отсутствие хранения карточных реквизитов.
- LLM: отдельный project/key с лимитом затрат, DPA/no-training условиями и
  минимизированным prompt. Модель не рассчитывает положения и не утверждает PDF.
- Maps: server-side key с API/IP restrictions, quota и billing alerts.

### Monitoring и журналы

Минимум: внешний uptime probe для `/health`, authenticated probe `/ready`, Sentry
для redacted errors, JSON logs с request/correlation ID и алерты по 5xx, очереди,
delivery failures, backup age, диску и сертификату. Метрики можно начать с
hosted Grafana/Prometheus либо Netdata/Uptime Kuma; birth data, email, токены,
IPN payload и signed URLs в labels/logs запрещены. Срок хранения логов должен
соответствовать privacy policy.

Поддерживаемый профиль — Docker Compose + Caddy. Node 22 + systemd/PM2 + Nginx
возможен, но является отдельным runtime и требует отдельной приёмки.

## 3. План дальнейших улучшений

### P0 — до первого клиента

- reference benchmark, включая даты около границ знаков/nakshatra;
- юридическая проверка AGPL, privacy notice и платёжной схемы;
- реальные тесты OIDC/S3/Maps/LLM/Resend/NOWPayments;
- восстановление backup в staging и проверка миграций `0000`–`0029`;
- branch protection, PR review и обязательные GitHub Actions checks.

### P1 — первые релизы

- OIDC MFA policy, ротация secrets и расширенный owner audit;
- очередь jobs с exponential backoff/dead-letter для роста объёма;
- cache только геокодирования и immutable snapshots без PII leakage;
- CDN только для публичной статики; PDF остаются private/no-store;
- автоматическое сравнение PDF по тексту/страницам перед утверждением.

### P2 — развитие продукта

- дополнительные пакеты/варги после спецификации и benchmarks;
- новые языки с locale regression tests;
- дополнительные платежи после юридической/provider-проверки, без обещания
  анонимности сторон для регулируемых fiat rails;
- полноценный data export/deletion workflow по retention policy.

## 4. Чек-лист готовности к запуску

- [ ] AGPL принят владельцем, corresponding source URL публично доступен
- [ ] Reference benchmark подписан владельцем/астрологом
- [ ] Все переменные окружения заполнены
- [ ] Домен привязан, SSL/HSTS работают
- [ ] OIDC owner login и MFA проверены
- [ ] База настроена, миграции применены, snapshot создан
- [ ] Backup восстановлен в отдельном staging
- [ ] Приватный S3 и отзыв PDF-ссылки проверены
- [ ] Monitoring/alerts и scheduler активны
- [ ] RU/EN/DE/ES отчёты проверены без подмены фактов AI
- [ ] Тестовый платёж, IPN, email и PDF прошли в staging
- [ ] Все CI checks прошли на точном release commit
- [ ] Rollback image digest и ответственный за релиз зафиксированы
- [ ] Полный [pre-launch checklist](PRE-LAUNCH-CHECKLIST.md) подписан владельцем
