# Минимизация расходов

**Дата:** 2026-09-10

## Нулевой бюджет для разработки

`docker-compose.sandbox.yml` полностью локален: MySQL, MinIO, payment/email/maps/LLM
mocks и Playwright. Стоимость внешних сервисов — 0; используются только ресурсы
компьютера и интернет для первоначальной загрузки образов.

## Минимальный production

На старте разумно держать приложение, MySQL, MinIO, Caddy и Uptime Kuma на одном
VPS с 4 ГБ RAM, но делать ежедневную зашифрованную копию вне сервера. Это дешевле
managed-набора, однако владелец отвечает за обновления, восстановление и disk alerts.

| Компонент   | Минимальный вариант                                                           | Компромисс                                                  |
| ----------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Compute     | Oracle Cloud Always Free ARM при наличии capacity; иначе бюджетный VPS        | free capacity/account не гарантированы                      |
| DB          | self-hosted MySQL 8                                                           | нужен off-site backup и restore rehearsal                   |
| PDF storage | MinIO на VPS + off-site backup; позднее Cloudflare R2                         | следить за диском/egress/лимитами                           |
| Email       | Resend free allowance или SMTP собственного домена                            | лимиты и deliverability проверять до релиза                 |
| LLM         | локальный Ollama или малый API hard budget                                    | локальная модель требует RAM/CPU и QA качества              |
| Maps        | кэш геокодирования + provider quota; при согласованной лицензии OSM/Nominatim | публичный Nominatim нельзя нагружать как production backend |
| Auth        | self-hosted Keycloak/Authentik с MFA                                          | эксплуатационная нагрузка; hosted OIDC проще                |
| Monitoring  | Uptime Kuma + JSON logs; Sentry free allowance                                | меньше managed гарантий                                     |
| Astrology   | Swiss Ephemeris AGPL + публичный source                                       | AGPL corresponding-source обязан быть доступен              |

Официальные страницы для проверки актуальных лимитов перед регистрацией:
[Oracle Free Tier](https://www.oracle.com/cloud/free/),
[Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[Resend pricing](https://resend.com/pricing),
[Google Maps pricing](https://mapsplatform.google.com/pricing/).
Free tiers могут измениться; budget alerts и hard quotas обязательны.

## Практический порядок

1. До внешнего staging использовать только локальный sandbox.
2. Выбрать один VPS и домен; не подключать managed DB до реальной нагрузки.
3. Кэшировать координаты, не астрологические персональные snapshots между людьми.
4. Отключить analytics по умолчанию, задать LLM/payment quotas и почтовую allowlist.
5. Ежемесячно сверять счета, storage, egress и неиспользуемые ресурсы.

Экономия не отменяет бэкапы, MFA, TLS, мониторинг и юридические обязанности.
