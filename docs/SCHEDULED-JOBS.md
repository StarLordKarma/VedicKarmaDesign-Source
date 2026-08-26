# Managed scheduled jobs

| Job | Task UID | Schedule (UTC) | Callback | Purpose |
| --- | --- | --- | --- | --- |
| Payment Test Lab retention | `KU89XzchtnTx73cLNp3GCv` | Daily, 03:15 | `POST /api/scheduled/cleanup-payment-test-lab` | Deletes Payment Test Lab audit history older than 90 days. |

The cleanup is idempotent and cron-only. To inspect, pause, resume, update, or delete this project-level job, use `manus-heartbeat` with the stored task UID or the project Management UI schedule history.
