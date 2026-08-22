# Unified Backup Package Index

Этот ZIP объединяет переносимую копию проекта и всю актуальную документацию. Для начала прочитайте `README.md`, затем `ETAP-ODIN-FULL-PROJECT-HISTORY.md` и `ETAP-ODIN-RESTORE-INSTRUCTIONS.md`.

В архив входят исходники client/server/shared, Drizzle schema и migrations 0000–0017, scripts, tests, current Report Studio implementation, calculation adapter, geocoding, AI narrative, PDF renderer, owner approval/delivery workflow, `ETAP-DVA-ROADMAP.md`, `ETAP-DVA-REPORT-STUDIO-SPEC.md`, `ETAP-DVA-PDF-LAYOUT.md`, research notes, security documents, `todo.md` и этот индекс.

Архив намеренно не содержит реальные секреты, `.env`, cookies, production database, S3 object bytes, private keys, `node_modules`, `dist`, `.git` и logs. Полное восстановление требует отдельной настройки secrets, database, private storage, OAuth, NOWPayments, Resend и Maps/Forge services.

Текущая реализация Report Studio включает Lahiri/Vimshottari calculation contract, автоматическое city geocoding, structured AI narrative, 22/25-page PDF, D1/D9 vector chart panels, persistent AI model/limits settings, payment-triggered `report_jobs`, owner review/approval, Resend delivery и retry только для `delivery_failed`.

Checksum всего ZIP создаётся рядом с архивом в отдельном файле. После скачивания выполните `sha256sum -c vedic-astrology-booking-unified-backup.zip.sha256` и затем следуйте restoration guide.
