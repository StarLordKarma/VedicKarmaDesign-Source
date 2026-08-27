# Инструкция для другой ИИ или разработчика

**Цель:** безопасно понять, развернуть, проверить и продолжить Vedic Astrology Booking. Этот файл можно передать другой ИИ вместе с исходным ZIP-архивом. Не передавайте ей реальные пароли, токены или экспорт production персональных данных в обычном чате.

> Работай с проектом как с production-системой обработки персональных данных. Не отключай server-side owner guard, не подменяй audit-history фиктивными данными и не отправляй реальные письма/платежи в тестах без прямого подтверждения владельца.

## 1. Краткое техническое описание

Приложение является full-stack TypeScript проектом: React 19 + Vite + Tailwind на клиенте, Express + tRPC на сервере, Drizzle ORM и MySQL/TiDB для данных. Оно использует Manus OAuth в текущем хостинге, NOWPayments для криптооплаты, Resend для email и S3-compatible storage для PDF. При независимом развёртывании OAuth и storage adapter должны быть заменены или перенастроены через environment configuration.

| Слой | Каталоги / файлы | Ответственность |
|---|---|---|
| Browser UI | `client/src/` | Public booking, privacy, owner workspace, Report Studio, Payment Test Lab |
| API | `server/routers.ts` | Typed public/admin tRPC contracts и owner authorization |
| Business logic | `server/*.ts` | Checkout, IPN, PDF, delivery, reports, cleanup |
| Data schema | `drizzle/schema.ts`, `drizzle/*.sql` | Таблицы и migrations |
| Shared validation | `shared/` | Zod-like contracts, booking/pricing domain constants |
| Tests | `server/*.test.ts`, `client/src/**/*.test.tsx` | Regression safety net |

## 2. Обязательные принципы продолжения

Административная защита обязана быть на сервере. Все операции, доступные только владельцу, должны оставаться `adminProcedure` и сверять текущего пользователя с `OWNER_OPEN_ID`. Не считай скрытую кнопку в React контролем доступа.

Расчёт астрологических фактов и текст отчёта разделены. Сначала создаётся валидируемый deterministic facts JSON; затем AI может сформировать narrative JSON только на основе фактов; затем PDF проходит owner review перед отправкой. Сохраняй эту цепочку и не позволяй модели самостоятельно менять факты рождения или автоматически подтверждать delivery.

| Неизменяемое правило | Практическая причина |
|---|---|
| Не хранить secrets в Git/ZIP/client bundle | Исключает немедленную компрометацию платежей, email и базы |
| Не редактировать snapshot существующего заказа | Историческая цена и пакет должны оставаться проверяемыми |
| Не использовать `setInterval` или `node-cron` для managed cleanup | В autoscaling-среде процесс может остановиться; используется внешний HTTP scheduler |
| Не создавать тестовые реальные платежи/клиентские письма | Payment Test Lab намеренно изолирован |
| Не добавлять вымышленные отзывы/рейтинги | Запрещено политикой проекта и создаёт consumer-protection risk |

## 3. Локальное развёртывание

### 3.1. Подготовка

Требуются Node.js 22+, pnpm, MySQL 8+/совместимый TiDB и отдельные аккаунты внешних сервисов. Распакуйте исходный архив в рабочую папку и убедитесь, что `node_modules`, `dist`, `.git`, production database и реальные `.env` в архив намеренно не включены.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

После запуска local server должен показывать public site. Owner admin routes требуют настроенной аутентификации и identity, соответствующей `OWNER_OPEN_ID`.

### 3.2. Переменные окружения

Создайте секреты в выбранном secret manager или локальном некоммитимом `.env`. Значения ниже — это **имена**, а не шаблоны реальных ключей.

| Переменная | Обязательность | Назначение |
|---|---:|---|
| `DATABASE_URL` | Да | Строка подключения к production MySQL/TiDB |
| `JWT_SECRET` | Да | Подпись secure session cookie; новая длинная случайная строка |
| `OWNER_OPEN_ID` | Да | Уникальный subject владельца из выбранного OAuth provider |
| `OWNER_NAME` | Да | Отображаемое имя владельца в admin audit history |
| `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` | В текущем Manus OAuth | Конфигурация авторизации; замените при переносе на независимый provider |
| `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | Для криптооплаты | Только серверный checkout и IPN verification |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OWNER_ALERT_EMAIL` | Для email | Delivery PDF и owner alerts; верифицируйте домен отправителя |
| `BUILT_IN_FORGE_API_*`, `VITE_FRONTEND_FORGE_API_*` | Только текущая Manus-среда | Замените совместимыми adapters при независимом хостинге |
| `VITE_ANALYTICS_*` | Необязательно | Только opt-in analytics configuration |

Никогда не передавайте значения секретов другой ИИ через prompt. Если AI должна изменить integration, дайте ей имена secret variables и скажите использовать platform secret manager.

### 3.3. База данных

Перед первым production запуском создайте пустую базу и примените migrations в хронологическом порядке. Проверьте каждый SQL файл перед исполнением; destructive schema changes нельзя применять без backup и явного подтверждения владельца.

```bash
pnpm drizzle-kit generate
# Review the generated drizzle/*.sql file.
# Apply approved SQL through the selected deployment migration workflow.
```

Актуальная миграция `0029_fresh_doctor_octopus.sql` добавляет `notificationLocale` в retention settings и table `payment_test_lab_cleanup_history`. Последняя price configuration и audit history находятся в production DB; их нельзя восстановить из исходного ZIP без отдельной резервной копии DB.

## 4. Проверка ключевых сценариев

Сначала запусти статические и unit/integration tests. Внешние credential probes могут быть намеренно skipped, если не установлен `RUN_EXTERNAL_CREDENTIAL_TESTS=true`; не меняй это по умолчанию на production.

| Сценарий | Ожидаемый безопасный результат |
|---|---|
| Public booking | Сервер рассчитывает цену и создаёт checkout без помещения ключей в клиент |
| Owner Admin | Не-владелец получает server-side `FORBIDDEN` |
| Price update | Требует modal confirmation, сохраняет history и не меняет historical bookings |
| Payment Test Lab | Симулирует signed IPN внутри приложения без provider funds/client email/report execution |
| Retention cleanup | Имеет preview, confirmation, cleanup audit history, CSV и non-blocking owner summary |
| Report Studio | Создаёт/просматривает synthetic job без customer delivery, пока владелец не approve |

## 5. Работа с managed scheduler

Scheduled cleanup реализуется HTTP callback под `/api/scheduled/cleanup-payment-test-lab` и должен запускаться внешним scheduler/managed heartbeat, а не таймером внутри Node process. В текущем окружении он был настроен как ежедневный 90-day default job; перенос на другой сервер требует создать эквивалентный защищённый cron/HTTP job и проверить его authentication/idempotency.

Когда меняется scheduled handler, сначала сделай checkpoint/релиз кода, затем меняй задачу scheduler. Handler должен отрабатывать безопасно при повторном вызове, потому что managed scheduler может повторить запрос после 5xx/429.

## 6. Что обязательно проверить при продолжении

1. Прочитать `README.md`, этот документ, `docs/PROJECT-HISTORY-2026-08.md`, `todo.md` и `ETAP-DVA-REPORT-STUDIO-SPEC.md`.
2. Запустить `pnpm check`, `pnpm test`, `pnpm build` и устранить ошибки до feature work.
3. При изменении schema: обновить `drizzle/schema.ts`, сгенерировать migration, просмотреть SQL, применить только после backup.
4. При изменении API: написать server test и проверку `FORBIDDEN` для не-владельца.
5. При изменении интерфейса: расширить React test и вручную проверить desktop/mobile view.
6. При изменении email: не включать в templates платежные payload, IPN signature, API key или лишние персональные данные.

## 7. Reference links

[1]: https://www.typescriptlang.org/docs/ "TypeScript documentation"
[2]: https://orm.drizzle.team/docs/overview "Drizzle ORM documentation"
[3]: https://documenter.getpostman.com/view/7907941/2s93JusNJt "NOWPayments API documentation"
[4]: https://resend.com/docs "Resend documentation"

