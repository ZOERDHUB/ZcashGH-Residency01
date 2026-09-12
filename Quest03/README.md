# Private Bill — Quest 3: Recipient Bank-Details Stage

Part of **Private Bill**, a Zcash-to-fiat payment platform being built
collaboratively during the ZcashGH Residency. Private Bill lets a
sender fund a payment with ZEC while the recipient receives ordinary
fiat currency — Nigerian Naira (NGN) or Ghanaian Cedi (GHS) — in their
bank account.

**Quest 1** built the exchange interface. **Quest 2** implemented the
ZEC conversion logic. **This Quest (Quest 3)** extends the flow with
the step after a user has confirmed their exchange amount: collecting,
validating, and storing the recipient's bank account details, ready
for whatever Quest implements the actual ZEC payment step.

Built with **Bootstrap 5** (vendored locally, not loaded from a CDN),
vanilla JavaScript, and no build step. Quest 1 and 2's exchange
interface is preserved unchanged as "Step 1"; this Quest adds "Step 2"
alongside it.

## What this Quest adds

- A **recipient bank-details form** — bank, account number, account
  name — shown after the exchange preview is confirmed.
- **Real format validation**, not just "is it non-empty": a genuine
  NUBAN check-digit algorithm for Nigerian accounts, a plausible
  length check for Ghanaian ones (Ghana has no equivalent nationwide
  standard), and a name-format check.
- Clear, field-level error messages, plus a summary banner if the form
  is submitted with more than one problem.
- A **transaction-state module** that holds the confirmed exchange and
  recipient data in memory, so it's genuinely available to whatever
  comes next — not just something displayed and then lost when the
  form component unmounts.
- Deliberate care about **not exposing the account number** more than
  necessary: masked in every read-only view after it's saved, never
  passed to `console.log` anywhere in the codebase, and never written
  to `localStorage`/`sessionStorage`.

## Architecture

```
banks.js  →  bankDetailsValidator.js  →  transactionState.js  →  app.js
(data)       (pure validation)            (in-memory storage)     (DOM only)
```

- **`js/banks.js`** — pure data: Nigerian banks with their 3-digit CBN
  interbank codes (needed for the NUBAN checksum), Ghanaian banks by
  name only (no checksum standard exists). A bank being renamed or a
  new one being licensed means editing this file alone.
- **`js/bankDetailsValidator.js`** — pure validation functions: zero
  DOM, zero network. Implements the actual CBN NUBAN check-digit
  algorithm (verified against a known-correct worked example — see
  `tests/bankDetailsValidator.test.js`), a plausible-length check for
  Ghanaian accounts, and account-name format rules. Returns error
  *messages*, not booleans, so `app.js` never has to invent wording.
- **`js/transactionState.js`** — an in-memory module (a plain object
  behind a small API, not attached to any DOM element) holding the
  confirmed exchange and recipient data. `getPayload()` is what a
  future payment-execution stage would read from;
  `getMaskedSummary()` is what any on-screen confirmation should
  render instead of the raw payload.
- **`js/app.js`** — DOM wiring only: which step is visible, which
  fields show as invalid, populating the bank dropdown for the current
  currency. It calls the validator and the transaction-state module;
  it doesn't implement either.

## Validating the account number

**Nigeria (NGN):** a NUBAN is 10 digits, and the CBN specification
defines a real check-digit algorithm — the last digit is computed from
the bank's 3-digit code and the first 9 digits of the account number,
weighted by `[3,7,3,3,7,3,3,7,3,3,7,3]` and reduced mod 10. This
implementation is verified against a documented worked example
(bank code `058` + serial `001656322` → check digit `8`) and correctly
rejects a single mistyped digit, not just a wrong length — see the
"bad checksum" screenshot below, where `0016563220` (one digit off
from a valid NUBAN) is caught even though the length and bank
selection are both correct.

**Ghana (GHS):** there is no equivalent nationwide check-digit
standard — account number length varies by bank (for example, Absa
Ghana issues 7-digit account numbers combined with a separate 3-digit
branch code, while others differ). Validation here is a plausible
length range (7–17 digits, numeric only) rather than a checksum, and
the code and README both say so rather than implying a rigor that
doesn't exist for Ghanaian accounts.

**Both currencies:** this is *format* validation only. Nothing here
confirms the account actually exists or belongs to the name entered —
that would require a real bank-side name-enquiry API (Nigeria's NIBSS
supports this; it's a natural candidate for a later Quest) and is
explicitly out of scope here.

## Recipient currency / country

The recipient's country is derived automatically from the currency
already chosen in Step 1 (NGN → Nigeria, GHS → Ghana) rather than
asked as a second, redundant field — both currencies map to exactly
one country, so asking again would add friction without adding
information. It's still an explicit field in the data model
(`recipient.country` in `transactionState.js`) and shown read-only in
the form, satisfying "recipient currency/country where required"
without asking the user something the app already knows.

## Handling sensitive information

- The account number is shown in full only while the user is actively
  typing it (they need to see it to catch mistakes) or editing a
  previously saved entry. In every other view — the "Recipient details
  saved" confirmation — it's masked to its last 4 digits via
  `PB_BANK_VALIDATOR.maskAccountNumber()`.
- Nothing in the codebase calls `console.log` (or similar) with a raw
  form value or the transaction state. `transactionState.js` provides
  `toSafeLogString()` specifically so any future debugging reaches for
  a redacted string instead of the raw object.
- Recipient data lives in a plain in-memory JS object
  (`transactionState.js`), not `localStorage` or `sessionStorage` — it
  disappears on page reload, the same as if the page were never
  visited, rather than lingering in browser storage on a shared or
  public machine.
- Form fields use `autocomplete="off"` to reduce the chance of the
  browser's own autofill/password-manager layer retaining the account
  number.

## File structure

```
private-bill-quest3/
├── index.html                          Step 1 (exchange) + Step 2 (bank details) markup
├── css/
│   └── style.css                        styling, layered on top of Bootstrap
├── js/
│   ├── config.js                        currencies, minimums, fee %, refresh interval
│   ├── banks.js                         bank lists + currency→country mapping
│   ├── bankDetailsValidator.js          NUBAN checksum + all bank-details validation
│   ├── transactionState.js              in-memory exchange + recipient storage
│   ├── converter.js                     pure ZEC conversion math (Quest 2)
│   ├── rateService.js                   rate-provider orchestration (Quest 2)
│   ├── app.js                           DOM wiring for both steps
│   └── rateProviders/                   CoinGecko / ExchangeRate-API providers (Quest 2)
├── tests/
│   ├── converter.test.js                Quest 2 tests
│   ├── bankDetailsValidator.test.js     NUBAN checksum + validation tests (25 assertions)
│   └── transactionState.test.js         in-memory state tests (8 assertions)
├── vendor/bootstrap/                    Bootstrap 5, vendored locally
├── assets/zec-icon.svg
├── screenshots/
└── README.md                             this file
```

## Testing in isolation

All three logic modules run under plain Node — no browser, no mocking:

```bash
node tests/converter.test.js             # 12 assertions
node tests/bankDetailsValidator.test.js  # 25 assertions
node tests/transactionState.test.js      # 8 assertions
```

45 assertions total, all passing. This is the concrete proof that the
bank-details validation and storage are genuinely separated from the
interface, the same way Quest 2's conversion logic was.

## Running the app

No server or build step needed:

1. Download the `private-bill-quest3` folder.
2. Open `index.html` in any modern browser, desktop or mobile.
3. Enter an amount in Step 1, confirm the preview, then fill in the
   recipient's bank details in Step 2.

To serve it locally instead:

```bash
cd private-bill-quest3
python3 -m http.server 8000
```

## Integrating with the existing (Quest 1/2) work

Step 1's markup, styling, and logic are untouched — the same exchange
card, currency selector, and preview modal from Quest 2. This Quest
only added Step 2 alongside it and wired the preview modal's
previously-disabled "Continue to bank details" button to reveal it.

**Note on the branch this was built from:** as with Quest 2, this
environment has no direct access to the `ZcashGH-Residency01`
repository, so this was built on the most recent deliverable already
on hand rather than by pulling `main` directly. Pull `main`, diff it
against this bundle, and carry forward anything merged since before
opening the PR.

## Git workflow

Submit to `ZcashGH-Residency01` on your **assigned Quest branch** —
never directly to `main`:

```bash
git checkout main
git pull origin main
git checkout -b <your-assigned-quest-3-branch-name>
# copy this Quest's files in, on top of the pulled main
git add .
git commit -m "Quest 3: recipient bank-details stage, with NUBAN validation"
git push origin <your-assigned-quest-3-branch-name>
```

Then open a pull request from that branch into `main` for review.

## Screenshots

| # | File | Shows |
|---|------|-------|
| 1 | `screenshots/01-preview-modal.png` | Exchange preview modal, "Continue to bank details" now enabled |
| 2 | `screenshots/02-bank-form-empty.png` | Step 2, empty form, country auto-derived from currency |
| 3 | `screenshots/03-bank-form-errors.png` | All three fields required, shown at once on empty submit |
| 4 | `screenshots/04-bank-form-bad-checksum.png` | A valid-looking but incorrect NUBAN caught by the real checksum |
| 5 | `screenshots/05-bank-form-saved.png` | Saved confirmation, account number masked to last 4 digits |
| 6 | `screenshots/06-bank-form-edit-prefilled.png` | "Edit details" repopulates the form with the real value |
| 7 | `screenshots/07-back-to-exchange.png` | "Edit amount" returns to Step 1 with the amount preserved |
| 8 | `screenshots/08-ghs-bank-form.png` | Same form for a GHS/Ghana recipient |
| 9 | `screenshots/09-ghs-bank-saved.png` | Saved GHS confirmation, shorter account number masked correctly |

Screenshots were captured with the CoinGecko and ExchangeRate-API
responses mocked at the Playwright layer (documented in Quest 2's
README) since this environment has no outbound access to either
service — those mocked values exist only in the test script.

## Sources used to verify technical information

- Central Bank of Nigeria, *Revised Standards on Nigeria Uniform Bank Account Number (NUBAN) for Banks and Other Financial Institutions* — the official check-digit specification implemented in `bankDetailsValidator.js` — https://www.cbn.gov.ng/out/2020/psmd/revised%20standards%20on%20nigeria%20uniform%20bank%20account%20number%20(nuban)%20for%20banks%20and%20other%20financial%20institutions%20.pdf
- Zifah, *Nigeria-Bank-Account-NUBAN-Algorithm* (GitHub) — a worked NUBAN example used to verify the checksum implementation — https://github.com/Zifah/Nigeria-Bank-Account-NUBAN-Algorithm
- Current Affairs Nigeria, *List of Nigerian Bank Codes* — CBN/NIBSS-sourced 3-digit bank codes used in `banks.js`, reviewed September 2026 — https://currentaffairs.com.ng/bank-codes/
- Absa Bank Ghana, online registration documentation — confirms Ghanaian account numbers vary by bank (Absa uses 7 digits plus a separate branch code) rather than following one nationwide standard — https://online.absa.com.gh/
- Bank of Ghana — list of licensed banks used to compile the Ghanaian bank list in `banks.js` — https://www.bog.gov.gh/

## What I learned

- **A real checksum catches a whole category of mistakes that length
  checks can't.** Before implementing the NUBAN algorithm, "10 digits"
  was the only check available — which would have silently accepted
  `0016563220` as a plausible account number even though it's one
  wrong digit away from a real one. The checksum turns "looks right"
  into "is internally consistent."
- **Not every country has the equivalent of a NUBAN, and pretending
  otherwise would be worse than admitting it.** It would have been
  easy to apply the same checksum-shaped confidence to Ghanaian
  accounts by inventing a plausible-looking rule. Confirming that no
  such nationwide standard exists (and validating GHS accounts more
  loosely, explicitly labeled as such) was more honest than a
  validation rule that implied more rigor than the data supports.
- **"Available to the next stage" needed its own module, not just a
  variable.** It would have been simple to keep the confirmed exchange
  and recipient details in `app.js`'s local `state` object, the same
  place Step 1's in-progress values live. Giving it a separate,
  independently-testable module (`transactionState.js`) is what makes
  "available to the next stage" a checkable claim (see
  `tests/transactionState.test.js`) rather than an assumption about
  how a later Quest's code happens to be structured.

## Difficulties / challenges encountered

- **Verifying the NUBAN algorithm was actually correct**, not just
  plausible-looking. Implemented it, then manually hand-computed a
  worked example from a documented source and confirmed the code
  produced the same check digit, before trusting it enough to reject
  real input on its say-so.
- **An empty card left behind after switching to the confirmation
  view.** The bank-details form is wrapped in a styled card; hiding
  only the `<form>` element inside it (not the card itself) left a
  visible empty rounded rectangle above the "Recipient details saved"
  confirmation. Caught by actually looking at the rendered screenshot
  rather than trusting that "the form is hidden" meant "the card looks
  right" — fixed by giving the wrapping card its own id and hiding
  that instead.
- **Deciding when an account number should be masked versus shown in
  full.** Masking it everywhere, including the live input field,
  would make it impossible for a user to catch their own typo before
  submitting. Showing it in full everywhere, including after it's
  confirmed, would expose it more than necessary on a shared screen or
  screenshot. Splitting the behavior — full value while actively
  editing, masked in any read-only confirmation — matches how most
  real banking UIs handle the same tension.
- **No direct repository access**, same as Quest 2 — handled the same
  way: built from the latest available deliverable, documented above
  that `main` should be pulled and diffed before merging.
