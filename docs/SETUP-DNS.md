# Настройка домена, DNS и TLS

1. Купить домен и включить MFA, registrar lock, auto-renew и WHOIS privacy.
2. Добавить домен в [Cloudflare](https://dash.cloudflare.com/), выбрать Free.
3. У регистратора заменить nameservers на выданные Cloudflare и дождаться Active.
4. Создать proxied `A` запись `@` → reserved IPv4 сервера и `CNAME` `www` → `@`.
5. В Cloudflare SSL/TLS выбрать `Full (strict)`, включить Always Use HTTPS и DNSSEC.
6. На сервере установить `SITE_DOMAIN` и `PUBLIC_BASE_URL=https://<domain>`.
7. В OIDC callback указать `https://<domain>/api/auth/callback`, в NOWPayments —
   `https://<domain>/api/nowpayments/ipn`.
8. Для Resend добавить отдельные SPF/DKIM/DMARC записи строго по кабинету.

Caddy автоматически получает Let's Encrypt certificate. Cloudflare Origin CA не
нужен и усложняет перенос; применять его можно только при гарантированном proxy.

Для автоматизации создать Cloudflare API token с единственными правами
`Zone:DNS:Edit` и `Zone:Read` на одну zone и сохранить как GitHub Environment
Secret `CLOUDFLARE_API_TOKEN`. Global API Key запрещён.
