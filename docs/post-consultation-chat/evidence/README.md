# Actual staging browser evidence

The final implementation evidence is in [`candidate/`](candidate/browser-smoke.json): nine checks passed on the isolated commit candidate at `http://127.0.0.1:8084`, after a clean dependency install and all 79 tests. [Validation](validation.json) confirms that its 18 changed source files match implementation commit `88bcec1bcf19b7c2880f5b25386a521021a025e2` byte-for-byte. Capture metadata records the earlier base commit plus exact source hashes because the candidate was tested before committing. Sources stayed unchanged during capture. The original working-tree captures below are retained as earlier evidence and include the owner's unrelated unfinished UI edits.

Captured by `scripts/test-post-consultation-chat-browser.mjs` using isolated headless Chrome and the actual local TanStack development server at `http://127.0.0.1:8083`, with browser client hostname verified as `pyrlvjeectjikvfksukb.supabase.co`.

`browser-smoke.json` records timestamp, repository commit, hashes of the exact local source and migration files, and nine passed checks. `sourceChangedDuringRun: false` means those source files were stable throughout this recorded run. Screenshots show the working tree; they do not prove that a later commit, a production web host or an installed mobile build was tested.

| Screenshot | What it actually proves |
| --- | --- |
| `01-signed-out-auth.png` | A fresh browser context is redirected to the real MyDox sign-in screen. |
| `02-authenticated-patient-home.png` | The existing owner-established synthetic patient can authenticate and reach the actual homepage. |
| `02-authenticated-patient-inbox.png` | Home → Consult → Chats · Your Doctors shows no authorised consultation chats for this account; the existing group/reel sections remain in place. Those unchanged group/reel examples are not follow-up thread data or proof of real group/media transport. |
| `03-previous-consultations-gated.png` | Consult → Consultation history opens the existing history page and the completed-home panel explicitly reports its policy gate. Existing synthetic legacy-care rows do not establish genuine eligible chat completion. |
| `04-completed-item-chat-gated.png` | An existing completed legacy consultation opens the actual modal, which displays server denial and disables the composer. It does not grant a conversation or show sample messages. |

The existing patient was verified as a marked staging fixture through Auth app metadata. No account was created, upgraded, reset or added to a clinical pilot. No password, token or cookie was captured in screenshots or logs. The preserved local demo-password variable did not authenticate this fixture; the final run used the application's already-existing demo patient button and verified its identity. This does not remediate that inherited button's credential-storage design.

Authenticated hosted negative checks passed: context remains disabled/test-only with all unfinished integrations disabled; inbox is empty; arbitrary open/send is denied with `42501`; direct canonical-message insert is rejected; the patient cannot select the debit ledger. These checks do not prove an authorised two-party conversation, entitlement race, uploaded file, call, payment, prescription issuance, push delivery, device restart or full founder demonstration.

Reproduce with a separately launched isolated Chrome debugging endpoint and the approved local environment:

```sh
node --env-file=.env scripts/test-post-consultation-chat-browser.mjs --existing-demo --demo-button --url=http://127.0.0.1:8083
```

Without the existing synthetic demo flag, the script only checks signed-out routing. The development server is required because the test imports its real authenticated client module. No static preview or fabricated prototype screenshot substitutes for this evidence.
