# Настройка бюджетного production-сервера

Целевой профиль: Ubuntu 24.04 ARM64/x86_64, Oracle Always Free A1 или VPS с 4 ГБ
RAM, Docker Compose, MySQL на private network, Caddy и внешний Cloudflare R2.

## 1. Действия владельца в панели

1. Создать VM и добавить **публичный** SSH-ключ deploy-оператора.
2. Назначить static/reserved public IP.
3. В cloud firewall открыть TCP 80/443 всему миру; TCP 22 — только доверенному IP.
4. Добавить `PROD_HOST`, `PROD_USER` и private deploy key в GitHub Environment
   `production`. Ключи в чат и Git не передавать.

## 2. Первичная настройка через SSH

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git unattended-upgrades default-mysql-client rclone awscli
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
sudo install -d -m 0750 -o "$USER" -g "$USER" /opt/vedic-karma
```

Перезайти по SSH, затем клонировать **точный** release commit в
`/opt/vedic-karma/app`. Скопировать `.env.production.example` в `.env.production`,
заполнить на сервере и выполнить `chmod 600 .env.production`.

## 3. Запуск

```bash
cd /opt/vedic-karma/app
sh scripts/deploy.sh
curl --fail https://YOUR_DOMAIN/health
curl --fail https://YOUR_DOMAIN/ready
```

После первого запуска выполнить reference seed только с явным подтверждением:

```bash
PRODUCTION_SEED_CONFIRM=INITIALIZE-REFERENCE-DATA \
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile tools run --rm seed
```

## 4. Эксплуатация

- Ежедневно: `sh scripts/backup-db.sh` и `sh scripts/backup-s3.sh` через systemd
  timer/cron; alert, если свежей копии нет 26 часов.
- Еженедельно: обновления ОС и проверка свободного диска.
- Ежемесячно: restore в новую БД через `scripts/restore-db.sh`, затем удалить
  verification DB после подписанного результата.
- Перед deploy: backup, сохранение предыдущего image digest, CI green.
- MySQL 3306 привязан только к `127.0.0.1` для host-side backup; app 3000 наружу
  не публикуется.

Oracle ARM может не иметь capacity. Не автоматизировать бесконечное создание VM и
не обходить проверки аккаунта: при отсутствии capacity выбрать Hetzner/Timeweb.
