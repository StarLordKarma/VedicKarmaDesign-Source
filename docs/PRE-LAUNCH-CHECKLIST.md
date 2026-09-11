# Чек-лист перед публичным запуском

## Инфраструктура и релиз

- [x] Создан Northflank Free project в Europe West (London)
- [x] Создан сервис `vedic-karma-app` на максимальном free plan (512 MB)
- [x] Создан private MySQL 8.4.11 addon `vedic-karma-mysql` (6 GB NVMe)
- [ ] Проверен перенос на Oracle/Hetzner/Timeweb при исчерпании free tier
- [x] MySQL не публикует 3306, данные находятся на persistent volume
- [ ] R2 PDF bucket private; B2 backup находится в отдельном account/failure domain
- [ ] Выполнены `SETUP-SERVER.md`, `SETUP-DNS.md` и `SETUP-SECRETS.md`
- [ ] Полный локальный sandbox и CI job `sandbox-e2e` зелёные
- [ ] Release commit/tag зафиксирован; все обязательные CI jobs зелёные
- [ ] Docker image собран по SHA, просканирован и сохранён его digest
- [ ] Домен, DNS, HTTPS, HSTS и secure cookies проверены
- [ ] Firewall оставляет публичными только 80/443; SSH ограничен ключами/IP
- [ ] `/health` и `/ready`, uptime alert, error monitoring и disk alerts работают
- [ ] Rollback image и ответственный за остановку заказов зафиксированы
- [ ] `.env.production` имеет mode 600, отсутствует в Git и прошёл validation
- [ ] `docker-compose.prod.yml` собран и `/ready` отвечает на точном release SHA

## Данные и безопасность

- [ ] Production MySQL имеет отдельного least-privilege пользователя и TLS
- [x] Миграции `0000`–`0029` применены через TLS задачей `vedic-karma-migrate`
- [ ] Restore проверен в отдельной БД после snapshot/backup
- [ ] S3 bucket приватный, versioning/encryption/lifecycle/CORS настроены
- [ ] OIDC owner account защищён MFA; чужой пользователь не видит `/admin`
- [ ] Все secrets уникальны, находятся вне Git и имеют план ротации
- [ ] Логи не содержат токены, birth data, email и storage keys
- [ ] Retention, export и deletion процедуры проверены
- [ ] `backup:prod` создал checksum/off-site copy и restore выполнен в новой БД

## Функциональная приёмка

- [ ] Sandbox payment + подписанный повторный IPN прошли идемпотентно
- [ ] Настоящие OIDC/NOWPayments/Resend/S3/Maps/LLM прошли staging acceptance
- [ ] RU/EN/DE/ES заказ, narrative и PDF проверены человеком
- [ ] D1, D9, аспекты, накшатра/pada и Vimshottari сверены с эталонным ПО
- [ ] Owner review обязателен до отправки; synthetic report нельзя доставить
- [ ] Email, защищённая status-ссылка, download, revoke и expiry проверены
- [ ] Отказы Maps/LLM/S3/email/payment дают безопасную ошибку и audit event
- [ ] Scheduler, retry/dead-letter процедуры и оповещения проверены
- [ ] Resend free limits/alerts и Maps SKU quotas проверены в кабинетах
- [ ] LLM template fallback проверен: превышение quota не ломает расчёт/PDF

## Лицензирование и право

- [x] `VITE_SOURCE_CODE_URL` ведёт к corresponding source точной deployed версии
- [ ] AGPL-3.0-or-later и Swiss Ephemeris notices доступны пользователям
- [ ] Выбран бесплатный AGPL-режим; коммерческая лицензия не используется
- [x] Репозиторий/зеркало по `VITE_SOURCE_CODE_URL` доступно каждому пользователю
- [ ] Source tag/commit совпадает с digest запущенного image
- [ ] Privacy notice содержит имя/адрес/контакты реального контролёра данных
- [ ] Terms, refund/cancellation и consumer disclosures проверены по рынкам
- [ ] Зафиксированы основания обработки, processors, transfers и сроки хранения
- [ ] Согласие на обработку и отдельное optional analytics consent журналируются
- [ ] Формулировки не обещают абсолютную анонимность fiat-платежей
- [ ] Реквизиты из `LEGAL-DATA-TEMPLATE.md` внесены и прошли юридический review
- [ ] Все 10 строк `CHART-VERIFICATION.md` заполнены и подписаны специалистом
- [ ] Описана минимизация данных: сайт не хранит карточные реквизиты и удаляет
      платёжные/клиентские данные по утверждённому retention schedule
- [ ] Схема самозанятого, налоговые чеки и приём средств на зарубежный счёт
      проверены профильным юристом/бухгалтером и банком
