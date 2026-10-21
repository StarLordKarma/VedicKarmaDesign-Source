# Архитектура платёжных провайдеров

**Дата проверки:** 2026-09-17  
**Статус:** адаптеры NOWPayments, Heleket и PayCrypto.Global реализованы;
выбирается ровно один оператор, реальные credentials ещё не принимались.

## Принятое решение

Сервер использует единый контракт `PaymentProvider`: создание hosted checkout,
путь и проверка подписи webhook, нормализация статусов и строгая проверка
оплаченного состояния.
Активный адаптер выбирается через `PAYMENT_PROVIDER`; неизвестное значение
останавливает запуск. Production guard требует credentials только выбранного
оператора и разрешает исключительно официальные API hosts.

Возврат клиента на `success_url` не подтверждает оплату. Доступ к отчёту и запуск
генерации возможны только после проверенного server-to-server уведомления.
`partially_paid` нормализуется как `underpaid` и не запускает отчёт. После
подтверждения оплаты более поздний неплатёжный статус не может откатить заказ.
Переход `confirmed` → `finished` не создаёт повторное уведомление или второй
отчёт.

## PayCrypto.Global

PayCrypto реализован как возможный non-custodial резерв. Официальная
документация описывает `getpaylink`, прямое зачисление на заданные merchant
addresses и события `new_transaction`/`payment_done`. При этом опубликованный
контракт webhook полагается на allowlist IP-адресов и не описывает
криптографическую подпись сообщения. За Cloudflare/reverse proxy одного
сравнения адреса недостаточно. Поэтому адаптер добавляет обязательный случайный
`PAYCRYPTO_WEBHOOK_TOKEN` (не менее 32 символов) в HTTPS callback URL и сверяет
его constant-time. Для `payment_done` дополнительно сверяются order ID, точная
сумма и валюта с записью заказа; другие типы событий не разблокируют отчёт.

Для production-адаптера потребуются:

1. точное подтверждение владельца, что выбран именно `paycrypto.global`, а не
   другой одноимённый сервис;
2. API key только в secret storage и receiving addresses по разрешённым сетям;
3. желательно письменное подтверждение signed webhook либо независимая
   server-side проверка транзакции, адреса, сети и confirmations по узлу;
4. тестовые callbacks, повторная доставка и проверка under/overpayment;
5. юридическая проверка Terms, допустимости digital astrology reports и стран
   продаж.

Адаптер включается `PAYMENT_PROVIDER=paycrypto`, но не считается production
принятым до реального ограниченного E2E. Bearer-token компенсирует отсутствие
публично описанной подписи, но слабее signed payload и требует аккуратной
защиты URL в кабинете оператора и журналах.

## Heleket

Реализованы invoice API, MD5/base64 request signing, проверка подписи webhook,
официальные статусы, защита от underpayment и hosted checkout. Адаптер включается
`PAYMENT_PROVIDER=heleket`, но не считается production принятым до проверки
merchant account, фактического callback и тестовой оплаты без реального списания.

## Переменные окружения

- NOWPayments: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`;
- Heleket: `HELEKET_MERCHANT_ID`, `HELEKET_PAYMENT_API_KEY`;
- PayCrypto.Global: `PAYCRYPTO_API_KEY`, `PAYCRYPTO_WEBHOOK_TOKEN`,
  `PAYCRYPTO_COINS_JSON`.

Значения не передаются в чат и не коммитятся. Опциональные base URL существуют
для sandbox, но independent production принимает только официальные hosts.

## Интерфейс checkout

На сайте остаётся один честный вариант — криптовалютный hosted checkout. Кнопка
«Card» не показывается, пока нет рабочего card acquirer и полного legal/KYB
потока. Валюту и сеть выбирает пользователь на странице активного провайдера;
сайт не обещает наличие конкретной монеты до получения актуального списка от
API.

## Официальные источники

- NOWPayments API: https://documenter.getpostman.com/view/7907941/2s93JusNJt
- Heleket API: https://doc.heleket.com/
- PayCrypto.Global API: https://paycrypto.global/docs
