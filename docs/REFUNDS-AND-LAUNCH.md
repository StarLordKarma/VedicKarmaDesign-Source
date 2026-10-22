# Refunds and release operations

## Activation

Deploy code with REFUNDS_ENABLED=false. Run migrations 0034 and 0035 using the migration job built from the same release commit. Enable refunds only after owner authentication is configured and tested. Wallet owner authentication is opt-in (`AUTH_PROVIDER=wallet`), restricted to DIRECT_WALLET_ADDRESS and the configured OWNER_OPEN_ID; it grants administrator access and requires owner approval. Owner alert email is OWNER_ALERT_EMAIL, with an administrator-profile email fallback.

## Customer and owner workflow

The private order page accepts a problem/refund request from a wallet-bound order, including an unrecognized payment. A request itself proves neither payment nor entitlement. Owner approval independently verifies the archived signed invoice, the original binding and incoming receipt (official token, network, exact received amount, sender, recipient and finality). A verified late payment is eligible for investigation/refund too.

The first release supports a full refund of the original token amount on the original network to the original cryptographically bound payer. No customer-supplied destination, fiat repricing or private keys are accepted. Original network fees were paid to the network; the merchant pays the outgoing refund fee separately. Wrong-token, wrong-network and incomplete transfers require individual investigation. Mandatory customer rights are not excluded by the site policy.

Approval pauses fulfillment and private PDF access. Active generation/delivery must finish before approval. The owner reviews and confirms the actual transfer in their wallet. Neither the server nor the AI can spend merchant funds. Only independent final on-chain proof changes the order to refunded. Declines require a customer-visible explanation. The ledger and owner audit trail record transitions.

## Lost responses and replacements

The server freezes the EVM nonce or TRON unsigned transaction before returning it to the browser. Recovery reuses it, never silently issues a fresh payment. The browser saves returned hashes and records them on the server. A hash or an RPC timeout is not a completed refund.

EVM speed-up replacements must preserve the frozen nonce, token, calldata, sender and zero native value. All recorded candidates are checked; the finalized winning hash is saved. Do not independently send another refund with a new nonce. If a wallet consumes the reserved nonce for an unrelated transaction, investigate wallet history before further action.

TRON hashes cannot be substituted. Renewal requires the stored transaction to have expired for at least ten minutes, a valid current chain timestamp, and absence from both latest and solid node histories. Otherwise keep tracking the original transaction. Prefer completing one merchant refund at a time; a concurrently reserved nonce may need manual investigation.

## Reports and failures

Only confirmed paid orders enter production fulfillment. Failed generation can be recovered by the owner without charging again; an existing review PDF is reused. Delivery retries reuse the saved report. Approved refunds block delayed payment callbacks from restoring paid status.

AI drafts must pass language, structure, length and calculated-fact reference validation. Invalid or unavailable drafts use the explicitly recorded `curated-vedic-v1` interpretation, authored in four languages and personalized with calculated placements. Set REPORT_ALLOW_CURATED_FALLBACK=false to require AI exclusively. This fallback is not recorded as AI output. Advanced content describes D9 and numerology actually present in the PDF; it does not promise unimplemented gemstone or lucky-day predictions.

## Final acceptance requiring the owner

1. Complete the separately authorized owner sign-in and confirm the notification email.
2. Make a real $9.99 control purchase from a customer wallet. The owner performs the transfer personally.
3. Verify finalized payment, automatic report, private download, actual inbox delivery and owner alerts.
4. Request a refund, approve it as owner, personally confirm the outgoing wallet transfer, and verify final receipt and blocked fulfillment.

Automated checks and unpaid synthetic orders do not replace a real purchase/refund or prove delivery to the owner inbox. No real funds are transferred by the development agent.
