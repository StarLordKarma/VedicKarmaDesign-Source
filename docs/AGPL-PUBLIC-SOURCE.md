# Публикация соответствующего исходного кода AGPL

Текущий приватный репозиторий нельзя указывать как единственный source URL для
публичного сетевого сервиса. Без покупки коммерческой лицензии выбран следующий
порядок.

## Вариант A — открыть основной репозиторий

GitHub → Settings → General → Danger Zone → Change repository visibility → Public.
Перед действием проверить историю на secrets и клиентские данные. Изменение
видимости раскрывает всю историю и требует отдельного явного подтверждения владельца.

## Вариант B — публичное зеркало релизов

1. Создать пустой публичный репозиторий без secrets/issues.
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
