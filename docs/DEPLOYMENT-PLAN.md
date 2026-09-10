# План доработки и деплоя сайта

**Дата составления:** 2026-09-08
**Обновлено:** 2026-09-10

## 1. Предварительные требования

Фактически выбранный нулевой старт — Northflank Developer Sandbox в Europe West
(London): combined Docker service, private MySQL addon, Northflank HTTPS и
Cloudflare R2 для PDF. Публичный preview доступен по адресу
`https://p01--vedic-karma-app--mbb49nqg858d.code.run/`, а corresponding source —
`https://github.com/StarLordKarma/VedicKarmaDesign-Source`.

При нехватке 512 МБ или изменении free tier тот же образ переносится на Oracle
Always Free A1. Если ARM capacity недоступна, выбрать Hetzner CAX11/CX23; для
оплаты из РФ — Timeweb 4 ГБ. Полное сравнение и точки начала расходов приведены в
[COST-ANALYSIS-2026-09-10.md](COST-ANALYSIS-2026-09-10.md).

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

| Вариант              | Стартовый размер    |                                Ориентир | Плюсы                                     | Ограничения                                           |
| -------------------- | ------------------- | --------------------------------------: | ----------------------------------------- | ----------------------------------------------------- |
| Hetzner Cloud CX23   | 2 vCPU, 4 ГБ, 40 ГБ | €5.49/мес без VAT/IPv4 после 15.06.2026 | лучший бюджет/ресурсы, EU regions         | доступность аккаунта/оплаты и цена зависят от региона |
| DigitalOcean Basic   | 2 vCPU, 4 ГБ, 80 ГБ |                                 $24/мес | простой UI, managed DB/Spaces             | дороже, дополнительные сервисы оплачиваются отдельно  |
| AWS Lightsail Medium | 2 vCPU, 4 ГБ, 80 ГБ |                          $24/мес с IPv4 | предсказуемый bundle, путь к AWS services | IAM/стоимость экосистемы сложнее                      |

Источники: [Hetzner](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/),
[DigitalOcean](https://www.digitalocean.com/pricing/droplets),
[AWS Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html).
Практический выбор — завершить малонагруженный запуск на Northflank Free. При
нехватке ресурсов или необходимости SLA использовать Oracle; при отсутствии
capacity — Hetzner 4 ГБ, а при недоступной оплате — Timeweb. База Northflank
остаётся private; обязательны внешняя копия и регулярный restore rehearsal.

Вариант с минимальной ценой — Oracle Cloud Always Free, если аккаунту реально
выделяются ARM-ресурсы в выбранном регионе; доступность capacity не гарантируется.
Для предсказуемого запуска рекомендуется один недорогой VPS: приложение, MySQL и
MinIO на нём, плюс зашифрованная off-site копия. Railway, Fly.io и PlanetScale не
считаются гарантированно бесплатной production-основой: тарифы и лимиты меняются.
Актуальные альтернативы и границы экономии описаны в [COST-MINIMIZATION.md](COST-MINIMIZATION.md).

### Расчётный движок

Выбран бесплатный локальный `sweph`/Swiss Ephemeris под AGPL-3.0-or-later.
Планетные положения и Ascendant рассчитываются Swiss Ephemeris; D1, D9,
nakshatra/pada, Parashari full-sign aspects и Vimshottari mahadasha — локальным
версионированным слоем. Числовые факты общие для RU/EN/DE/ES, локализуется только
текст/PDF. Внешний calculation API не используется, поэтому ключа и сетевого кэша
для расчётов нет.

Перед production нужны юридическое принятие AGPL с доступом пользователей к
исходникам и reference benchmark на известных картах. Если corresponding source
нельзя предоставить публично, запуск блокируется. Покупка коммерческой лицензии в
выбранную модель не входит.

## 2. Пошаговая инструкция по деплою

Подробные инструкции: [SETUP-SERVER.md](SETUP-SERVER.md),
[SETUP-DNS.md](SETUP-DNS.md), [SETUP-SECRETS.md](SETUP-SECRETS.md).

1. Создать VPS, непривилегированного deploy-пользователя, SSH-ключи и firewall;
   открыть только 22 (ограниченно), 80 и 443. Установить Docker Engine и Compose.
2. Создать private R2 PDF bucket и отдельный B2 backup bucket. MySQL создаётся
   `docker-compose.prod.yml` на непубличной сети и persistent volume.
3. Клонировать конкретный release tag/commit. Не выполнять deployment из
   изменённой рабочей директории.
4. Скопировать `.env.production.example` в `.env.production`, заполнить через
   secret manager/защищённый файл mode 600. Установить `SITE_DOMAIN`,
   `PUBLIC_BASE_URL`, `VITE_SOURCE_CODE_URL` и все credentials.
5. Выполнить `pnpm deploy:check` в CI, собрать image по commit SHA и сохранить digest.
6. Сделать snapshot и применить миграции через `sh scripts/deploy.sh`.
7. Скрипт запускает MySQL/app/Caddy. Проверить
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

Начальная инициализация reference pricing/packages выполняется один раз командой
`PRODUCTION_SEED_CONFIRM=INITIALIZE-REFERENCE-DATA pnpm db:seed:prod`. Seed не
создаёт клиентов/заказы и не перезаписывает существующие цены. Ежедневный dump:
`pnpm backup:prod` с параметрами из `.env.production.example`; off-site копия
обязательна. Restore сначала проверяется в новой базе, а не поверх production.

### S3, email, платежи и LLM

- S3/совместимое хранилище: отдельные staging/prod buckets, Block Public Access,
  encryption, versioning, lifecycle, scoped access key только на нужный prefix.
  PDF выдаются через короткоживущий signed URL/server endpoint с `no-store`.
- Resend Free: до 3 000 писем/месяц и 100/день на дату проверки; отдельный verified subdomain, SPF/DKIM/DMARC, allowlist в staging,
  bounce/complaint alerts и запрет отправки synthetic jobs. SMTP сейчас не является
  реализованным adapter; его нельзя указать в env без разработки и тестов.
- NOWPayments: отдельные API/IPN secrets, HTTPS callback, подпись и idempotency.
  Stripe/ЮKassa пока не интегрированы: перед добавлением нужны договор, KYC,
  налоги/чеки и review доступности по юрисдикциям. Fiat rail не является анонимным;
  обещается только минимизация данных и отсутствие хранения карточных реквизитов.
- LLM: стартовый OpenAI-compatible endpoint — Groq free tier; отдельный project/key, template fallback, DPA/no-training условия и
  минимизированным prompt. Модель не рассчитывает положения и не утверждает PDF.
- Maps: прежний общий кредит $200 больше не действует; server-side key с API/IP
  restrictions, низкими SKU quotas и billing alerts.

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
