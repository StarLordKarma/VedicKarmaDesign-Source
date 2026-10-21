# Платёжные шлюзы: приватность владельца и применимость

**Дата проверки:** 2026-09-13  
**Проект:** Karma Life Design  
**Цель:** минимизировать объём данных владельца у платёжного посредника, не
создавая ложных обещаний анонимности и не обходя применимое право.

## Важное ограничение

`No KYC` у шлюза означает только отсутствие проверки со стороны этого шлюза.
Это не делает владельца юридически или технически анонимным: домен, hosting,
email, IP-адреса, публичные блокчейны, fiat on-ramp/off-ramp и налоговые правила
могут раскрывать личность. Self-hosting уменьшает число посредников и риск
заморозки шлюзом, но переносит безопасность, учёт, AML/sanctions screening и
восстановление на владельца.

## Сравнение

| Вариант | KYC/KYB и custody | XMR | Комиссии | Интеграция с проектом | Итог |
| --- | --- | --- | --- | --- | --- |
| **NOWPayments** | Для crypto-to-crypto обычно без KYB, но AML-trigger может поставить транзакцию на hold и потребовать ID, source-of-funds и selfie. Hosted processor переводит средства через свою систему; custody — отдельная опция. | Да | Текущая официальная цена: 1% без конвертации, 1.5% с конвертацией/fixed rate, плюс network fees. | Уже реализованы REST invoice, HMAC IPN, status mapping и тестовый harness. Самый дешёвый путь запуска. | Сохранить как быстрый основной/резервный шлюз, но не считать анонимным или нецензурируемым. |
| **BTCPay Server** | Self-hosted, open-source, non-custodial; регистрации и KYC у BTCPay нет. | Через community plugin и собственные Monero daemon/wallet RPC; поддержка не core и требует сопровождения. | 0% processor fee; остаются network, node/VPS, backup и эксплуатация. | Отличный REST/Greenfield API и webhooks, но отдельный stateful stack тяжелее текущего Northflank sandbox. | Лучший долгосрочный вариант для BTC/Lightning и максимального контроля; XMR требует отдельного threat model. |
| **Blockonomics** | Hosted API, но direct-to-wallet/non-custodial; заявляет no KYC. Получает xPub и метаданные платежей. | Нет | Первые 10 платежей бесплатно, затем 1%; network fee отдельно. | Простая API/webhook интеграция с Express. | Хороший резервный BTC-only шлюз, проще BTCPay, но меньше приватности метаданных и нет XMR. |
| **OxaPay** | Hosted account/wallet; маркетинг заявляет простой/no-KYC старт, однако AML/KYC и блокировка по Terms остаются возможными. Наличие внутреннего wallet означает custodial exposure. | Да | Merchant fee заявлен от 0.4%; transfer/network fees зависят от монеты, для XMR опубликована отдельная withdrawal fee. | REST API и callbacks подходят, но потребуется новый adapter и проверка подписи/идемпотентности. | Только как экспериментальный резерв после юридической проверки и малолимитного staging-теста. |
| **Plisio** | Hosted/custodial workflow. AML policy прямо оставляет право потребовать KYC для отдельных клиентов, адресов и активов. | Да | API/cash-out около 0.5%; для XMR опубликованы дополнительные тарифы/минимумы. | API применим, но новой интеграцией дублирует NOWPayments. | Не даёт убедительного выигрыша по приватности или custody; не рекомендован основным. |
| **PayRam** | Self-hosted, self-custody, без signup/KYC/KYB у разработчика; compliance полностью на владельце. | Нет в текущем официальном списке | Processor fee отсутствует; остаются gas, VPS, RPC и operational costs. | REST API, HMAC webhook, Docker; требует отдельного сервиса, БД/Redis и серьёзного security review. | Перспективен для stablecoins, но молодой проект и без XMR; пилотировать, не ставить сразу единственной платёжной системой. |
| **AnonymPass** | Заявляет direct-to-wallet, non-custodial и no KYC. Hosted coordination всё равно видит метаданные. | Не заявлен | 0.25% по заявлению сайта, плюс network fees. | Публичный материал ориентирован прежде всего на WordPress plugin; зрелость универсального API нужно подтвердить до разработки. | Низкий приоритет: мало проверяемой технической и юридической информации. |
| **Scuntra** | Заявляет no KYC и settlement на указанные кошельки; остаётся hosted webhook dependency. | Да | Прозрачная актуальная полная тарифная таблица не найдена. | Готовый продукт ориентирован на WooCommerce, не на Node/tRPC. | Не подходит без документированного standalone API, Terms и security review. |
| **Card2Crypto** | Заявляет no signup/no KYC и forwarding в кошелёк, но зависит от внешнего API и множества fiat on-ramp партнёров, у которых свои KYC/гео-правила. | Нет в опубликованном списке | 1.5% + blockchain fees; card-provider fees/minimums различаются. | Официальная реализация — WordPress/WooCommerce; кастомный adapter увеличит риск. | Не рекомендован: заявления об «100% anonymity» юридически и технически чрезмерны. |
| **VelozaPay** | WooCommerce plugin, direct-to-wallet, no KYC у VelozaPay; routing infrastructure остаётся посредником метаданных. | Нет | Нет monthly/setup fee; точный «small flat percentage» публично не раскрыт на главной странице. | Только WooCommerce; текущему React/Express stack не соответствует. | Не подходит без standalone API; нет XMR и прозрачной цены. |
| **Самостоятельный XMR checkout** | Собственные monerod/wallet-rpc, non-custodial, без account/KYC у процессора. | Native | 0% processor fee + сеть/VPS/операции. | Потребуются invoice/address lifecycle, confirmations, reorg handling, webhook equivalent, monitoring и backups. | Максимум приватности и контроля, но максимальный engineering/operations риск; отдельный будущий проект, не срочная замена. |

## Проверка спорного тезиса о NOWPayments

Актуальные официальные FAQ и Terms не подтверждают универсальный «лимит €700
без полного KYC». Они говорят, что crypto-to-crypto обычно запускается без KYB,
но подозрительная транзакция может быть удержана до AML/KYC; fiat требует
проверки провайдера. Поэтому €700 нельзя использовать как продуктовую или
юридическую гарантию без письменного подтверждения NOWPayments для конкретного
merchant account и юрисдикции.

Дополнительный существенный риск: опубликованная текущая версия Terms указывает
широкие prohibited jurisdictions и право отказать в обслуживании. Перед запуском
владелец должен письменно подтвердить допустимость своей резидентности, целевых
рынков и вида услуг.

## Рекомендация

1. **Сейчас — сохранить NOWPayments**, завершить уже подготовленный staging E2E
   с нулевым реальным движением средств и не включать custody/fiat. Это минимальный
   объём изменений, поддерживает XMR и даёт быстрый launch path. Держать на шлюзе
   только операционный минимум и быстро выводить средства в self-custody.
2. **Параллельно — пилот BTCPay Server для BTC/Lightning** на отдельном VPS.
   Это наиболее зрелый self-hosted путь с нулевой processor fee и без риска
   заморозки аккаунта самим шлюзом. Не размещать тяжёлый node stack в текущем
   Northflank app container.
3. **Для XMR — сначала оценить BTCPay Monero plugin против отдельного Monero
   checkout**, включая поддержку, обновления, backup wallet, RPC isolation и
   мониторинг. До завершения security review XMR оставить через NOWPayments.

PayRam можно пилотировать третьим вариантом для stablecoins после code/security
review. Blockonomics подходит как простой BTC fallback. OxaPay, Plisio,
AnonymPass и WooCommerce-ориентированные шлюзы не дают достаточного выигрыша,
чтобы сейчас заменять работающую интеграцию.

## Что требуется от владельца

- подтвердить страну резидентности/регистрации бизнеса и целевые страны не в
  чате с секретами, а как обычное юридическое решение;
- получить письменный ответ NOWPayments о допустимости merchant account,
  astrology/digital-report услуг, XMR и целевых рынков;
- выбрать стратегию: NOWPayments-only на MVP, NOWPayments + BTCPay pilot или
  немедленный self-hosted-first запуск;
- создать отдельные self-custody receiving wallets и процедуру backup/recovery;
- до fiat/card flows получить локальную юридическую консультацию по налогам,
  AML/sanctions и consumer protection.

## Источники

- NOWPayments: [FAQ, KYB, лицензирование и AML](https://nowpayments.io/help),
  [актуальные комиссии](https://nowpayments.io/pricing),
  [документы при AML hold](https://nowpayments.io/help/security/kyc-aml/how-are-my-documents-stored-after-the-kyc-aml-procedure),
  [Terms](https://nowpayments.io/doc/fd-tos.pdf?v=1.3).
- BTCPay Server: [официальная документация](https://docs.btcpayserver.org/),
  [altcoin/Monero integration](https://docs.btcpayserver.org/Development/Altcoins/).
- Blockonomics: [pricing и custody model](https://help.blockonomics.co/support/solutions/articles/33000208618-how-blockonomics-pricing-works-).
- OxaPay: [pricing](https://oxapay.com/pricing),
  [Monero](https://oxapay.com/currencies/monero).
- PayRam: [официальный GitHub](https://github.com/Payram),
  [no-KYC model и compliance caveat](https://payram.com/no-kyc-crypto-payment-gateway),
  [REST/webhook integrations](https://www.payram.com/integrations).
- Plisio: [AML policy](https://plisio.net/docs/aml.pdf),
  [fee information](https://plisio.net/pl/faq/fee-information).
- AnonymPass: [официальный сайт](https://anonympass.com/).
- Card2Crypto: [WordPress plugin disclosure](https://wordpress.org/plugins/card2crypto-crypto-payment-gateway/).
- VelozaPay: [product and custody claims](https://velozapay.com/),
  [legal inquiries](https://velozapay.com/legal-inquiries/).
- Scuntra: [WordPress listing](https://wordpress.com/plugins/scuntra-for-woocommerce).
