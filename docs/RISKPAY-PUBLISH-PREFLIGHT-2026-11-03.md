> Обновление 4 ноября: владелец выбрал ручное принятие поступления и отдельное
> подтверждение отправки конкретной версии PDF. Это заменяет прежнее требование
> полной автоматики карточной выдачи. Новый рабочий процесс и ограничения:
> [RISKPAY-MANUAL-OWNER-2026-11-04.md](RISKPAY-MANUAL-OWNER-2026-11-04.md).
> Ниже сохранена история предыдущих проверок; она не означает, что live уже включён.

# Publication preflight — 3 November 2026

The owner explicitly authorized a separate GitHub version and production publication.
This supersedes the earlier sandbox-only publication restriction; the instruction not
to contact RiskPay support remains in force.

## Observed production state

- Northflank team/project/service: starlordkarmas-team / vedic-karma-design / vedic-karma-app.
- Domain: https://karmalifedesign.com . Service is running with both health checks passing.
- Current source and rollback reference: `b01143db1a2ef43c6c15931c4e91c5e8bbd37c20`, main.
- Current image: `humble-frog-7504`; continuous deployment follows main.
- This candidate is based on that current main, preserving newer social-publisher code.
  It does not contain the unrelated uncommitted promotion work from the working folder.

## Publication decision

**Not ready to enable real RiskPay charges.** No production deployment or main merge
has been performed as part of this preflight. Publishing this candidate unchanged
would not activate cards: routes are intentionally isolated by the sandbox guard and
live checkout explicitly refuses to run without authoritative settlement quoting.
Mock proofs and conditional Apple/Google Pay preferences must not be advertised as
verified production processing.

1. Northflank's official incident report states control-plane secrets may have been
   compromised on 30 October. The owner answered that rotation has not been done or
   is uncertain. Provider keys, storage/mail/AI credentials, database credentials and
   authentication secrets must be reviewed and replaced before activating this route.
   The owner subsequently authorized rotation. R2 and Resend replacements are
   independently checked from the running application; prior site keys are revoked.
   AI, MySQL user-facing passwords, owner-session and invoice-signing replacements
   are applied and checked; MySQL rotation is finalised. See
   PUBLICATION-STATUS-2026-11-03.md for dated evidence and exact scope.
   No secret values are included in this repository.
   Source: https://status.northflank.com/cmvv0rn5a092f14rutwccodpp .
2. The actual gross USD / incoming USDC / merchant-net quote source is still missing.
   Neither arbitrary fee estimates nor an unsigned callback establish full payment.
3. Production callback delivery, live refund quoting, persistence of acceptance block
   and actual-RPC proof integration still require an implementation and acceptance test.
4. Exact token/processor route, product/country eligibility and refund restrictions
   are not independently established by the completed fixture tests.

## Completed and preserved

Documented RiskPay API adapter, conditional card/wallet selection, separate consent,
no delivery on redirect/callback alone, durable mock receipt/report/PDF/email flow,
manual refunds with exact buyer acceptance and atomic synthetic transfer claims,
14-day reserve from verified net receipts, private owner dashboard, regression tests.
Real funds, API keys, wallet keys, private status links, local environments and
generated relay identity are excluded from the GitHub candidate.

This is an honest saved candidate, not a claim that real cards have been tested.

Code commit `3df6b51e63e8c6e681c6cee941ce8c9c84d59435` passed all four jobs
in https://github.com/StarLordKarma/VedicKarmaDesign/actions/runs/41688963047 .
Subsequent documentation-only status updates do not establish live payment readiness.
