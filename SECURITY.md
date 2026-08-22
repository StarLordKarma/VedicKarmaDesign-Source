# Admin security and access

## How the owner signs in

Open `/admin` on the published site. If there is no active session, select **Sign in as owner**. The button starts the existing Manus OAuth flow; complete sign-in with the same owner account that is configured for this project. After the OAuth callback returns to the site, open `/admin` again if the dashboard did not appear automatically.

The admin page is not protected by a client-side button alone. Every admin tRPC procedure is protected on the server and requires an authenticated account whose role is `admin` and whose exact `openId` matches the server-side `OWNER_OPEN_ID`. This applies to booking data, notes, status changes, exports, PDF uploads, and client email delivery. A user with an admin role but a different identity is rejected.

## 2FA recommendation

Enable two-factor authentication on the identity provider account used for the project owner OAuth login. Prefer an authenticator-app TOTP or a hardware security key, keep recovery codes offline, and avoid SMS when a stronger option is available. Use a unique password for the identity provider, review active sessions periodically, and revoke unknown sessions immediately.

This application intentionally does not add a second password or bearer-token form in front of OAuth. A parallel password/token system would create another credential store and another recovery surface, and a browser-visible token could become an administrative credential if leaked. The existing OAuth session plus the server-side owner identity gate is the safer source of truth. If app-level 2FA is required independently of the OAuth provider, it should be implemented as a dedicated WebAuthn/TOTP project with encrypted secret storage, recovery-code rotation, rate limiting, session re-authentication, and a migration plan; it should not be approximated with a shared password or static URL token.

## Operational checklist

Confirm that `OWNER_OPEN_ID` is set to the owner identity and that no other user row is promoted to `admin`. Keep `JWT_SECRET`, `RESEND_API_KEY`, `NOWPAYMENTS_API_KEY`, and other secrets only in the project secret manager. Do not paste them into the browser, source code, URLs, or client-side environment variables. Before sending a natal-chart PDF, verify the client email address and attached file in the admin card; the action is audited with sending, sent, and failed states. Test delivery with a controlled address before using a real client address.
