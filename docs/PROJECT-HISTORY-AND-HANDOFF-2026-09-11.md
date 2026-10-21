# Полная история проекта и передача контекста в новый чат

**Проект:** Vedic Karma Design / Karma Life Design  
**Дата актуализации:** 2026-09-11  
**Рабочая директория:** `/Users/namesurname/Documents/Codex/Github starlordkarma site`  
**Основной репозиторий:** `https://github.com/StarLordKarma/VedicKarmaDesign`  
**Публичный AGPL source mirror:** `https://github.com/StarLordKarma/VedicKarmaDesign-Source`  
**Основной домен:** `https://karmalifedesign.com`  
**Назначение документа:** полностью передать историю, архитектуру, решения,
текущее состояние, риски и следующий план новому чату без необходимости
восстанавливать контекст по старой переписке.

> В документе намеренно нет паролей, приватных ключей, токенов, строк подключения,
> персональных данных владельца и клиентов. Секреты должны оставаться только в
> Northflank/GitHub Environment Secrets или в закрытом `.env.production`.

## 1. Цель и продуктовая концепция

Проект создаётся как многоязычный сервис заказа персональных консультаций и
PDF-отчётов по ведической астрологии (джйотиш). Основная аудитория запуска —
Россия и страны СНГ, затем Европейский союз и США.

Ключевой пользовательский путь:

1. Клиент выбирает услугу и язык.
2. Указывает необходимые данные рождения и контакт для доставки.
3. Подтверждает заказ и производит оплату.
4. Система создаёт заказ и задание на подготовку отчёта.
5. Астрологические данные рассчитываются автоматически.
6. Владелец проверяет, редактирует и утверждает материал в админ-панели.
7. PDF сохраняется в закрытом объектном хранилище.
8. Клиент получает письмо и защищённую ссылку.
9. Скачивание доступно только после утверждения и отправки, ограничено сроком,
   может быть отозвано и регистрируется в журнале аудита.

Криптовалюта остаётся приоритетным способом оплаты. Для фиатных платежей проект
не обещает абсолютную анонимность: используются формулировки о минимизации
собираемых сайтом данных и об ограниченном сроке хранения платёжных сведений.
Платёжные провайдеры, банки и требования закона могут идентифицировать стороны.

## 2. Технологическая архитектура

- монолитное TypeScript-приложение;
- React + Vite на клиенте;
- Node.js/Express и tRPC на сервере;
- MySQL и Drizzle ORM, миграции `0000`–`0029`;
- S3-совместимое закрытое хранилище для PDF;
- production-сборка клиента и сервера в `dist`;
- Vitest для модульных и интеграционных тестов;
- Playwright для сквозных sandbox-сценариев;
- Docker/Compose для sandbox, staging и независимого production;
- GitHub Actions для типов, тестов, сборки, аудита, контейнеров, MySQL и E2E;
- Caddy/Cloudflare для HTTPS и DNS в независимом варианте;
- Northflank как выбранная бесплатная стартовая площадка.

В production должны применяться реальные коннекторы, включаемые переменными
окружения. Mock-компоненты разрешены только в sandbox; конфигурационные проверки
запрещают небезопасные mock-адреса в production.

## 3. Хронология выполненной работы

### 3.1. Формирование продукта и базового заказа

- Спроектированы страницы услуг, booking flow, цены и валюты.
- Созданы серверные сущности пользователей, заказов, платежей и заданий отчётов.
- Реализованы проверки данных и переходов между состояниями заказа.
- Добавлены owner-only административные маршруты и интерфейсы.
- Подготовлены базовые legal/disclaimer материалы и правила хранения данных.

Подробная ранняя история сохранена в:

- `ETAP-ODIN-FULL-PROJECT-HISTORY.md`;
- `docs/PROJECT-HISTORY-2026-08.md`;
- `docs/AI-HANDOFF-AND-RESTORE-2026-08.md`.

### 3.2. Report Studio и ведические расчёты

- Разработана спецификация второго этапа Report Studio.
- Интегрирован Swiss Ephemeris через пакет `sweph`.
- Выбран режим AGPL-3.0-or-later; покупка коммерческой лицензии не планируется.
- Реализованы сидерические положения с Лахири, D1, D9, накшатры, пады,
  Вимшоттари-даша и ведические аспекты по Парашаре.
- Добавлены тесты расчётного адаптера и эталонная методика независимой сверки.
- Созданы очередь/worker подготовки отчётов, геокодирование и часовые пояса.
- Подготовлен LLM narrative layer с возможностью лимитировать расходы.
- Реализованы генерация PDF, редактура, утверждение и доставка клиенту.

Критическое ограничение: автоматические тесты защищают реализованные формулы от
регрессий, но окончательная астрологическая приёмка требует независимого сравнения
как минимум десяти карт с признанным ПО и практикующим специалистом по джйотиш.
Методика находится в `docs/CHART-VERIFICATION.md`.

### 3.3. Защищённая доставка PDF

- Клиент получает status-ссылку без раскрытия ключа объекта в хранилище.
- Скачивание разрешается только после утверждения и отправки отчёта.
- Токен имеет срок действия и поддерживает отзыв.
- Токены маскируются в серверных журналах.
- Применяется rate limiting.
- Факт скачивания записывается в аудит.
- Написаны тесты статусов, доставки, скачивания и административного flow.

### 3.4. Локализация

Интерфейс и основные тексты отчётов поддерживают четыре языка:

- русский;
- английский;
- немецкий;
- испанский.

Добавлены проверки словарей, UI и PDF-потока. При добавлении нового текста он
должен появляться во всех четырёх словарях в одном изменении.

### 3.5. Платежи, почта и внешние интеграции

- Подготовлен production-коннектор NOWPayments.
- Реализованы IPN/webhook-проверки, подпись и обработка статусов.
- Есть тестовый harness и sandbox mock, не используемый в production.
- Подготовлена отправка писем через Resend: заказ и готовность отчёта.
- Предусмотрены S3, OIDC, карты и LLM через переменные окружения.
- Добавлены тесты наличия/безопасности production credentials.

Полная реальная проверка этих коннекторов ещё требует отдельных production или
staging-реквизитов владельца. Их нельзя отправлять в чат или коммитить.

### 3.6. Sandbox и контроль качества

Создан полностью локальный sandbox без реальных денег и внешних ключей:

- приложение;
- MySQL;
- MinIO вместо внешнего S3;
- MailHog/mock-почта;
- mock-платежи;
- mock-карты и mock-LLM;
- безопасная sandbox-авторизация администратора;
- сиды пользователей, заказов и заданий отчётов;
- три Playwright E2E-сценария полного цикла.

Основные документы:

- `docs/SANDBOX-GUIDE.md`;
- `docs/E2E-TEST-SCENARIOS.md`;
- `docs/SANDBOX-CREDENTIALS-NEEDED.md`;
- `docs/SANDBOX-REPORT-2026-09-10.md`.

Последний полностью зафиксированный release gate до текущего live deployment:

- 189 тестов пройдено;
- 12 внешних тестов ожидаемо пропущено;
- всего 201 тест;
- TypeScript и lint — без ошибок;
- production build — успешно;
- production dependency audit — известных уязвимостей нет;
- production-контейнер — успешно в CI;
- MySQL migration/integration — успешно в CI;
- sandbox Playwright E2E — 3/3 успешно;
- GitHub Actions run №15 и последующие подготовительные runs были зелёными.

Перед новым релизом результаты необходимо прогнать повторно и записать новый номер
workflow, commit SHA и image digest.

### 3.7. Безопасность и эксплуатация

- Секреты вынесены в окружение и отсутствуют в Git.
- Настроены production guards для mock-сервисов.
- Реализованы rate limiting, аудит и маскирование чувствительных URL/токенов.
- Доступ владельца отделён от sandbox-авторизации.
- Для MySQL Northflank включено обязательное TLS-подключение.
- Подготовлены backup/restore scripts для MySQL и S3.
- Созданы health/readiness endpoints и production smoke test.
- Документированы мониторинг, резервные копии и восстановление.

### 3.8. Лицензирование AGPL

- В репозитории есть `LICENSE`, `NOTICE` и `THIRD_PARTY_LICENSES.md`.
- Swiss Ephemeris и обязательства AGPL описаны в README и документации.
- UI содержит ссылку на соответствующий исходный код.
- Основной репозиторий остаётся приватным.
- Создано публичное зеркало:
  `https://github.com/StarLordKarma/VedicKarmaDesign-Source`.
- Для зеркала подготовлен workflow `.github/workflows/publish-agpl-source.yml`.
- Отдельный deploy key зеркала ограничен этим репозиторием.
- Production build должен получать точный публичный source URL через
  `VITE_SOURCE_CODE_URL`.

Перед каждым публичным deployment нужно убедиться, что зеркало содержит точный
corresponding source развёрнутой версии, инструкции сборки, патчи и лицензии.

### 3.9. Минимизация расходов

Изначально сравнивались Oracle Always Free, Fly.io, Railway, Render, Hetzner,
DigitalOcean, Lightsail, Google Cloud, Vercel с отдельным backend, малые VPS и
собственное железо. Из-за проблем регистрации Oracle выбран Northflank Developer
Sandbox как вариант $0/месяц на старте.

Текущий бюджетный стек:

- Northflank app: бесплатный sandbox compute в пределах действующих лимитов;
- Northflank MySQL addon: бесплатный sandbox addon в пределах лимитов;
- Cloudflare Free: DNS, proxy/edge и управление сертификатами;
- домен `karmalifedesign.com`: оплачен у NamesLink за $3.82 по промо;
- указанная в момент покупки цена продления: около $11.50–11.68 в год;
- публичное AGPL-зеркало GitHub: бесплатно;
- Resend/Maps/LLM/S3 — free tiers или отключение до появления необходимости.

Free tier не является production SLA. При первых стабильных продажах рекомендуемый
переход — недорогой VPS с Docker Compose либо платный tier Northflank. Детальный
анализ находится в `docs/COST-ANALYSIS-2026-09-10.md` и
`docs/COST-MINIMIZATION.md`.

### 3.10. Домен и DNS

- Зарегистрирован `karmalifedesign.com` у NamesLink.
- WHOIS privacy и registrar lock включены.
- Домен добавлен в Cloudflare Free.
- Nameservers регистратора заменены на выданные Cloudflare.
- В Cloudflare добавлены ownership TXT и DNS-only CNAME для apex и `www` на
  Northflank targets.
- Оба custom domain в Northflank подтверждены и связаны с HTTP-портом 3000.
- Сертификаты Northflank были выпущены; после восстановления приложения требуется
  повторно проверить HTTPS и конечную цепочку Cloudflare.

## 4. Важные коммиты и этапы

Ниже перечислены ориентиры истории; полный источник истины — `git log`.

| Коммит                | Содержание                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `5b31667`             | deployment, лицензирование, безопасность и итоговые отчёты                                            |
| `c206e8b`             | sandbox, E2E, минимизация расходов и AGPL compliance                                                  |
| `2bdef33`             | production config и список необходимых credentials                                                    |
| `5f85268`             | обновление release checks и CI actions                                                                |
| `d896b2d`             | инфраструктура запуска с нулевой стартовой стоимостью                                                 |
| `edefc07`             | документирование зелёного zero-cost launch CI                                                         |
| `9c3ab71`             | Northflank preview и публичное AGPL-зеркало                                                           |
| `9be754c`             | runtime migrations для Northflank MySQL                                                               |
| `35c0e64`             | отдельный SSH key для AGPL mirror                                                                     |
| `ce5f193`             | безопасные коды ошибок миграции MySQL                                                                 |
| `ce1961d`             | обязательный TLS для Northflank MySQL                                                                 |
| `c6ccc5a`             | завершение migration flow в Northflank                                                                |
| `c3505d7` / `9a027ae` | одинаково подготовленный single-stage Northflank image, созданный параллельно через GitHub и локально |

Параллельные коммиты `c3505d7` и `9a027ae` были безопасно объединены локальным
merge-коммитом; файлы не удалялись и история не переписывалась.

## 5. Текущее состояние live deployment на 2026-09-11

Northflank:

- проект: `Vedic Karma Design`;
- service: `vedic-karma-app`;
- публичный HTTP port: 3000;
- migration job: `vedic-karma-migrate`;
- runtime migration command: `pnpm db:migrate:runtime`;
- MySQL addon связан с сервисом отдельными `NF_VEDIC_KARMA_MYSQL_*` переменными;
- миграции `0000`–`0029` были успешно применены;
- technical preview:
  `https://p01--vedic-karma-app--mbb49nqg858d.code.run/`.

На момент диагностики публичный адрес отвечал HTTP 503. Сначала runtime logs
показали:

```text
Error: Cannot find module '/app/dist/index.js'
```

Это не DNS-проблема. Первый multi-stage image не содержал ожидаемый production
bundle. Для диагностики создан `deploy/Dockerfile.northflank` и portable Dockerfile
переведён в single-stage режим, который:

1. устанавливает зависимости;
2. копирует весь source;
3. выполняет production build;
4. явно проверяет наличие `/app/dist/index.js`;
5. удаляет dev dependencies;
6. запускает `/app/dist/index.js` от непривилегированного пользователя.

Корректировка добавила имя stage `runtime`. Однако форма Northflank
дважды отклонила смену пути внутренним сообщением `Match failed` и после reload
возвращала `/deploy/Dockerfile.independent`. Поэтому применён более надёжный обход:
сам уже выбранный `Dockerfile.independent` переведён в эквивалентный single-stage
режим с явной проверкой `/app/dist/index.js`. Он остаётся переносимым для обычного
Docker Compose и не требует изменения Build options. После его публикации Northflank
сборка `2f3c202` выявила окончательную причину: build создавал
`dist/_core/index.js`, а runtime обоснованно ожидал `dist/index.js`. В `package.json`
выходы двух server entrypoints теперь заданы явно через `--outfile=dist/index.js`
и `--outfile=dist/migrate.js`. Результат следующей сборки нужно подтвердить по
Northflank и live URL.

Фактический итог после deployment commit `006cd54`:

- Northflank показывает активный commit `006cd54` и состояние service `Running`;
- `https://karmalifedesign.com/health` — HTTP 200,
  `{"ok":true,"service":"vedic-astrology-booking"}`;
- `https://karmalifedesign.com/ready` — HTTP 200,
  `{"ok":true,"checks":{"database":true}}`;
- `https://karmalifedesign.com/` — HTTP 200 и отдаёт production HTML;
- `https://www.karmalifedesign.com/` — HTTP 200 по HTTP/2;
- в ответах присутствуют защитные headers, включая `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy` и ограниченный `Permissions-Policy`.

Таким образом, инцидент 503 устранён. Это подтверждает доступность приложения и
БД, но не заменяет функциональную приёмку платежей, email, PDF и owner flow.

## 6. Что проверено в репозитории на предмет мусора

На 2026-09-11 выполнен аудит локального дерева и отслеживаемых Git-файлов.

Подтверждено:

- `node_modules/` игнорируется и не хранится в Git;
- `dist/` игнорируется и не хранится в Git;
- `.DS_Store` игнорируется и не хранится в Git;
- build/test artifacts, coverage, logs, backups и runtime `.env` игнорируются;
- среди отслеживаемых файлов нет случайных production `.env`;
- отслеживаемые `.env.*.example` являются шаблонами и ожидаемы;
- крупных бинарных артефактов в tracked tree не обнаружено;
- самый крупный tracked-файл — обычный lockfile, далее исходники и миграционные
  snapshots разумного размера;
- приватные ключи и реальные credentials в документацию не добавлялись.

Наблюдения, не требующие автоматического удаления:

- локально присутствуют игнорируемые `.DS_Store`, `dist/` и `node_modules/` — это
  нормальные рабочие файлы, GitHub их не содержит;
- в корне много исторических Markdown-документов. Это не технический мусор: они
  фиксируют решения Manus/Codex и восстановление проекта. После запуска их можно
  перенести в `docs/archive/` отдельным осознанным коммитом, но удалять сейчас не
  следует;
- `todo.md` велик для списка задач, однако содержит исторический рабочий контекст;
  перед архивированием его нужно вручную сверить с актуальным checklist;
- `client/public/__manus__/debug-collector.js` — самый заметный кандидат на будущую
  ручную проверку. Нельзя удалять его без проверки фактического использования и
  влияния на клиентский runtime.

Вывод: опасного или дорогого «мусора» в GitHub не найдено. Автоматическое удаление
не производилось, чтобы не потерять историю или работающий код.

## 7. Оставшиеся внешние данные и решения владельца

Для полноценного публичного запуска ещё нужны или должны быть подтверждены:

1. Production/staging OIDC application и owner account с MFA.
2. Ограниченные NOWPayments API/IPN credentials.
3. Resend account и подтверждённый почтовый поддомен.
4. S3-compatible private bucket, если PDF не будут храниться в Northflank volume.
5. Ограниченный Google Maps key с quota/billing caps, если карты включаются.
6. Отдельный LLM project key с жёстким расходным лимитом либо бесплатный provider.
7. Реквизиты владельца/оператора данных для privacy policy, terms и оферты.
8. Независимое принятие десяти эталонных астрологических карт.
9. Решение о production SLA: оставить бесплатный Northflank на MVP или перейти на
   минимальный платный VPS после первого трафика.

Безопасный способ передачи: создать значения в Northflank Secrets или GitHub
Environment Secrets согласно `docs/PRODUCTION-CREDENTIALS-NEEDED.md` и сообщить
только имена добавленных переменных. Сами значения в чат не присылать.

## 8. Точный план следующих действий

### P0 — восстановить работающий публичный URL (выполнено 2026-09-11)

1. Исправленный build script с явным `dist/index.js` опубликован.
2. Автоматический Northflank build/deploy ветки `main` завершён.
3. Build содержит обязательную проверку `/app/dist/index.js`.
4. Service перешёл в `Running`.
5. `/health`, `/ready`, главная страница, apex и `www` проверены по HTTPS.
6. При следующей приёмке дополнительно сохранить runtime-log snapshot и image digest.

### P0 — выполнить минимальную live-приёмку

1. Применить/подтвердить production migrations.
2. Проверить создание заказа без реального списания.
3. Проверить admin login и owner-only ограничения.
4. Проверить generation → approval → S3 → email → protected download.
5. Проверить RU/EN/DE/ES на desktop и mobile.
6. Проверить webhook signature и идемпотентность до включения реальных платежей.
7. Сделать и восстановить тестовый MySQL backup.
8. Сделать и проверить резервную копию PDF storage.

### P0 — юридическая и лицензионная готовность

1. Заполнить реквизиты владельца данных в legal-шаблонах.
2. Проверить consent, privacy policy, terms и refund policy для выбранных рынков.
3. Убедиться, что production footer ведёт на публичное зеркало.
4. Опубликовать точный corresponding source текущего deployed commit.
5. Не публиковать обещание абсолютной анонимности фиатных платежей.

### P1 — астрологическая приёмка

1. Выбрать десять карт с надёжным временем, местом и часовым поясом.
2. Рассчитать их в проекте и в независимом признанном ПО.
3. Сверить долготы, Лахири, лагну, D1, D9, накшатры/пады, аспекты и даши.
4. Записать версии ephemeris, ayanamsha и настройки узлов.
5. Все расхождения классифицировать до публичной продажи отчётов.

### P1 — наблюдаемость и расходы

1. Настроить бесплатный uptime monitor на `/health`.
2. Установить уведомления о build/deploy failure.
3. Включить минимальные quota и billing alerts во всех внешних сервисах.
4. Ежемесячно проверять изменение free-tier условий.
5. После появления реальных клиентов определить RPO/RTO и перейти с sandbox SLA.

## 9. Инструкция для нового чата

В начале нового чата загрузить этот файл и написать:

> Продолжи проект Vedic Karma Design по документу
> `PROJECT-HISTORY-AND-HANDOFF-2026-09-11.md`. Сначала проверь фактический
> `git status`, `git log`, актуальный GitHub Actions и live endpoints. Не повторяй
> завершённую работу. Не публикуй и не запрашивай секреты в чате. Приоритет:
> восстановить Northflank deployment, выполнить live acceptance и обновить этот
> handoff по фактическим результатам.

Новый чат не должен считать будущие пункты уже выполненными. Источник истины:

1. фактический Git/GitHub commit;
2. активная Northflank deployment revision;
3. live health/readiness responses;
4. последний GitHub Actions run;
5. журналы миграции и результаты restore test.

## 10. Команды для быстрой технической проверки

Запускать из рабочей директории, не подставляя секреты в командную строку:

```bash
git status --short --branch
git log --oneline -10
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm audit --prod
curl -fsS https://karmalifedesign.com/health
curl -fsS https://karmalifedesign.com/ready
```

Для production deploy, migrations и backups использовать только документированные
скрипты и закрытое окружение:

- `scripts/deploy.sh`;
- `pnpm db:migrate:runtime`;
- `scripts/backup-db.sh`;
- `scripts/restore-db.sh`;
- `scripts/backup-s3.sh`;
- `scripts/production-smoke-test.mjs`.

## 11. Критерий завершения запуска

Проект считается публично запущенным только когда одновременно выполнены все
условия:

- apex и `www` открываются по HTTPS;
- health и readiness возвращают успешный результат;
- MySQL migrations подтверждены на текущем release;
- полный клиентский путь и admin flow пройдены на live/staging;
- письмо и защищённое скачивание PDF работают;
- все четыре языка приняты;
- webhook проверен без реальных финансовых потерь;
- backup и restore фактически испытаны;
- legal placeholders заменены владельцем;
- публичное AGPL-зеркало соответствует deployed commit;
- десять карт независимо сверены и приняты;
- зафиксированы commit SHA, image digest, дата и результаты проверки.

До выполнения этих пунктов корректная формулировка состояния: **технически
подготовленный release в процессе production-развёртывания**, а не полностью
запущенный коммерческий сервис.

## 12. Исправление мобильной версии и локализации форм — 2026-09-13

После проверки сайта владельцем на смартфоне был обнаружен горизонтальный
выход страницы за границы экрана. Также встроенные сообщения браузера для
обязательных полей отображались на языке операционной системы, а не на языке,
выбранном посетителем.

Выполнено:

- для `html`, `body`, `#root` и публичной страницы установлены безопасные
  ограничения ширины и отсечение декоративного содержимого по горизонтали;
- добавлены `min-width: 0`, перенос длинных слов и ограничение ширины элементов
  форм, карточек, изображений и диалогов;
- заголовок заказа, цены, прогресс и строки расчёта адаптированы для узких
  экранов и длинных немецких/испанских подписей;
- диалог входа теперь использует ширину не более `100vw - 2rem`;
- встроенная браузерная валидация клиентских форм отключена и заменена
  локализованными сообщениями приложения;
- документ и поля получают BCP 47 локаль `en-US`, `ru-RU`, `de-DE` или `es-ES`;
- для даты и времени добавлены видимые локализованные форматы и примеры;
- локализованы примеры email, подпись согласия и названия языков чтения;
- добавлены модульные и Playwright-регрессионные тесты.

Результаты проверки:

- полный набор: **200 passed, 12 skipped, 212 total**;
- TypeScript/lint: без ошибок;
- production build: успешно;
- мобильный Playwright: **12/12 passed** — ширины 320, 375 и 430 px на каждом
  из языков RU/EN/DE/ES;
- во всех 12 комбинациях `scrollWidth` страницы и `body` не превышает ширину
  viewport;
- визуально проверена полная немецкая страница при ширине 320 px.

Новый обязательный регрессионный тест:
`e2e/mobile-localization.spec.ts`. Он должен оставаться частью sandbox/CI и
предотвращать возврат горизонтальной прокрутки и русских подсказок в других
локалях.

## 13. Фактическая P0-проверка — 2026-09-13

Проверка выполнена по источникам истины, без переноса исторических статусов из
предыдущих разделов.

### Git, deployment и live

- после `git fetch origin --prune` и двух исправляющих commits ветка `main` и
  `origin/main` совпали на
  `0f22dd1840af3c0a430902104721201ed5242b4f`, рабочее дерево было чистым до
  этого документального обновления;
- Northflank service `vedic-karma-app` имел состояние `Running`, 1/1 pod,
  0 рестартов и активный commit
  `0f22dd1840af3c0a430902104721201ed5242b4f`;
- активный build: `real-branch-7873`, deployment:
  `vedic-karma-app-59667bc775`, время deployment: 2026-09-13 08:14:27 MSK;
- image digest активного build:
  `sha256:9a92ec12ff96f6002c3dbf0398b3870179e662bc01608e655c13c8a8345b6c5f`;
- `https://karmalifedesign.com/health` — HTTP/2 200,
  `{"ok":true,"service":"vedic-astrology-booking"}`;
- `https://karmalifedesign.com/ready` — HTTP/2 200,
  `{"ok":true,"checks":{"database":true}}`;
- apex и `www` — HTTP/2 200; HSTS и ранее документированные защитные headers
  присутствуют;
- production footer ведёт на публичное AGPL-зеркало
  `https://github.com/StarLordKarma/VedicKarmaDesign-Source`.

### Локальный release gate

Проверено с закреплённым в проекте pnpm 10.4.1:

- `pnpm lint` — успешно;
- `pnpm check` — успешно;
- `pnpm test` — 200 passed, 12 skipped, 212 total;
- `pnpm build` — успешно; остаётся предупреждение Vite о двух chunks больше
  500 kB;
- `pnpm audit --prod` — известных уязвимостей нет;
- `e2e/mobile-localization.spec.ts` против текущего production URL — 12/12
  успешно: RU/EN/DE/ES на 320/375/430 px.

### GitHub Actions и исправление sandbox CI

- run CI №30 (`34722952831`) выявил недоступный Docker Hub image MinIO;
- sandbox и staging переведены на официальные `quay.io/minio/minio` и
  `quay.io/minio/mc` с сохранением закреплённых release tags; исправление
  зафиксировано отдельным commit `fa88d13`;
- следующий run CI №31 (`34739324833`) подтвердил загрузку MinIO и выявил
  вторую независимую проблему: Compose migration job ссылался на отсутствующий
  Docker stage `build`;
- в `deploy/Dockerfile.independent` восстановлен совместимый `build` stage с
  development CLI для migration/seed jobs; production `runtime` Northflank и
  default `final` остаются минимальными; исправление зафиксировано отдельным
  commit `0f22dd1`;
- итоговый run CI №32 (`34739781734`) на commit
  `0f22dd1840af3c0a430902104721201ed5242b4f` завершён успешно за 3m 26s:
  `verify`, `container`, `database-integration`, `sandbox-e2e` — зелёные;
- sandbox Playwright в CI: 15 passed, включая 12 мобильных проверок локалей;
- публикация публичного AGPL-зеркала №13 (`34739781736`) на том же commit
  завершена успешно.

### Что P0 ещё не принято

- в текущем окружении нет Docker, поэтому полный Compose E2E выполнен не
  локально, а в итоговом зелёном CI №32;
- Northflank migration job в dashboard отображается как `Failed` с датой
  2026-09-11; актуальный успешный migration run для текущего release отдельно
  не подтверждён, несмотря на зелёный `/ready`;
- production smoke test не запускался: для него нужен уже настроенный
  `PRODUCTION_SMOKE_SECRET`; его значение нельзя передавать в чат или командную
  строку;
- production NOWPayments, Resend, private S3 и OIDC/MFA не приняты end-to-end;
  live generation → approval → storage → email → protected download также не
  выполнен;
- тестовый MySQL backup/restore и проверка backup PDF storage не выполнены:
  нужны закрытое production-окружение и инструменты доступа к соответствующим
  хранилищам;
- Google Maps и LLM production keys с лимитами не принимались; они должны
  оставаться выключенными, пока соответствующие функции не включены и
  credentials не проверены закрытыми production guards.

## 14. Повторная P0-проверка и миграции — 2026-09-13

### Подтверждённое состояние перед изменениями

- локальный `main` находился на документальном commit `c55f6e9` и опережал
  `origin/main` ровно на один commit; рабочее дерево было чистым;
- `origin/main`, активный service deployment и последний зелёный CI совпадали
  на `0f22dd1840af3c0a430902104721201ed5242b4f`;
- GitHub Actions CI №32 (`34739781734`) и публикация AGPL source №13
  (`34739781736`) имели статус success;
- Northflank service оставался `Running`, 1/1, на deployment
  `vedic-karma-app-59667bc775`, build `real-branch-7873`, image digest
  `sha256:9a92ec12ff96f6002c3dbf0398b3870179e662bc01608e655c13c8a8345b6c5f`;
- 2026-09-13 09:05 UTC `/health`, `/ready`, apex и `www` повторно вернули
  HTTP/2 200; readiness подтвердил доступность базы данных.

### Migration job текущего release

- старый deployment migration job на `ce1961d` заменён build
  `excellent-bubble-480` commit
  `0f22dd1840af3c0a430902104721201ed5242b4f`;
- job запущен вручную без override переменных и с командой
  `node dist/migrate.js`, соответствующей `pnpm db:migrate:runtime`;
- Northflank run ID: `91f65bf6-f8fd-4b26-9e28-e05677a87971`;
- pod: `vedic-karma-migrate-6aa66808f84b7f0027e78436-4654m`;
- результат: `Success`, duration 25s, failed instances 0/0;
- журнал в 2026-09-13 09:08:46 UTC: `Database migrations completed
  successfully`; процесс завершился с exit code 0;
- после job `/ready` повторно проверен в 2026-09-13 09:09:44 UTC:
  `{"ok":true,"checks":{"database":true}}`.

P0 migration blocker для release `0f22dd1` закрыт. Production smoke,
NOWPayments, Resend, private S3, OIDC/MFA, полный delivery flow и фактические
backup/restore tests остаются непринятыми до настройки соответствующих
переменных только в закрытом окружении и выполнения реальных проверок.

## 15. Анализ приватности платёжных шлюзов — 2026-09-13

- актуальное состояние Git, GitHub Actions, Northflank и live endpoints повторно
  проверено; production по-прежнему работает на `0f22dd1`, CI №32 и AGPL №13
  остаются последними успешными runs;
- подготовлен отдельный сравнительный документ
  `docs/PAYMENT-GATEWAY-PRIVACY-REVIEW-2026-09-13.md`;
- рекомендуемая последовательность: завершить NOWPayments как быстрый MVP path
  без custody/fiat, параллельно пилотировать self-hosted BTCPay Server для
  BTC/Lightning, отдельно оценить Monero plugin или собственный XMR checkout;
- универсальный лимит NOWPayments «€700 без полного KYC» не подтверждён
  актуальными официальными материалами и не должен становиться обещанием;
- локально повторно выполнены 13 сфокусированных тестов NOWPayments webhook,
  payment notification и production configuration guards: 13/13 успешно;
- эти тесты подтверждают реализацию подписи, отклонение подменённого payload и
  программную идемпотентность, но не заменяют staging/production E2E с реальными
  ограниченными credentials.

## 16. Визуальная система сайта и PDF — 2026-09-14

По прямому указанию владельца работа над P1 выполнена до закрытия оставшихся
production P0-блокеров. Это не меняет их статус: production smoke,
NOWPayments E2E, Resend, private S3, OIDC/MFA, полный delivery flow и
backup/restore по-прежнему не приняты.

В commit `72441bd` (`Add Vedic cosmology visual system`) выполнено:

- добавлены четыре оригинальных прозрачных SVG-ассета в
  `client/public/backgrounds/`: мандала, круг 27 накшатр, сакральная сетка и
  звёздное поле; изображения-референсы использованы только как визуальное
  направление, без копирования;
- ассеты подключены поверх существующих цветов через CSS background layers и
  `background-blend-mode`; brand-палитра не менялась;
- добавлены плавное появление секций, лёгкая пульсация знака и ограниченный
  параллакс hero-фона; `prefers-reduced-motion` отключает движение;
- добавлен уважительный блок о различиях ведической и западной традиций во всех
  четырёх словарях RU/EN/DE/ES одним commit;
- в PDFKit-генератор добавлены векторные орнаменты для обложки, внутренних
  страниц и финальной страницы; основной текст и контрастные панели сохранены;
- добавлены E2E-проверки фоновых слоёв и переполнения для 768/1280 px во всех
  четырёх локалях; существующий mobile/localization suite не изменён.

Фактическая проверка commit `72441bd`:

- `pnpm lint` и `pnpm check` — успешно;
- `pnpm test` — **200 passed, 12 skipped**;
- `pnpm build` — успешно; сохраняется прежнее предупреждение о крупных chunks;
- `pnpm audit --prod` — известных уязвимостей нет;
- Playwright — **20/20 passed**: обязательные mobile/localization 12/12 на
  320/375/430 px и новые visual tests 8/8 на 768/1280 px, RU/EN/DE/ES;
- Lighthouse mobile для локальной production-сборки — **93**, FCP 1.8 s,
  LCP 2.7 s, TBT 170 ms, CLS 0;
- тестовый A4 PDF отрисован и визуально проверен при 300 DPI.

Commit локальный и не отправлен в `origin/main`. Активный production release,
image digest и GitHub Actions run не менялись: SHA `0f22dd1`, digest
`sha256:9a92ec12ff96f6002c3dbf0398b3870179e662bc01608e655c13c8a8345b6c5f`,
CI №32. Для этого P1 commit ещё нет нового Northflank deployment или CI run.

## 17. Полноценные иллюстрированные фоны — 2026-09-14

После обратной связи владельца линейная версия визуальной системы расширена
полноценными растровыми иллюстрациями. Commit `78e2199` (`Add illustrated Vedic
backgrounds`) содержит:

- оригинальную широкую акварельную сцену с небесным храмом, планетарной
  мандалой и лотосами для hero; подготовлены отдельные desktop и mobile версии;
- отдельную широкую лотосно-космологическую сцену для смысловых секций сайта;
- две оригинальные A4-иллюстрации для PDF: Меру/планетарная система для
  обложки и космическое дерево/накшатра-мандала для разделителей и финала;
- обе PDF-иллюстрации имеют 2480 × 3508 px и метаданные 300 DPI;
- PDFKit повторно использует встроенные изображения, поэтому полный
  22-страничный демонстрационный PDF занимает 4.69 MB, а не дублирует
  многомегабайтный JPEG на каждой иллюстрированной странице;
- текст в PDF размещён на светлой полупрозрачной панели, а изображение остаётся
  полноформатным и хорошо заметным справа и по краям;
- hero-картинка оптимизирована до 220 KB для desktop и 77 KB для mobile;
  добавлен responsive preload.

Фактическая проверка:

- `pnpm lint`, `pnpm check`, `pnpm build` — успешно;
- `pnpm test` — **200 passed, 12 skipped**;
- `pnpm audit --prod` — известных уязвимостей нет;
- адаптивный Playwright — **20/20 passed**, включая обязательные mobile 12/12;
- Lighthouse mobile после оптимизации изображений — **88**, FCP 1.9 s,
  LCP 3.5 s, TBT 160 ms, CLS 0;
- полный 22-страничный PDF отрисован; визуально проверены страницы 1, 4, 8 и
  22: обложка, разделители и финальная страница читаемы, без наложений и
  обрезанного текста.

Commit локальный и не отправлен. Production по-прежнему работает на
`0f22dd1`; digest и CI №32 не изменились. Открытые P0-блокеры остаются без
изменений.

## 18. Независимый платёжный слой и оценка PayCrypto — 2026-09-17

По предложению владельца проработана provider-neutral архитектура оплаты:

- добавлен серверный контракт `PaymentProvider` для создания hosted checkout,
  проверки webhook, нормализации статусов и определения окончательной оплаты;
- действующая интеграция NOWPayments оформлена как первый адаптер и остаётся
  единственным разрешённым production-провайдером;
- активный адаптер выбирается через `PAYMENT_PROVIDER`; неизвестное или ещё не
  прошедшее аудит значение останавливает production-конфигурацию;
- production guard дополнительно запрещает подмену `NOWPAYMENTS_BASE_URL`
  неофициальным или mock-хостом;
- статусы нормализованы в `created`, `pending`, `paid`, `underpaid`, `overpaid`,
  `expired`, `failed`, `refunded`; underpayment не запускает генерацию;
- подтверждённую оплату нельзя откатить поздним неплатёжным callback, а переход
  `confirmed` → `finished` не создаёт повторного owner notification;
- публичный privacy-текст сделан независимым от бренда оператора одновременно
  в RU/EN/DE/ES; неработающая кнопка оплаты картой не добавлялась.

PayCrypto.Global учтён как возможный non-custodial резерв. Его опубликованная
документация описывает прямое зачисление, `getpaylink` и webhook по IP allowlist,
но не криптографическую подпись payload. Поэтому адаптер намеренно не включён:
до production нужны подтверждение точного поставщика, signed callback либо
независимая on-chain проверка суммы/адреса/сети/confirmations, тест повторной
доставки и юридическая проверка. Детали записаны в
`docs/PAYMENT-PROVIDER-ARCHITECTURE-2026-09-17.md`.

Фактическая локальная проверка 2026-09-17:

- `lint`/`check` (TypeScript) — успешно;
- `test` — **203 passed, 12 skipped**;
- `build` — успешно; прежнее предупреждение Vite о крупных chunks сохраняется;
- `audit --prod` — известных уязвимостей нет;
- обязательный `e2e/mobile-localization.spec.ts` — **12/12 passed**,
  RU/EN/DE/ES × 320/375/430 px.

Изменения локальные и на момент записи не отправлены. Production revision,
image digest и GitHub Actions run не менялись: deployed SHA `0f22dd1`, digest
`sha256:9a92ec12ff96f6002c3dbf0398b3870179e662bc01608e655c13c8a8345b6c5f`,
CI №32. Открытые production P0-пункты (smoke secret, реальные connector E2E,
полный delivery flow и backup/restore) этим изменением не закрыты.

## 19. Адаптеры Heleket и PayCrypto.Global — 2026-09-17

По прямому указанию владельца добавлены два полноценных альтернативных адаптера:

- `PAYMENT_PROVIDER=heleket`: создание invoice через официальный
  `api.heleket.com/v1/payment`, подпись запроса MD5(base64(JSON) + API key),
  проверка подписи webhook, hosted checkout и полная карта официальных статусов;
- `PAYMENT_PROVIDER=paycrypto`: создание `getpaylink`, прямые receiving addresses
  из `PAYCRYPTO_COINS_JSON`, обязательный 32+ character callback token,
  constant-time проверка token и сверка order ID, суммы и валюты перед оплатой;
- зарегистрированы отдельные webhook endpoints и их исключения из browser CSRF
  guard; каждый endpoint имеет rate limiting;
- общая цепочка распознаёт успешные статусы всех трёх провайдеров в Report
  Studio, client status, SLA и owner dashboard; underpayment не считается
  подтверждённой оплатой;
- independent production требует credentials только выбранного адаптера и
  блокирует неофициальные Heleket/PayCrypto/NOWPayments API hosts;
- новые имена переменных документированы в `.env.example`; значений в Git и
  handoff нет.

Локальная проверка реализации:

- TypeScript lint/check — успешно;
- unit/integration — **207 passed, 12 skipped**;
- production build — успешно;
- production dependency audit — известных уязвимостей нет;
- mobile/localization — **12/12 passed**, RU/EN/DE/ES × 320/375/430 px;
- отдельные тесты подтверждают request signing Heleket, отклонение неверной
  подписи, создание PayCrypto checkout, отклонение неверного token и mismatch
  суммы заказа.

Адаптеры реализованы, но не считаются production E2E принятыми: реальные
merchant credentials ещё не добавлялись, callback от кабинетов операторов не
получен и деньги не переводились. Для PayCrypto bearer callback-token является
компенсирующей мерой, поскольку опубликованный API не описывает signed payload;
для максимальной гарантии остаётся желательной независимая on-chain проверка.
