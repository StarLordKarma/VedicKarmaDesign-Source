# Отчёт о финальной подготовке запуска

**Дата:** 2026-09-10
**Статус:** инфраструктура подготовлена в коде; публичный production ещё не
развёрнут, поскольку внешние аккаунты и юридические решения принадлежат владельцу.

## Что сделано ChatGPT

- проверены актуальные цены/free tiers и выбран нулевой/бюджетный стек;
- production Compose адаптирован под VM + private MySQL volume + Caddy + R2;
- подготовлены deploy, DB backup/restore и cross-provider object backup scripts;
- созданы инструкции сервера, DNS/TLS, секретов, AGPL mirror и юридический шаблон;
- подготовлена независимая методика сверки 10 карт;
- добавлен ручной GitHub workflow публичного corresponding-source mirror.

## Что сделал пользователь

- подтвердил начало финального этапа и принцип минимальных расходов;
- ранее предоставил write-доступ к приватному репозиторию.

## Итоговый стек и стоимость

- Northflank Developer Sandbox: app (0.2 shared vCPU / 512 MB) + private
  MySQL 8.4.11 (0.2 shared vCPU / 512 MB / 6 GB NVMe) — $0/мес within the
  current free-project limits;
- добавлена нативная поддержка отдельных credentials связанного Northflank
  MySQL addon и production-команда `pnpm db:migrate:runtime`; несовместимый
  connector string больше не используется как `DATABASE_URL`;
- production MySQL защищён TLS; миграции `0000`–`0029` успешно применены
  одноразовой Northflank job `vedic-karma-migrate`;
- AGPL-зеркало автоматически обновляется при каждом push в `main` через
  отдельный write-only deploy key.
- Cloudflare R2 и Backblaze B2: $0 в пределах первых 10 ГБ каждого;
- Cloudflare DNS, Resend, OIDC, Maps SKU caps и Groq free tier: $0 в пределах лимитов;
- домен: ориентир $8–15/год для обычного `.com`, точная цена зависит от имени;
- fallback: Hetzner CAX11/CX23 от €5.99/€5.49 без VAT/IPv4 либо Timeweb 4 ГБ
  1 080 ₽/мес.

Подробности: [COST-ANALYSIS-2026-09-10.md](COST-ANALYSIS-2026-09-10.md).

## Результаты проверок

- GitHub Actions CI №16 для commit `d896b2d`: успешно, 4/4 jobs за 3 мин 12 с.
- Production-контейнер, MySQL migration/integration и sandbox E2E (Playwright 3/3)
  успешно проверены в CI.
- Локально: 189 tests passed, 12 external tests skipped (201 total), TypeScript,
  lint, production build и production dependency audit прошли; известных
  production-уязвимостей нет.
- Реальные DNS, HTTPS, R2, email, OIDC, NOWPayments и backup restore ожидают
  аккаунтов владельца и не отмечаются как пройденные заранее.

## Ссылки на production и AGPL

- Technical preview URL:
  `https://p01--vedic-karma-app--mbb49nqg858d.code.run/`
- Public corresponding source:
  `https://github.com/StarLordKarma/VedicKarmaDesign-Source`
- Deployed commit/image digest: `[PENDING_RELEASE_SHA_AND_DIGEST]`

## Оставшиеся риски и рекомендации

- Northflank Free не предоставляет production SLA; Oracle ARM, Hetzner/Timeweb
  остаются вариантами переноса при росте нагрузки или изменении free tier.
- Single-node MySQL требует ежедневной внешней копии и ежемесячного restore.
- Free tiers могут меняться; quotas и billing alerts проверяются ежемесячно.
- Публичный запуск запрещён до заполнения privacy/terms, публикации AGPL source и
  независимого принятия десяти карт.
- Секреты находятся только в GitHub Environment или server `.env.production`.

После предоставления внешних результатов этот документ дополняется production URL,
стоимостью фактического счёта, image digest и результатами live acceptance.
