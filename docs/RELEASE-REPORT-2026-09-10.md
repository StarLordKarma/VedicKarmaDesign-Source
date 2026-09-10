# Отчёт о выпуске полностью работоспособной версии

**Дата:** 2026-09-10

## 1. Выполненные изменения

- Подтверждены существующие production adapters: NOWPayments/IPN, Resend, OIDC
  с PKCE/nonce/state, S3, Google Maps и OpenAI-compatible LLM.
- Добавлены `.env.production.example` и корневой `docker-compose.prod.yml` для
  воспроизводимого независимого запуска за Caddy/HTTPS.
- Добавлены отдельные команды production migration, безопасного начального seed,
  deployment и резервного копирования.
- Production seed создаёт только reference prices/packages, не создаёт клиентов и
  не перезаписывает существующие значения.
- Backup создаёт consistent MySQL dump, checksum, retention и optional off-site S3 copy.
- Добавлены browser security headers и Fetch Metadata guard против cross-site
  записей; подписанный NOWPayments webhook явно исключён из CSRF-фильтра.
- Исправлена причина прежних падений CI: удалено двойное указание версии pnpm.
- CI теперь валидирует sandbox, staging и production Compose и собирает image.
- Подготовлены точный перечень production credentials и процедура публичного
  AGPL-зеркала без раскрытия secrets/клиентских данных.

## 2. Результаты проверок

- Тесты: **189 passed, 12 skipped, 201 всего**.
- TypeScript/lint: без ошибок.
- Production-сборка клиента и сервера: успешна.
- Аудит production-зависимостей: известных уязвимостей нет.
- Целевые security/payment/PDF/calculation тесты: 22 passed.
- Production Compose/YAML и backup shell syntax: успешно.
- E2E/Docker локально: не запускались, потому что Docker CLI отсутствует.
- GitHub Actions для `c206e8b` останавливался из-за конфликтующего объявления pnpm.
  На первом исправленном запуске verify/container прошли, а CI обнаружил зависимый
  от наполненности БД pagination assertion и отсутствие ожидания health приложения
  перед Playwright. Оба дефекта исправлены в следующем commit.
- Сборка содержит неблокирующее предупреждение Vite о крупных vendor chunks.

## 3. Новые и изменённые файлы

- `.env.production.example` — полный production template без секретов.
- `docker-compose.prod.yml` — app, Caddy, migration и initial-seed profiles.
- `server/_core/security.ts` и test — headers/Fetch Metadata CSRF guard.
- `scripts/seed-production.ts` — безопасная reference initialization.
- `scripts/backup-production.sh` — dump, checksum, retention, off-site copy.
- `.github/workflows/ci.yml` — исправление pnpm и Compose validation.
- `docs/PRODUCTION-CREDENTIALS-NEEDED.md` — точный перечень доступов.
- `docs/AGPL-PUBLIC-SOURCE.md` — инструкция публичного source/mirror.
- `README.md`, `docs/DEPLOYMENT-PLAN.md`, `docs/PRE-LAUNCH-CHECKLIST.md` — runbook.

## 4. AGPL compliance

- Код проекта и free Swiss Ephemeris path: AGPL-3.0-or-later.
- Footer получает ссылку из `VITE_SOURCE_CODE_URL`; independent configuration без
  неё не запускается.
- Текущий URL приватного GitHub пока не доступен всем пользователям и поэтому не
  закрывает публичное обязательство. До публичного запуска основной репозиторий
  либо exact deployed mirror должен стать публичным.
- Коммерческая лицензия не планируется и не требуется при выполнении AGPL.

## 5. Необходимые доступы от пользователя

См. [PRODUCTION-CREDENTIALS-NEEDED.md](PRODUCTION-CREDENTIALS-NEEDED.md): домен/DNS,
публичный source URL, MySQL, private S3, OIDC/MFA, NOWPayments, Resend, Maps, LLM и
GitHub Environment/deploy access. Секреты передаются только через `.env.production`
mode 600, GitHub Environment Secrets или manager сервера — не через чат/Git.

## 6. Оставшиеся ограничения

- Нет сервера, домена и реальных staging credentials; настоящие providers не могли
  пройти live acceptance.
- Репозиторий приватен; смена visibility требует явного решения владельца.
- Независимый астрологический benchmark минимум на 10 картах ещё должен быть
  подписан практикующим специалистом.
- Privacy notice требует реальных реквизитов контролёра и юридической проверки.
- «Полностью работоспособный код» не равен разрешению принимать реальные заказы:
  запуск блокируют внешний checklist, restore rehearsal и provider acceptance.

## 7. Следующие шаги для запуска

1. Сделать source/mirror публичным и указать его в `VITE_SOURCE_CODE_URL`.
2. Выбрать VPS/домен, создать staging и заполнить credentials вне Git.
3. Пройти реальный OIDC, payment, email, S3, Maps и LLM acceptance.
4. Выполнить backup/restore rehearsal и астрологический benchmark.
5. Заполнить юридические документы, пройти pre-launch checklist и только затем
   разрешить публичные заказы.
