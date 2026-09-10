# Анализ минимальной стоимости запуска

**Проверено:** 2026-09-10. Цены указаны без налогов и курсовой конвертации.
Промо-тариф первого года не считается устойчивой ценой: перед оплатой нужно
проверять renewal и доступность услуги для страны владельца.

## Вычислительная инфраструктура

| Сервис                      | Стоимость и ресурсы                                                                    | Docker Compose / данные                                  | Плюсы                                                             | Минусы                                                                                            | Вывод                                  |
| --------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Oracle Cloud Always Free A1 | $0: суммарно до 4 ARM OCPU, 24 ГБ RAM и 3 000 OCPU/18 000 GB-hours в месяц             | Полный Compose; MySQL на block volume; HTTPS через Caddy | Единственный реалистичный постоянный $0 VPS с большим объёмом RAM | ARM capacity может отсутствовать; строгая регистрация; простаивающие ресурсы могут быть reclaimed | **Нулевой старт, вариант №1**          |
| Hetzner CAX11 ARM           | €5.99/мес без VAT/IPv4, 2 vCPU, 4 ГБ RAM, 40 ГБ SSD                                    | Полный Compose                                           | Хорошая цена, EU, предсказуемая VM                                | Оплата/регистрация доступны не во всех странах; IPv4 отдельно                                     | **Надёжный бюджетный вариант №1**      |
| Hetzner CX23 x86            | €5.49/мес без VAT/IPv4, 2 vCPU, 4 ГБ RAM, 40 ГБ SSD                                    | Полный Compose                                           | x86 совместимость, простой перенос                                | После изменения цен 2026 уже не €3.79; IPv4/VAT сверху                                            | Резерв CAX11                           |
| DigitalOcean Basic          | $24/мес: 2 vCPU, 4 ГБ, 80 ГБ, 4 ТБ transfer                                            | Полный Compose, snapshots отдельно                       | Простой интерфейс и хорошая документация                          | В 4 раза дороже Hetzner                                                                           | Надёжный, но не минимальный            |
| AWS Lightsail               | $24/мес с IPv4: 2 vCPU, 4 ГБ, 80 ГБ, 4 ТБ; $20 IPv6-only                               | Полный Compose                                           | Фиксированный bundle, AWS ecosystem                               | IAM и биллинг сложнее; бесплатны только первые 3 месяца выбранных bundles                         | Не для нулевого бюджета                |
| Google Compute Engine       | $0 для одной e2-micro в разрешённых US-регионах, 30 ГБ standard disk, 1 ГБ egress      | Compose технически возможен                              | Постоянный free tier                                              | RAM слишком мала для app + MySQL; мало egress                                                     | Только proxy/тест                      |
| Railway                     | Free $1 usage/мес; Hobby минимум $5/мес, затем usage                                   | Не полный Compose; отдельные services/volumes            | Очень простой deploy                                              | Free 0.5 ГБ RAM/0.5 ГБ volume; Hobby usage быстро превышает $5                                    | Preview или ранний MVP                 |
| Render                      | Free web: 512 МБ/750 часов; paid web от $7/мес                                         | Docker есть, MySQL managed нет                           | Простая публикация                                                | Free прямо не рекомендован для production, sleep/ограничения; persistent disk платный             | Только staging                         |
| Fly.io                      | Usage billing; volume $0.08/ГБ-мес, первые 10 ГБ snapshots free; egress EU/US $0.02/ГБ | Docker-native, Compose требует разбиения                 | Географическое размещение                                         | Гарантированного нового production free tier нет; счёт зависит от VM                              | Не нулевой и сложнее VPS               |
| Vercel Hobby                | $0 только personal/non-commercial; Pro $20/польз./мес                                  | Фронтенд да, этот stateful Node/MySQL монолит — нет      | Отличный CDN/preview                                              | Hobby нельзя использовать для коммерческого запуска; нужен отдельный backend                      | Не подходит текущей архитектуре        |
| Timeweb Cloud               | От 900 ₽/мес за 2 vCPU/2 ГБ/40 ГБ; 4 ГБ — 1 080 ₽/мес                                  | Полный Compose                                           | Оплата РФ/иностранными картами, RU support                        | Дороже европейского VPS; проверить трансграничные данные                                          | Практичный вариант для владельца из РФ |
| REG.RU                      | Ориентир около 1 320 ₽/мес за подходящий VPS; финальная цена в конфигураторе           | Полный Compose                                           | Российская оплата и поддержка                                     | Цена/ресурсы менее выгодны; проверить политику данных                                             | Резерв для РФ                          |
| Aeza/малые VPS              | Цена меняется по локации и акции; проверять в checkout                                 | Обычно полный Compose                                    | Иногда дешевле                                                    | Меньше доказательств устойчивости/SLA; проверять юрлицо, backup и abuse policy                    | Не основной без due diligence          |
| Raspberry Pi / своё железо  | После покупки: электричество + интернет; обычно 0–10 €/мес marginal                    | Полный Compose                                           | Полный контроль                                                   | Домашний IP, питание, пожар/кража, DDoS, отсутствие SLA                                           | Только резерв/эксперимент              |

Источники: [Oracle](https://www.oracle.com/cloud/free/),
[Hetzner 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/),
[DigitalOcean](https://www.digitalocean.com/pricing/droplets),
[Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html),
[Google Cloud](https://cloud.google.com/products/compute),
[Railway](https://docs.railway.com/pricing/plans),
[Render](https://render.com/docs/free), [Fly.io](https://fly.io/docs/about/pricing/),
[Vercel](https://vercel.com/pricing), [Timeweb](https://timeweb.cloud/services/vps-ubuntu).

## MySQL

| Вариант                             | Цена / лимит                                                                  | Надёжность и backup                                                              | Итог                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| MySQL 8 на той же Oracle/Hetzner VM | $0 сверх VM; объём ограничен диском                                           | Single-node; обязательны ежедневный dump в отдельный R2/B2 и ежемесячный restore | **Минимальная стоимость, выбран**                                |
| Aiven Free MySQL                    | $0 бессрочно, 1 CPU/1 ГБ RAM/1 ГБ storage, до 76 connections                  | Backups есть, SLA/VPC/static IP нет; может отключаться при неактивности          | Staging или очень малый запуск, не единственная production-копия |
| Aiven Developer                     | $5/мес, 1 CPU/1 ГБ RAM/8 ГБ                                                   | Managed, но позиционируется для development                                      | Дешёвый внешний fallback                                         |
| Railway MySQL                       | От $5 plan/usage; volume $0.15/ГБ-мес                                         | Простое управление, но usage billing                                             | Удобно, не минимально                                            |
| PlanetScale                         | Бесплатного плана нет; single-node Postgres от $5, MySQL/Vitess Base — платно | Managed backups                                                                  | Не нулевой; прежние рекомендации о free tier устарели            |
| Oracle Autonomous DB                | $0, до двух БД по 20 ГБ                                                       | Это Oracle Database, **не MySQL**; текущий Drizzle/mysql2 код несовместим        | Не использовать без миграции приложения                          |

Источники: [Aiven Free MySQL](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier),
[Aiven pricing](https://aiven.io/pricing/mysql),
[PlanetScale plans](https://planetscale.com/docs/planetscale-plans),
[Oracle Autonomous Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

## PDF и резервное object storage

| Сервис                 | Free tier / цена после                                                     | Egress                                           | Вывод                                                 |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Cloudflare R2 Standard | 10 ГБ-мес, 1 млн Class A и 10 млн Class B бесплатно; затем $0.015/ГБ-мес   | Бесплатный                                       | **Основное private PDF storage**                      |
| Backblaze B2           | Первые 10 ГБ бесплатно; затем $6.95/TБ-мес                                 | Бесплатно до 3× среднего storage, затем $0.01/ГБ | **Отдельная backup-копия**                            |
| MinIO self-hosted      | Лицензия AGPL, storage равен диску VPS                                     | Входит в трафик VPS                              | Не даёт отдельного failure domain; не основной backup |
| AWS S3 Standard        | Около $0.023/ГБ-мес + операции/egress; новые AWS credits ограничены сроком | Платный                                          | Надёжен, но сложнее и дороже R2                       |

Источники: [R2](https://developers.cloudflare.com/r2/pricing/),
[Backblaze B2](https://www.backblaze.com/cloud-storage/pricing),
[AWS S3](https://aws.amazon.com/s3/pricing/).

## Домен, DNS и TLS

Цены доменов зависят от конкретного имени, premium-статуса, валюты и налогов.
Для бюджета важнее **renewal**, а не скидка первого года.

| Регистратор/TLD      |                                                         Типичный порядок цены в год | Комментарий                                                                          |
| -------------------- | ----------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------ |
| Cloudflare Registrar |                                                     От $7.85; wholesale без наценки | Лучшее предсказуемое renewal, WHOIS privacy и DNSSEC; требует Cloudflare nameservers |
| Porkbun              |       `.com` обычно около $11, `.org` около $11, `.io` около $30–40; акции меняются | Простой интерфейс, privacy включён; сверить checkout/renewal                         |
| Namecheap            | Промо первого года часто дешевле; `.xyz` с 25.08.2026 — $21.48 registration/renewal | Renewal может быть заметно выше промо                                                |
| REG.RU               |     `.ru` обычно самый практичный для оплаты из РФ; международные зоны часто дороже | Финальную цену и продление смотреть перед оплатой                                    |
| `.io`                |                                                                   Обычно $30–60/год | Не нужен для этого проекта при экономии                                              |
| `.xyz`               |                               Уже не гарантированно дешёвый: у Namecheap $21.48/год | Не выбирать только ради старой акции                                                 |
| `.pp.ua` и подобные  |                                                   Может быть бесплатно/символически | Доверие, доступность, email reputation и правила делегирования слабее; не production |

Google Domains закрыт и продан Squarespace; Freenom не является стабильным каналом
новых бесплатных production-доменов. Бесплатный технический поддомен допустим для
staging, но публичному платному сервису нужен собственный домен.

Рекомендация: Cloudflare Registrar, если нужная зона поддерживается и доступна
оплата; иначе Porkbun. Для аудитории РФ `.ru` у российского регистратора может быть
операционно проще. DNS — Cloudflare Free. TLS — Caddy + Let's Encrypt; Cloudflare
Origin CA применять только когда origin всегда закрыт Cloudflare proxy.

Источники: [Cloudflare Registrar](https://developers.cloudflare.com/registrar/),
[Cloudflare plans](https://www.cloudflare.com/plans/),
[Namecheap `.xyz` 2026](https://www.namecheap.com/blog/price-increase-for-xyz-monster-quest-and-more-domains/).

## Почта, OIDC, платежи, карты и LLM

| Сервис                 | Бесплатно / цена                                                                                             | Ограничение                                                                               | Решение                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Resend                 | 3 000 писем/мес, 100/день, 3 домена                                                                          | При росте Pro $20/мес за 50 000                                                           | **Выбран для production**                                                 |
| Mailtrap Email API     | 4 000/мес, 150/день, 1 домен                                                                                 | 3 дня логов                                                                               | Бесплатный резерв; sandbox отдельно                                       |
| Postmark               | 100/мес бесплатно                                                                                            | Следующий план $15/мес                                                                    | Только очень малый объём                                                  |
| Amazon SES             | $0.16/1 000 Essentials; новым аккаунтам общие credits на 6 месяцев                                           | Нет прежнего постоянного SES free tier для новых аккаунтов после 21.07.2026               | Дешёв при росте, но сложнее                                               |
| Google/GitHub OIDC     | Создание приложения без абонплаты                                                                            | Квоты и provider policies; MFA owner обязателен                                           | Google для клиентов, GitHub допустим для owner/admin                      |
| Yandex/VK ID           | Обычно без абонплаты                                                                                         | Регистрация приложения, региональные правила и отдельная интеграционная приёмка           | P1 для аудитории РФ/СНГ                                                   |
| NOWPayments            | Интеграция $0; 0.5% single-currency, ещё 0.5% при conversion + network fees                                  | KYC/risk/география/минимумы зависят от аккаунта и валюты                                  | Crypto-first; предпочесть одну дешёвую сеть, проверить минимум в кабинете |
| Google Maps            | Не $200 credit: с 01.03.2025 бесплатные caps по SKU; Dynamic Maps/Geocoding обычно первые 10 000 событий/мес | Нужен billing account; сверх cap pay-as-you-go                                            | Ограничить API/IP и quota; кэшировать координаты                          |
| Groq                   | Free plan с model-specific RPM/RPD/TPM; например GPT OSS — до 30 RPM/1 000 RPD в опубликованной таблице      | Free tier без spend limits, 429 при лимите                                                | **Выбран как OpenAI-compatible старт**, fallback на шаблонный текст       |
| Gemini API             | Есть free tier для отдельных моделей/регионов                                                                | На free tier контент может использоваться для улучшения продуктов; лимиты модель-зависимы | Не отправлять персональные birth data без правовой оценки                 |
| OpenRouter free models | Цена модели $0, availability/rate limits меняются                                                            | Нет production SLA, модель может исчезнуть                                                | Только fallback/эксперимент                                               |
| Ollama                 | API $0 на своей машине                                                                                       | Модели требуют RAM/CPU; 4 ГБ VPS недостаточно для качественной генерации                  | Не запускать на основной маленькой VM                                     |

Источники: [Resend](https://resend.com/pricing), [Mailtrap](https://mailtrap.io/pricing/),
[Postmark](https://postmarkapp.com/pricing), [SES](https://aws.amazon.com/ses/pricing/),
[NOWPayments fees](https://nowpayments.io/blog/crypto-fees-explained-what-you-pay-and-how-to-pay-less),
[Google Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing),
[Groq limits](https://console.groq.com/docs/rate-limits),
[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Итоговая рекомендация: минимальный бюджет

### Нулевой старт

- Oracle Always Free A1: app + MySQL + Caddy — **$0/мес**.
- Cloudflare R2 для private PDF — **$0 до 10 ГБ**.
- Backblaze B2 для второй backup-копии — **$0 до 10 ГБ**.
- Cloudflare DNS/CDN — **$0**.
- Resend — **$0 до 3 000 писем/мес и 100/день**.
- Google/GitHub OIDC — **$0**.
- Google Maps — **$0 в пределах free cap выбранных SKU**.
- Groq free tier или шаблонный narrative fallback — **$0**.
- Swiss Ephemeris AGPL — **$0**, если deployed source публичен.
- Обязательная постоянная статья: домен — ориентир **$8–15/год** для `.com`
  у регистратора без premium-наценки, то есть примерно **$0.70–1.25/мес**.

Итого: **инфраструктура $0/мес + домен около $8–15/год**. Этот режим имеет
single-server риск и зависит от выдачи Oracle ARM capacity.

Первые расходы начнутся при превышении 10 ГБ R2, 3 000 писем/месяц, Maps/LLM
free caps, диска VM или при отсутствии Oracle capacity. Главный ранний риск — не
трафик, а отказ единственной VM; поэтому backups должны находиться вне Oracle.

### Самый бюджетный надёжный вариант

Hetzner CAX11/CX23 + R2 + B2 + Resend: примерно **€5.49–5.99/мес без VAT и
IPv4**, плюс IPv4/VAT и домен. Если регистрация Hetzner недоступна, Timeweb 4 ГБ
за 1 080 ₽/мес или DigitalOcean 4 ГБ за $24/мес. Managed DB добавлять только когда
стоимость простоя/администрирования станет выше её тарифа.
