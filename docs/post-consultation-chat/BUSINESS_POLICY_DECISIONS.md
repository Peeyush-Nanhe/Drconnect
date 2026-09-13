# Post-consultation chat: owner decisions

Status: **Unapproved** as of 2026-09-12. The request authorises technical implementation, not invented prices, plan interpretation, real-patient rollout or a reduced text-only release. Record explicit owner decisions here with approver, date, effective policy version and migration/release reference before activation.

## Recovered product options, not a live catalog

| Item | Recovered option or conflicting copy |
| --- | --- |
| Free allowance | 24 hours; 25 patient messages; 10 audio minutes; 2 calls. |
| Start time | “After every consultation” conflicts with “After payment.” |
| Doctor replies | Replies always free; patients use tokens. |
| ₹200 recharge | 7 days chat **OR** 20 audio minutes **OR** 15 video minutes. |
| ₹400 recharge | 15 days chat **OR** 40 audio minutes **OR** 30 video minutes. |
| ₹800 recharge | 30 days chat **OR** 80 audio minutes **OR** 60 video minutes. |
| Credit scope | Tokens work with ANY doctor; this does not authorise a new clinical relationship. |
| Prescription/AI | Digital prescription plus AI explanation ₹300; fee, consent, integration and clinical review unapproved. |

OR has not been interpreted as a bundle. Days of chat have not been interpreted as unlimited messages. No automatic prescription fee, purchase credit or doctor relationship is granted.

## Required decisions

| ID | Owner decision required | Status and safe technical behaviour while pending |
| --- | --- | --- |
| A | Exact free-period trigger; required payment state; which authoritative completed clinic/video/home encounters qualify; late completion callback behaviour. | Pending. Only clearly labelled synthetic server fixtures; no production free benefit. |
| B | Allowance scope per consultation, relationship or account; repeat visits; stacking/order of consumption; expiry and remaining-credit treatment. | Pending. Test fixture behaviour is not a commercial commitment. |
| C | Which text, attachment, location/contact, request and call events consume units; combined audio/video two-call cap; doctor-initiated payer and explicit patient consent. | Pending. Doctor text replies must never consume patient outgoing quota. Other chargeable capabilities disabled. |
| D | Alternative benefits versus bundle; selected option; activation event; calendar duration; time zone; usage caps; overlap. | Pending. No purchasable catalog or “Buy Now” success. |
| E | Cross-doctor credit scope among already-authorised relationships; mechanism/evidence for establishing new doctor access. | Pending. Credit scope cannot widen clinical access. |
| F | Prescription fee, charge event, clinician decline, cancellation, refund/dispute and amendment rules; AI explanation fee/consent/review. | Pending. Request is not prescription issuance or charge; declined requests produce no fabricated treatment. |
| G | Response expectations; availability/offline wording; urgent-help wording; blocking/suspension and appeals; retention/access/export/deletion; permitted audited support scope. | Pending. Availability unknown; no response guarantee. Real-patient use disabled. |

## Additional approvals required for full delivery

| Decision | Required owner or accountable team |
| --- | --- |
| Approved quarantine/scanner provider, allowed formats, maximum sizes, clinical-file retention, quarantine TTL, deletion and immediate-revocation requirements | Owner + security/clinical operations. |
| Audio/video provider, credentials, verified usage rules and enforcement controls; no recording by default | Owner + backend/media integration. |
| Payment provider/merchant configuration, signed webhook/reconciliation, tax/receipt/refund/dispute treatment | Owner + payments operations. |
| Pilot notification channel, notification copy, installed test devices and hosted retry worker | Owner + mobile/operations. |
| Prescribing identity/signature format, authorised clinical record store and immutable amendment process | Clinical owner + backend. |
| Family/dependent legal authority, current/revoked delegation and permitted prior-history scope | Owner + clinical/privacy operations. |
| Reduced scope release | Owner must explicitly approve scope and remaining gates; a text pilot is not full module acceptance. |

## Policy activation requirements

Commercial settings belong to a new immutable server policy version. Existing purchased-plan and episode snapshots must keep the exact approved terms that applied at grant/purchase time. Store amounts/currency, selected benefit, units, activation/expiry, purchaser and verified payment reference, and deduplicate purchase grants by provider/order/event identity.

Doctor replies remain free when patient outgoing units are exhausted; access and safety restrictions still apply. Paid expiry does not by itself remove readable authorised history. Refunds/reversals append accounting events and do not delete conversation history. These constraints are specified by the owner request and must not be weakened by a later implementation choice.

Test-only policy fixture values exercise boundaries and atomicity. They cannot be promoted by renaming the fixture or populating a real-patient allowlist. Approval and delivery-gate evidence must precede a new production policy.
