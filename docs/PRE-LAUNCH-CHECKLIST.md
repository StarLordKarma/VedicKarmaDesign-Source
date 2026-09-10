# Чек-лист перед публичным запуском

## Инфраструктура и релиз

- [ ] Полный локальный sandbox и CI job `sandbox-e2e` зелёные
- [ ] Release commit/tag зафиксирован; все обязательные CI jobs зелёные
- [ ] Docker image собран по SHA, просканирован и сохранён его digest
- [ ] Домен, DNS, HTTPS, HSTS и secure cookies проверены
- [ ] Firewall оставляет публичными только 80/443; SSH ограничен ключами/IP
- [ ] `/health` и `/ready`, uptime alert, error monitoring и disk alerts работают
- [ ] Rollback image и ответственный за остановку заказов зафиксированы

## Данные и безопасность

- [ ] Production MySQL имеет отдельного least-privilege пользователя и TLS
- [ ] Миграции применены после snapshot; restore проверен в отдельной БД
- [ ] S3 bucket приватный, versioning/encryption/lifecycle/CORS настроены
- [ ] OIDC owner account защищён MFA; чужой пользователь не видит `/admin`
- [ ] Все secrets уникальны, находятся вне Git и имеют план ротации
- [ ] Логи не содержат токены, birth data, email и storage keys
- [ ] Retention, export и deletion процедуры проверены

## Функциональная приёмка

- [ ] Sandbox payment + подписанный повторный IPN прошли идемпотентно
- [ ] RU/EN/DE/ES заказ, narrative и PDF проверены человеком
- [ ] D1, D9, аспекты, накшатра/pada и Vimshottari сверены с эталонным ПО
- [ ] Owner review обязателен до отправки; synthetic report нельзя доставить
- [ ] Email, защищённая status-ссылка, download, revoke и expiry проверены
- [ ] Отказы Maps/LLM/S3/email/payment дают безопасную ошибку и audit event
- [ ] Scheduler, retry/dead-letter процедуры и оповещения проверены

## Лицензирование и право

- [ ] `VITE_SOURCE_CODE_URL` ведёт к corresponding source точной deployed версии
- [ ] AGPL-3.0-or-later и Swiss Ephemeris notices доступны пользователям
- [ ] Выбран бесплатный AGPL-режим; коммерческая лицензия не используется
- [ ] Репозиторий/зеркало по `VITE_SOURCE_CODE_URL` доступно каждому пользователю
- [ ] Privacy notice содержит имя/адрес/контакты реального контролёра данных
- [ ] Terms, refund/cancellation и consumer disclosures проверены по рынкам
- [ ] Зафиксированы основания обработки, processors, transfers и сроки хранения
- [ ] Согласие на обработку и отдельное optional analytics consent журналируются
- [ ] Формулировки не обещают абсолютную анонимность fiat-платежей
- [ ] Описана минимизация данных: сайт не хранит карточные реквизиты и удаляет
      платёжные/клиентские данные по утверждённому retention schedule
- [ ] Схема самозанятого, налоговые чеки и приём средств на зарубежный счёт
      проверены профильным юристом/бухгалтером и банком
