# Публикация соответствующего исходного кода AGPL

Текущий приватный репозиторий нельзя указывать как единственный source URL для
публичного сетевого сервиса. Без покупки коммерческой лицензии выбран следующий
порядок.

## Вариант A — открыть основной репозиторий

GitHub → Settings → General → Danger Zone → Change repository visibility → Public.
Перед действием проверить историю на secrets и клиентские данные. Изменение
видимости раскрывает всю историю и требует отдельного явного подтверждения владельца.

## Вариант B — публичное зеркало релизов

1. Создать публичный репозиторий без secrets/issues и инициализировать его README,
   чтобы ветка `main` существовала для первого запуска workflow.
2. Из чистого release checkout добавить зеркало как отдельный remote.
3. Отправить release commit и AGPL tag; не переписывать приватный `origin`.
4. Установить URL зеркала в `VITE_SOURCE_CODE_URL`, пересобрать image.
5. Для каждого deployment публиковать полный corresponding source, build/deploy
   инструкции, patches, LICENSE/NOTICE и точный tag до запуска версии.

Пример после создания пустого публичного репозитория:

```bash
git remote add public git@github.com:<owner>/<public-repository>.git
git push public main
git tag release-YYYYMMDD-01
git push public release-YYYYMMDD-01
```

Перед зеркалированием обязательно выполнить secret scan всей публикуемой истории.
Клиентские данные, `.env`, PDF, backups и ключи не входят в репозиторий.

## Подготовленная автоматизация

Ручной workflow `.github/workflows/publish-agpl-source.yml` копирует текущий source
tree без Git-истории, `.env`, зависимостей и build artifacts в отдельное публичное
зеркало. В Environment `agpl-publish` нужно сохранить закрытую часть отдельного
deploy key как `AGPL_MIRROR_SSH_KEY` (публичная часть добавляется в зеркало с
правом записи), а в
repository variable `AGPL_MIRROR_REPOSITORY` — значение `owner/public-repository`.
Token должен иметь Contents: Read/Write только на зеркало.

Workflow запускается вручную с подтверждением `PUBLISH-AGPL-SOURCE`. Он не меняет
visibility приватного origin и не должен запускаться до ручной проверки списка
публикуемых файлов. Каждая production-сборка использует URL соответствующего
mirror commit/tag в `VITE_SOURCE_CODE_URL`.
