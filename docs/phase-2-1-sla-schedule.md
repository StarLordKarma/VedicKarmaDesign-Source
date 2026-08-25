# Report Studio SLA schedule

The production site has a platform-managed Heartbeat job for SLA evaluation.

| Field | Value |
|---|---|
| Name | `report-studio-sla-evaluation` |
| Task UID | `fBrbcSitQTNmYmjsyPf7qa` |
| Cron | `0 15 3 * * *` |
| Time zone | UTC |
| Callback | `POST /api/scheduled/evaluate-sla` |
| Purpose | Evaluate preparation and delivery SLA thresholds, deduplicate operational alerts, and notify the owner without exposing client data |

The callback is idempotent and cron-authenticated. Manage the schedule through the Heartbeat controls using the task UID; do not add an in-process timer or polling loop. If the callback implementation changes, save and deploy a new checkpoint before modifying this schedule.
