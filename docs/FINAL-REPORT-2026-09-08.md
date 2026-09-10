# Финальный отчёт о доработке и готовности проекта

**Дата:** 2026-09-08

## 1. Обзор выполненных изменений

- Проведён повторный аудит ветки, истории, структуры, документации, миграций,
  deployment-профиля и расчётного контура.
- Бесплатный расчётный путь формализован как `sweph@2.10.3-5` / Swiss Ephemeris
  под AGPL-3.0-or-later. Добавлены проектная лицензия, third-party notice,
  обязательное production-подтверждение режима и публичная ссылка на исходники.
- Сохранён локальный детерминированный расчёт без передачи birth data во внешний
  астрономический API. Swiss Ephemeris вычисляет положения и Ascendant; локальный
  слой формирует D1, D9, nakshatra/pada и Vimshottari mahadasha.
- Добавлены Parashari full-sign graha aspects: общий 7-й аспект, специальные
  Mars 4/8, Jupiter 5/9 и Saturn 3/10. Спорные Rahu/Ketu aspects не утверждаются.
- Удалены неиспользуемые `openastrology-library`, `add`, `streamdown` и связанные
  демонстрационные компоненты, не входившие в маршруты приложения.
- Исправлены production dependency chains: AWS SDK, tRPC, Axios, MySQL2, nanoid,
  Drizzle, path-to-regexp и lodash overrides. High/critical audit findings снижены
  с 24 до нуля; остались 2 low и 3 moderate.
- Создан полный `.env.example`; standalone-шаблон дополнен calculation/source,
  analytics и ephemeris variables.
- Docker build теперь получает `VITE_SOURCE_CODE_URL` во время Vite-сборки;
  Compose не запускает публичный AGPL build без этой переменной.
- Добавлены `lint`, `start:prod`, `deploy:check`; CI запускает lint и блокирующий
  production audit уровня high.
- Полностью обновлён README и создан подробный deployment plan.

## 2. Результаты проверок

- Тесты: **176 passed, 12 skipped** (43 test files passed, 2 credential files
  skipped; всего 188 tests).
- Пропуски: 10 database integration cases требуют отдельной MySQL test database;
  2 требуют тестовых Resend/NOWPayments credentials. Они не запускались против
  production-сервисов без ключей.
- TypeScript: `pnpm lint` и `pnpm check` — без ошибок. Проект не содержит ESLint;
  lint-команда является строгим TypeScript static-analysis gate.
- Production-сборка: Vite client и bundled Express server — успешны. Известное
  предупреждение: `vendor-core` около 754 КБ до gzip; это задача оптимизации, не
  ошибка сборки.
- Dependency audit: `pnpm audit --prod --audit-level high` — успешно, high/critical
  отсутствуют; остаются 5 неблокирующих advisories (2 low, 3 moderate).
- Миграции: files `0000`–`0029` присутствуют. Реальное применение/проверка требует
  `DATABASE_URL`; локально команда корректно остановилась с этим требованием.
- Ручное браузерное тестирование: Chrome/Playwright, 1440 и 390 px, главная,
  unauthenticated admin, dashboard и Report Studio с безопасными browser fixtures;
  page errors и горизонтальное переполнение отсутствуют.
- Локальный сервер запустился на `127.0.0.1:3200`. Реальные OIDC, payment, email,
  S3 и client PDF delivery без staging credentials не имитировались как production.
- Расчёты: regression fixture подтверждает Lahiri/Moshier positions, UTC,
  Ascendant, D1/D9, Vimshottari и aspect rules. Независимый reference benchmark
  всё ещё обязателен до коммерческого использования.
- Docker: конфигурация проверена статически; Docker отсутствует в локальном окружении,
  поэтому container build остаётся задачей GitHub Actions/staging.

## 3. Файлы, добавленные или изменённые

- `.env.example` — полный безопасный шаблон переменных.
- `.github/workflows/ci.yml` — lint и production security audit.
- `LICENSE` — выбранный AGPL-3.0-or-later режим.
- `THIRD_PARTY_LICENSES.md` — Swiss Ephemeris и dependency notices.
- `README.md` — запуск, проверки, engine, лицензия, миграции и deployment.
- `package.json`, `pnpm-lock.yaml` — scripts, лицензия, удаление/обновление deps.
- `server/vedic-astrology-calculator.ts` — Parashari aspect facts.
- `server/vedic-astrology-calculator.test.ts` — aspect regression coverage.
- `server/_core/configuration.ts`, `server/configuration.test.ts` — fail-closed
  AGPL/source configuration for independent production.
- `client/src/pages/Home.tsx` — видимая AGPL source link при её настройке.
- `deploy/Dockerfile.independent`, `deploy/compose.yml` — source URL build argument.
- `deploy/.env.standalone.example` — новые обязательные/optional variables.
- `docs/calculation-engine-research-notes.md` — финальное решение по engine.
- `docs/DEPLOYMENT-PLAN.md` — последовательный staging/production план.
- `client/src/components/AIChatBox.tsx`, `client/src/pages/ComponentShowcase.tsx` —
  удалённый неиспользуемый demo-код.

## 4. Известные ограничения и нерешённые вопросы

- Сервер, домен и production/staging credentials пока не предоставлены.
- Репозиторий приватный: до AGPL deployment нужен доступный пользователям
  corresponding source URL либо Professional License.
- Нужен независимый benchmark расчётов на утверждённом наборе эталонных карт.
- Privacy notice всё ещё содержит placeholders контролёра и требует local legal review.
- Платёжная схема для самозанятого/зарубежного счёта требует юридической и
  provider-проверки; регулируемые fiat rails не обеспечивают полную анонимность.
- Database migrations, backup restore, Docker image и внешние integrations не
  прошли live staging acceptance без инфраструктуры.
- Recharts 2 и Manus development tooling имеют warnings/peer debt; major update
  отложен, чтобы не смешивать его с release hardening.
- Автоматический PDF visual diff и полный data export/deletion workflow остаются
  следующими продуктово-операционными задачами.

## 5. Следующие шаги (кратко)

Следовать [DEPLOYMENT-PLAN.md](DEPLOYMENT-PLAN.md): предоставить staging VPS/domain,
создать отдельные credentials, сделать source URL доступным, выполнить migrations
и restore rehearsal, затем пройти OIDC/S3/Maps/LLM/Resend/NOWPayments и four-locale
acceptance на точном release commit.
