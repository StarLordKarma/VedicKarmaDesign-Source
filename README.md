# Vedic Astrology Booking

Переносимая резервная копия multilingual full-stack сайта для ведических натальных разборов. Проект включает public booking, цены USD/EUR/GBP, NOWPayments crypto checkout, локализованные receipts, owner-only administration, S3-compatible PDF storage, Resend delivery и Report Studio для детерминированных Lahiri/Vimshottari расчётов, AI narrative и PDF approval workflow.

## Что прочитать сначала

| Документ | Назначение |
|---|---|
| `ETAP-ODIN-FULL-PROJECT-HISTORY.md` | Пошаговая история формирования проекта от начала до текущего Report Studio |
| `ETAP-ODIN-RESTORE-INSTRUCTIONS.md` | Универсальная инструкция для разработчика или другой нейронной сети по восстановлению и продолжению |
| `ETAP-DVA-ROADMAP.md` | Дальнейшая стратегия развития и масштабирования |
| `ETAP-DVA-REPORT-STUDIO-SPEC.md` | Архитектурная спецификация Report Studio и state machine |
| `ETAP-DVA-PDF-LAYOUT.md` | Структура 22/25-страничного PDF и визуальные правила |
| `docs/calculation-engine-research-notes.md` | Исследование engines, licensing и фактический sweph adapter |
| `todo.md` | История реализованных и оставшихся задач |

## Стек и структура

Проект использует React 19, Vite, Tailwind CSS, Express, tRPC, Drizzle ORM, MySQL/TiDB, S3-compatible storage, Manus OAuth, NOWPayments, Resend и server-side `sweph` Swiss Ephemeris binding. Главные директории — `client/`, `server/`, `shared/`, `drizzle/` и `scripts/`.

Ключевые Report Studio modules: `server/report-studio-db.ts`, `server/report-geocoding.ts`, `server/report-narrative.ts`, `server/vedic-astrology-calculator.ts`, `server/export.ts` и `server/client-delivery.ts`. Owner UI находится в `client/src/pages/ReportStudio.tsx` и доступен по `/admin/report-studio`.

## Локальная проверка

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test --run
pnpm build
pnpm dev
```

Последняя проверка backup-состояния перед упаковкой: TypeScript check успешен, полный тестовый suite — 114 passed и 1 credential test skipped, production build успешен. Миграции находятся в `drizzle/`; текущие Report Studio migrations — `0015`, `0016` и `0017`.

## Важные ограничения backup

Архив намеренно не содержит `.env`, реальные secrets, cookies, production database, S3 object bytes, private keys, build artifacts, `node_modules`, `.git` и logs. Для полного восстановления отдельно потребуются `DATABASE_URL`, `JWT_SECRET`, `OWNER_OPEN_ID`, OAuth values, Manus Forge values, NOWPayments credentials, Resend credentials, storage configuration и отдельные backups данных.

Admin procedures должны оставаться ограниченными `OWNER_OPEN_ID`. Не отключайте owner guard, не делайте PDF bucket публичным и не переносите Swiss Ephemeris/AI secrets в browser bundle.

## Report Studio summary

После verified payment создаётся idempotent `report_job`. Worker может автоматически geocode city → latitude/longitude/IANA timezone/DST offset, рассчитать validated Lahiri facts JSON, создать strict `vedic-narrative.v1`, сформировать Basic PDF на 22 страницы или Basic+ на 25 страниц, а затем ожидать owner approval. Автоматическая обработка новых jobs управляется persistent setting и по умолчанию OFF.

PDF содержит vector D1/Rāśi panel и, для Basic+, D9/Navāṁśa panel. Approval отправляет только утверждённую версию через Resend. Manual resend разрешён только для `delivery_failed`.

## License and external services

Код приложения распространяется согласно актуальным project records. `sweph` и внешние сервисы имеют собственные licensing/terms obligations; сохраняйте source and license notices при распространении. Customer data, domains, provider accounts, credentials и uploaded files не являются частью исходного архива.
