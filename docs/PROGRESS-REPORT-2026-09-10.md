# Отчёт о доработке и подготовке к staging/production

**Дата:** 2026-09-10

## 1. Выполненные изменения

- Обнаружен и исправлен фактический locale gap: Report Studio поддерживал только
  RU/EN/DE, хотя публичный заказ позволял ES. Испанский добавлен в schemas,
  narrative generation, PDF copy, synthetic jobs и owner UI.
- Добавлены regression-тесты накшатры/pada, Vimshottari, четырёх narrative
  contracts и полноценной 22-страничной PDF-сборки RU/EN/DE/ES. Существующие
  тесты продолжают покрывать D9 и аспекты Парашары.
- Добавлен локальный staging Compose: приложение, MySQL 8 и приватный MinIO;
  добавлены шаблон env, migration/seed tools и fail-safe идемпотентный seed.
- Добавлены package scripts `db:migrate`, `db:seed`, `db:seed:staging`,
  `deploy:staging`, `deploy:prod`.
- CI дополнительно валидирует staging Compose и собирает independent Docker image.
- Устранены все пять оставшихся production advisories: Express dependency chains
  закреплены на `path-to-regexp 0.1.13`, `qs 6.16.0` и `body-parser 1.20.6`.
- Добавлен `NOTICE`; расширены README и AGPL instructions. Footer уже показывал
  source link из обязательного production `VITE_SOURCE_CODE_URL`.
- Privacy notice на четырёх языках прямо говорит о минимизации платёжных данных и
  о том, что регулируемая fiat-оплата не является анонимной.

## 2. Результаты проверок

- Тесты: **185 passed, 12 skipped, всего 197**; 43 files passed, 2 credential
  files skipped.
- Новые целевые проверки: 30/30 passed, включая 4 PDF locales.
- TypeScript/lint gate: без ошибок (`pnpm lint`, `pnpm check`).
- Production-сборка: успешна для Vite client и bundled Express server.
- Аудит зависимостей: **0 critical, 0 high, 0 moderate, 0 low** — `No known
  vulnerabilities found` на дату проверки.
- Docker-сборка: локально не выполнялась — Docker CLI отсутствует. GitHub Actions
  содержит image build и `docker compose ... config --quiet`.
- Ручное browser smoke на предыдущем этапе был успешен. В этом этапе новая
  функциональность проверена unit/component/PDF tests; live OIDC/payment/email/S3
  не выдавались за проверенные без sandbox credentials.
- Известное build warning: `vendor-core` около 754 KB до gzip.

## 3. Новые и изменённые файлы

- `server/report-narrative.ts`, `server/report-studio-db.ts`, `server/export.ts`,
  `shared/admin.ts`, `client/src/pages/ReportStudio.tsx` — полный ES report flow.
- `server/vedic-astrology-calculator.test.ts`, `server/report-automation.test.ts`,
  `server/export.test.ts` — новые calculation/locale/PDF regressions.
- `deploy/compose.staging.yml`, `deploy/.env.staging.example` — staging stack.
- `scripts/seed-staging.ts` — безопасные эталонные тарифы и локализованные пакеты.
- `package.json`, `pnpm-lock.yaml` — scripts и patched transitive dependencies.
- `.github/workflows/ci.yml` — Compose validation и Docker build.
- `.env.example`, `.gitignore` — seed variables и защита filled env-файлов.
- `NOTICE`, `client/src/pages/Privacy.tsx` — AGPL/payment transparency.

## 4. Обновлённые документы

- `docs/DEPLOYMENT-PLAN.md` — варианты VPS/цены, MySQL, backups, S3, Resend,
  NOWPayments/fiat, LLM, monitoring и расширенный checklist.
- `docs/STAGING-GUIDE.md` — создан пошаговый запуск и acceptance plan.
- `docs/PRE-LAUNCH-CHECKLIST.md` — создан технический, функциональный и
  юридический launch gate.
- `README.md` — структура, staging и расширенное пояснение AGPL.

## 5. Оставшиеся внешние задачи (для пользователя)

- Выбрать сервер и домен.
- Создать production MySQL, отдельного пользователя, backup и применить миграции.
- Заполнить реальные/sandbox ключи OIDC, S3, Maps, LLM, Resend и NOWPayments.
- Указать владельца данных и контакты в privacy notice; утвердить Terms/refunds.
- Выполнить live staging-проверку платежей, email, PDF delivery и restore.
- Сделать corresponding source доступным пользователям AGPL deployment либо
  приобрести коммерческую Swiss Ephemeris license и пересмотреть licensing.
- Сверить расчёты на утверждённых эталонных картах с признанным ПО и практикующим
  специалистом джйотиш.
- Проверить налоговую/банковскую схему самозанятого и зарубежного счёта с юристом,
  бухгалтером, банком и платёжным провайдером.

## 6. Следующие шаги

Следовать [DEPLOYMENT-PLAN.md](DEPLOYMENT-PLAN.md) и
[STAGING-GUIDE.md](STAGING-GUIDE.md). Рекомендуемый порядок: получить sandbox
credentials → поднять staging → migrations/seed → четыре locale сценария →
payment/email/download → backup restore → benchmark → юридический sign-off →
production release по SHA и [PRE-LAUNCH-CHECKLIST.md](PRE-LAUNCH-CHECKLIST.md).
