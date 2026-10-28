# Owner update, 28 October 2026

Instagram uses the verified scheduled YouTube time without checking actual public status. Instagram 1 starts no earlier than 60 minutes after YouTube publishAt; Instagram 2 remains at least 60 minutes after confirmed Instagram 1. A YouTube delay or failure may mean Instagram appears first. Cloud handoff still verifies upload, channel, media hashes, processing and YouTube schedule.

---

# Existing-site cloud publisher

This adds a separate owner-only publisher at `/admin/social-publisher` to the existing Northflank app. It does not create hosting resources or change website products, checkout, customer data, or database schema.

Only new reviewed 9:16 Cosmic Psyche Shorts are eligible. Local Codex prepares the YouTube package and distinct English Instagram captions, uploads to YouTube privately, verifies its thumbnail in Studio and native publishAt, and transfers the immutable media and job to this service. Cloud acceptance requires completed YouTube processing, the exact channel and scheduled release, and SHA256 verification of both media objects. No test posts are published.

The cloud verifies YouTube public status using the existing channel credentials before starting a minimum 60-minute delay. It then publishes emilialifedesign, waits at least another 60 minutes from verified completion, and publishes morgan506942. Global limits are one Reel/account/24h and 60 minutes between Instagram releases. The same YouTube cover artwork is reused as JPEG without changing the video. Keywords belong in captions; Instagram has no YouTube-style SEO tags field.

## Storage, credentials and concurrency

All state is under the private R2 `social-publisher-v1/` prefix. Publishing credentials and the scoped client key are AES-256-GCM encrypted using a purpose-bound key derived from the existing owner session secret. Secret rotation requires re-pairing. No credentials or raw provider errors are logged or returned. Anonymous access cannot read the queue or obtain media URLs. Existing private PDF access remains unchanged.

The owner imports a local private pairing file once. It contains publishing credentials for the two verified Instagram identities and the Cosmic Psyche YouTube OAuth client/refresh credentials for schedule verification. Import verifies all three identities. The local scanner authenticates through a dedicated random bearer key, never the owner's website session key. A different pairing key is refused while paired; deliberate replacement requires an administrative recovery procedure.

Uploads use one-hour R2 presigned PUT URLs directly from the Mac. The app streams media only while hashing it at acceptance, and does not buffer whole videos. Meta receives six-hour signed GET URLs. The bucket remains private. Media is capped at 1 GiB, the total existing bucket at 8 GiB, at most 20 unfinished jobs, and 300 MiB per video. These are application caps, not proof of account-wide free-tier availability: verify Cloudflare billing/usage before activation if other buckets or workloads share the account. No new paid services or plan changes are performed.

A dedicated MySQL connection holds a named advisory lock during queue mutations and each worker pass. No schema migration is needed. Markers are persisted before Instagram create/publish calls; an unknown response stops in needs_reconciliation. It never blindly repeats a publish. Polling is every five minutes normally and once per minute while a media container is processing, at most five polls. The worker runs in the existing always-running app; it depends on Northflank availability and the existing free plan remaining active. It is not Instagram's native Schedule feature.

## Disconnecting Seagate

A local job is safe to leave only after a fresh authenticated cloud check confirms its exact digest/video ID and queued or complete status, and YouTube's native schedule/processing are verified. The safe-eject app refuses untransferred, unknown, local Postiz queue, or active local work. After cloud handoff, the Mac and Seagate can be off while the existing website performs Instagram releases.

Cloud receipts remain in private R2. On reconnection, the local scanner retrieves verified results and saves video, the common cover, caption, ID, link, and timestamp separately under `History/emilialifedesign/<item>` and `History/morgan506942/<item>`. No original video is deleted. Archive failures retry archive work, not social publishing. Cloud media is retained until a deliberate cleanup; reaching the cap pauses new handoffs.

## Validation and rollout

Run typecheck, unit/integration tests and production build. Deploy only the isolated module and its registration. Check public publisher health, existing `/health` and `/ready`, owner authentication and anonymous denial. Do not label the system fully activated until the owner pairing file is imported, all identities verify, the worker heartbeat is healthy, and R2 access is confirmed. A real upload-to-publication path is verified only when an authorized new video arrives; synthetic tests do not prove live Reels rendering.
