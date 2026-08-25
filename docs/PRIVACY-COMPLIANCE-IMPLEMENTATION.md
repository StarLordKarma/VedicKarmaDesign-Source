# Privacy and data-protection implementation notes

> This document is an engineering and operational checklist, not legal advice. It does not determine the operator, establishment, target markets, legal bases, retention periods, transfer mechanisms or filing duties. A qualified lawyer should review the final notice before launch.

## Implemented in the site

The public site now provides a privacy and data-protection page at `/privacy` in English, Russian, German and Spanish. The booking form requires an explicit acknowledgment checkbox and links to that page before a booking can be submitted. The footer also links to the notice. The notice explains the controller placeholder, categories of data, purposes and possible legal bases, processors, retention, rights, security, international transfers, browser storage and the astrology-service disclaimer.

The owner SLA email workflow now has a persistent allowlist. Addresses are normalized to lowercase, stored uniquely, can be enabled or disabled by the owner, and can be removed. The server checks active membership immediately before decoding and sending the PDF; an empty list therefore blocks all SLA report recipients. The allowlist contains email and operational audit metadata only and is owner-only through `adminProcedure`.

## Operator actions required before production

The operator must replace the working-notice placeholders with the legal name or organisation, postal address, privacy email, applicable supervisory authority, actual provider list, provider locations, data-processing agreements, transfer safeguards, retention schedule and any required local registrations or notices. The operator should also maintain a record of processing activities and a data-breach response procedure appropriate to the actual business.

The operator must decide whether analytics, marketing pixels, cookies or other non-essential technologies are enabled. If they are enabled, the consent mechanism, vendor list and withdrawal mechanism must be implemented for the visitor's jurisdiction. Required booking processing should not be made conditional on unrelated marketing consent.

## Jurisdiction notes

For EU/EEA visitors, the operator should validate GDPR transparency requirements, the selected Article 6 legal bases, processor arrangements, international transfer safeguards, data-subject rights and the competent supervisory authority. Germany and Spain may add local ePrivacy, consumer, imprint, language, supervisory and sector-specific requirements; a generic translated notice is not a substitute for local review.

For visitors in Russia, the operator should obtain local advice on the applicable Russian personal-data rules, operator notices and filings, data-localisation requirements, cross-border transfer procedures, consent wording and communications. The fact that the site is available in Russian does not itself establish that Russian law applies, and the fact that it is hosted elsewhere does not remove an applicable local obligation.

For English- and Spanish-language visitors outside the EU/EEA, the operator must identify the actual country or state law that applies instead of assuming that the language selects one legal regime. The controller should use the user's location, services offered, establishment and provider arrangements to decide whether additional notice or consent requirements apply.

## Technical data map

| Flow | Data | Purpose | Storage/recipient action |
|---|---|---|---|
| Booking form | Name, email, birth details, language, interest | Prepare and answer the requested reading | Store only in the booking/report workflow; disclose actual database, storage and report providers |
| Crypto checkout | Checkout and payment identifiers | Create and verify payment | NOWPayments and related provider terms must be documented |
| Report/PDF | Validated birth facts, narrative and report metadata | Generate and deliver the requested report | Document report storage, AI/processing provider and retention |
| Receipt/status | Email, receipt reference, status token | Send receipt and show limited order status | Receipt expiry and status-link expiry/revocation are configurable |
| Security | Correlation ID, masked request metadata and rate-limit signals | Reliability, abuse prevention and incident review | Keep only for the documented minimum period |
| Owner allowlist | Normalized recipient email, label, enabled state, audit IDs/timestamps | Restrict owner-triggered SLA PDF delivery | Owner-only table; no report content is stored in the allowlist |

## Official starting points

1. [European Commission — Data protection explained](https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en)
2. [EDPB — Process personal data lawfully](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)
3. [GDPR text and Article 13 transparency reference](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
4. [BfDI — German data protection guidance](https://www.bfdi.bund.de/EN/)
5. [AEPD — Spanish data protection guidance](https://www.aepd.es/en)
6. [Roskomnadzor — Russian personal-data portal](https://rkn.gov.ru/personal-data/)

These links are starting points for review. They are not a legal opinion, and the operator must check current official guidance and the facts of the service before relying on them.
