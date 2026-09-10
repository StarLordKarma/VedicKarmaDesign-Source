# Отчёт о подготовке sandbox и полного тестирования

**Дата:** 2026-09-10

## 1. Выполненные изменения

- Создан изолированный `docker-compose.sandbox.yml` с приложением, MySQL 8,
  приватным MinIO и локальным mock-сервисом.
- Реализованы безденежный checkout и подписанный NOWPayments-compatible IPN,
  локальная доставка Resend-compatible писем, Maps и LLM responses.
- Добавлен sandbox-only owner login с timing-safe token; вне sandbox режим
  блокируется конфигурационной проверкой.
- Добавлен безопасный idempotent seed: тестовый владелец, четыре локализованных
  заказа и три synthetic report jobs.
- Добавлены Playwright E2E и отдельный GitHub Actions job полного sandbox-цикла.
- Endpoint overrides ограничены: независимый production отвергает HTTP endpoints.
- Документированы расходы, сценарии, credentials и ручная приёмка.
- Подтверждены AGPL source-link и корректные формулировки о fiat privacy.

## 2. Архитектура sandbox

- `app`: production image, доступный только на `127.0.0.1:3000`;
- `mysql`: локальная MySQL 8 на `127.0.0.1:3308`;
- `minio`: приватный bucket и console на портах 9010/9011;
- `mock-services`: payment/Resend/Maps/LLM на `127.0.0.1:4010`;
- `migrate` и `seed`: одноразовые tools-profile контейнеры;
- Playwright: browser acceptance поверх полного пользовательского цикла.

Ни один компонент не требует внешнего API-ключа или перевода денег. Все fixture
данные синтетические и имеют домен `sandbox.invalid`.

## 3. Результаты проверок

- Lint/TypeScript: без ошибок.
- Unit/integration/UI: **186 passed, 12 skipped, 198 всего**. Пропущены только два
  набора внешних credentials, намеренно закрытые флагом (10+1+1 tests).
- Production build клиента и сервера: успешен; есть прежнее неблокирующее Vite
  предупреждение о крупных vendor chunks.
- Production dependency audit: 0 известных уязвимостей.
- Playwright discovery: 3 E2E-сценария обнаружены.
- YAML parsing и `git diff --check`: успешно.
- Docker-сборка/E2E на локальной машине: не выполнялись — Docker CLI отсутствует.
  Тот же цикл добавлен обязательным job `sandbox-e2e` в GitHub Actions.
- Мультиязычность: RU/EN/DE/ES покрыты unit/UI и новым privacy E2E.
- AGPL: footer использует `VITE_SOURCE_CODE_URL`; production требует URL и лицензию.
- Fiat: во всех четырёх privacy-текстах прямо сказано, что платёж не анонимен;
  заявлена только минимизация данных.

## 4. Необходимые доступы от пользователя

Для локального sandbox — никаких. Для проверки настоящих внешних providers нужны
отдельные ограниченные staging credentials, перечисленные в
[SANDBOX-CREDENTIALS-NEEDED.md](SANDBOX-CREDENTIALS-NEEDED.md). Главный блокер
публичного запуска — приватный GitHub URL не выполняет AGPL для обычного
пользователя: нужно открыть репозиторий или публичное зеркало deployed source.

## 5. Оставшиеся ограничения

- GitHub Actions должен подтвердить container build и три E2E на Linux/Docker.
- Provider mocks проверяют договор приложения, но не реальные кабинеты/OAuth/DNS.
- Расчёты требуют независимого benchmark минимум на 10 эталонных картах.
- Политике конфиденциальности нужны реальные реквизиты контролёра данных и
  юридическая проверка по целевым рынкам.
- Один VPS — дешёвый, но содержит single point of failure; обязателен off-site backup.

## 6. Следующие шаги

1. Дождаться зелёного `sandbox-e2e` для этого commit и скачать artifacts при сбое.
2. Сделать source repository или точное зеркало публичным для соблюдения AGPL.
3. Выбрать временный staging domain/VPS и заполнить только staging credentials.
4. Пройти provider acceptance, restore rehearsal и астрологический benchmark.
5. Выполнить [PRE-LAUNCH-CHECKLIST.md](PRE-LAUNCH-CHECKLIST.md) перед заказами.
