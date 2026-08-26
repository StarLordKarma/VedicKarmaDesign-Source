# Privacy and consent implementation sources

This note supports the project’s legal-technical review. It is not legal advice and does not replace a jurisdiction-specific review by qualified counsel.

| Source | Implementation consequence |
|---|---|
| [ICO — Consent](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/) | Consent must be assessed for validity and managed/recorded. The booking flow should require a clear affirmative action, record consent version, timestamp and selected interface language, and keep optional analytics separate from service booking. |
| [Regulation (EU) 2016/679 (GDPR)](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) | The site must give transparent information, use an appropriate lawful basis, and keep records adequate for accountability. German and Spanish flows should use the same GDPR-aligned mechanism, subject to local legal review. |
| [Роскомнадзор — уведомление об обработке персональных данных](https://pd.rkn.gov.ru/operators-registry/notification/) | The Russian operator must assess notification and other applicable obligations independently. The site should make the operator identity/contact and the processing information visible in Russian before consent. |
| [EDPB Guidelines 05/2020 on consent](https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en) | Cookie/analytics choices should be separate from contract/service data processing; the visitor can refuse optional analytics without losing the essential site experience. |
| [AEPD cookies policy](https://www.aepd.es/en/cookies-policy) | The Spanish-language visitor flow should distinguish technical browser storage from optional analytics/cookies and not treat a general site visit as blanket consent. |

## Operational note

The live Resend credentials probe is intentionally opt-in (`RUN_EXTERNAL_CREDENTIAL_TESTS=true`) because outbound provider availability is not a deterministic unit-test dependency. When enabled, it retries temporary transport failures but preserves a failing result for an invalid API key or other non-retryable `4xx` response.

The public UI will not describe itself as legally compliant or claim to eliminate fines. Operator identity, address, privacy contact, retention schedule, processor agreements, transfer mechanisms, cookie classification, and any required notifications remain owner/legal-counsel responsibilities before relying on the public service.
