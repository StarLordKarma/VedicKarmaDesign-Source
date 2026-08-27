# Roadmap дальнейшего развития сайта

**Горизонт:** следующие 2–3 этапа после checkpoint `c6cf5772`. План нужно выполнять последовательно, с проверкой owner security и резервным копированием перед миграциями. Приоритетом является надёжная обработка оплаченных заказов, а не добавление второстепенной визуальной сложности.

## Принцип выбора задач

Сначала необходимо стабилизировать контур «оплата → deterministic facts → owner review → email delivery». Затем имеет смысл уменьшать ручную операционную нагрузку и только после этого расширять аналитику и маркетинговый слой. Любая автоматизация должна сохранять возможность владельца остановить или утвердить отправку отчёта.

| Приоритет | Этап | Результат | Критерий готовности |
|---:|---|---|---|
| P0 | 3.1 Production hardening | Наблюдаемая и восстанавливаемая работа платежей, reports и delivery | Проверены backups, alerts, IPN replay protection и runbook |
| P0 | 3.2 Report quality controls | Удобное owner review и контроль facts/narrative/PDF | Owner способен сравнить source facts, текст и PDF до отправки |
| P1 | 3.3 Operations | Очередь задач, exports, retention и notifications с понятной историей | Нет необъяснимых background действий без audit trace |
| P1 | 3.4 Client experience | Ясный status flow и безопасный доступ к готовому PDF | Клиент видит статус без доступа к чужим данным |
| P2 | 3.5 Growth and localization | SEO-ready content, measurement с consent, улучшение conversion | Метрики не собираются без opt-in, локали согласованы |

## Этап 3.1 — Production hardening

В первую очередь подготовьте независимое восстановление: проверенный backup базы данных, версия migrations, список storage объектов и runbook для восстановления. Затем настройте наблюдение за неудачными IPN, report jobs и Resend delivery. Owner alert не должен содержать payload, ключи или персональные данные сверх минимально необходимого.

| Задача | Изменения | Тест / проверка |
|---|---|---|
| Database backup runbook | Документировать безопасный export/restore выбранного MySQL/TiDB provider | Restore в отдельную тестовую базу |
| S3 inventory | Хранить metadata key/size/content type, а не байты в DB | Выборочная проверка доступа только владельца |
| IPN replay review | Подтвердить idempotency по payment/invoice identifier | Повтор одного signed event не создаёт второй report job |
| Delivery failure workflow | Чёткое `delivery_failed`, ручный retry и owner alert | Тест без отправки реальному клиенту |
| Deployment health checks | Health endpoint, logs, error budget и rollback notes | Smoke checks после каждого release |

## Этап 3.2 — Quality control Report Studio

Развивайте Report Studio как owner-first рабочее место. Не автоматизируйте выдачу без прозрачной цепочки evidence: введённые данные → геокодирование/часовой пояс → deterministic facts JSON → narrative JSON → PDF → owner approval. При спорной географии или времени рождения job должен оставаться в состоянии, требующем ручного решения.

| Функция | Польза | Граница безопасности |
|---|---|---|
| Facts inspector | Показывает source, calculated values и warnings | Нельзя редактировать calculated facts без явного audit event |
| Narrative section review | Позволяет править разделы отчёта перед PDF regeneration | Сохранять editor и timestamp |
| PDF version diff | Сравнивает версии/страницы после правок | Approved version нельзя silently заменить |
| Queue retry controls | Повторяет только допустимые failed jobs | Нужны bounded retries и error categories |
| Delivery checklist | Минимизирует ошибочную отправку не тому клиенту | Адресат и approved version проверяются server-side |

## Этап 3.3 — Retention и административная операционность

Payment Test Lab уже имеет configurable retention, preview, cleanup history, CSV export и language preference для owner summary. Следующий разумный шаг — завершить его несколькими удобствами, не расширяя доступ посторонним пользователям.

1. Добавить pagination/временную фильтрацию и явный фильтр **manual vs scheduled** к cleanup history.
2. Показывать delivery status owner cleanup summary без сохранения содержимого email.
3. Добавить reason/comment при изменении pricing и retention, сохраняя audit event.
4. Добавить export retention-change history отдельным CSV, а не смешивать с cleanup execution history.

## Этап 3.4 — Client status и delivery experience

У клиента должна быть безопасная короткоживущая ссылка статуса, которую можно отозвать владельцу. Страница статуса не должна раскрывать лишние birth details, внутренние notes, цену других валют или ссылки на ещё не утверждённые PDF. Для готового результата предпочтительны time-limited S3 URLs или серверный выдающий endpoint с проверкой access token.

| Возможность | Требуемый контур |
|---|---|
| Status link | Random token с TTL, revoke и audit view |
| Status phases | «Получено», «Оплата подтверждена», «В подготовке», «На проверке», «Отправлено» |
| Secure download | Owner-approved report version + expiring URL |
| Client notice | Локализованный, минимальный текст без обещаний результата |
| Support minimization | FAQ и ясные ожидания по срокам вместо ручной переписки |

## Этап 3.5 — Контент и измерение

После стабилизации service flow можно улучшить публичный маркетинг. Создайте локализованные страницы о содержании Basic/Basic+, примеры структуры отчёта без реальных данных клиентов и FAQ. Аналитику включайте только после явного пользовательского opt-in; это уже поддержано privacy choices UI и должно сохраниться.

## Универсальный Definition of Done

Каждая новая задача считается готовой только после того, как обновлены schema/migration при необходимости, API имеет owner/server validation, есть Vitest regression coverage, прошли `pnpm check`, `pnpm test` и `pnpm build`, а UI проверен на desktop и mobile. Перед значительными изменениями и перед deployment создавайте checkpoint. Для необратимых действий — миграций, отправки email, запуска платежа, смены production configuration — требуется отдельная явная проверка владельца.

## Не реализовывать без отдельного подтверждения

Не добавляйте фальшивые отзывы или рейтинги, открытые public admin endpoints, автоматическую публикацию персональных астрологических данных, передачу secrets в браузер, неаудируемые массовые email-рассылки или фоновый cron через `setInterval`. Все такие решения либо противоречат текущим ограничениям, либо существенно повышают риски проекта.
