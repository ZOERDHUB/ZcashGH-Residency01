# Private Bill — Quest 4: Transaction Review Stage

Part of **Private Bill**, a Zcash-to-fiat payment platform being built
collaboratively during the ZcashGH Residency. Private Bill lets a
sender fund a payment with ZEC while the recipient receives ordinary
fiat currency — Nigerian Naira (NGN) or Ghanaian Cedi (GHS) — in their
bank account.

**Quest 1** built the exchange interface. **Quest 2** implemented ZEC
conversion. **Quest 3** added the recipient bank-details stage.
**This Quest (Quest 4)** adds the review step between "details
entered" and "order created": a single screen that consolidates
everything confirmed so far, lets the user go back and fix anything
before committing, and gates the actual confirmation behind an
explicit action.

Built with **Bootstrap 5** (vendored locally, not loaded from a CDN),
vanilla JavaScript, and no build step. Steps 1 and 2 are preserved
unchanged; this Quest adds Step 3 alongside them.

## What the review shows

Per the Quest brief, every one of these is on screen at once, with no
scrolling required to find any of them:

- **Fiat currency** (NGN or GHS)
- **Amount the recipient will receive**
- **Required ZEC amount**
- **Recipient bank**
- **Account number** — masked to its last 4 digits, same as the Step 2
  confirmation card, via `PB_BANK_VALIDATOR.maskAccountNumber()`
- **Account name**
- **Rate and fee information** — the effective rate used (1 ZEC in the
  chosen fiat currency) and the service fee, both as a percentage and
  as a ZEC amount

## Returning to correct information

Two explicit "Edit" actions, one per section, each returning to the
step that owns that data rather than trying to make fields editable
in place on the review screen itself:

- **Edit amount** → Step 1, with the previously entered amount and
  currency preserved
- **Edit recipient** → Step 2, pre-filled with the previously saved
  bank, account number, and account name

Both are always available — before confirming and, via "Make changes"
after confirming.

## The confirm/continue action

A single **Confirm & continue** button, gated behind an acknowledgment
checkbox ("I've checked the recipient's bank details and the amounts
above") — the button stays disabled until it's checked, so confirming
requires an explicit, deliberate action rather than a single reflexive
click. Confirming:

- Records a `reviewConfirmedAt` timestamp in `transactionState.js`
- Switches the screen to a "Transaction reviewed and confirmed" card
  with a **Make changes** button (returns to the editable review) and
  a disabled **Create order →** stub, labeled for Quest 5 — actually
  creating an order, generating a ZEC deposit address, and moving
  funds is out of this Quest's scope entirely

**The confirmation cannot go stale.** If the user backs out via Edit
amount or Edit recipient and *actually changes* something,
`transactionState.js` automatically clears the confirmation the moment
`setExchange()` or `setRecipient()` is called again — so returning to
the review always reflects whether the *current* figures were the
ones reviewed, never a leftover confirmation from before an edit. This
is verified directly: `tests/transactionState.test.js` asserts that
editing either piece after confirming flips `isReviewConfirmed()` back
to `false`, and the full round-trip (confirm → edit the amount → save
→ reach the review again → assert unconfirmed) was also exercised
end-to-end in a real browser during development.

## Architecture

The review step adds no new logic module — it doesn't need one. It's
a pure *rendering* of what `transactionState.js` already holds:

```js
const exchange = PB_TRANSACTION.getExchange();
const summary  = PB_TRANSACTION.getMaskedSummary();
// ...populate the DOM with exchange.* and summary.recipient.*
```

`transactionState.js` gained three additions for this Quest:

- **`confirmReview()`** — records the confirmation timestamp; returns
  `false` and does nothing if either exchange or recipient data is
  missing, so a review can't be confirmed with incomplete information
- **`isReviewConfirmed()`** — read the current confirmation state
- **`clearRecipient()`** — removes only the recipient (leaving the
  exchange intact), used when the currency changes to a different
  country after a recipient was already saved for the old one (a
  Nigerian bank account doesn't belong to a GHS payout, and vice
  versa) — this also invalidates any existing review confirmation

## A bug this Quest's flow surfaced and fixed

Reaching Step 2 a *second* time — via Edit amount → change the amount
→ Continue → Continue to bank details again — previously wiped the
already-saved recipient back to a blank form, because
`showBankDetailsStep()` unconditionally reset the form on every entry
rather than checking whether a recipient already existed for the
current currency. This wasn't visible in Quest 3's own testing because
Quest 3 never re-entered Step 2 after already saving a recipient; the
review step's "Edit amount → come back" round trip is what exposed it.
Fixed by checking `PB_TRANSACTION.getRecipient()` on entry and showing
the saved confirmation instead of resetting when the recipient's
country still matches the current currency — otherwise (a currency
change to a different country) the stale recipient is explicitly
cleared via the new `clearRecipient()`.

## File structure

```
private-bill-quest4/
├── index.html                          Steps 1, 2, and 3 markup
├── css/
│   └── style.css                        styling, layered on top of Bootstrap
├── js/
│   ├── config.js                        currencies, minimums, fee %, refresh interval
│   ├── banks.js                         bank lists + currency→country mapping (Quest 3)
│   ├── bankDetailsValidator.js          NUBAN checksum + bank-details validation (Quest 3)
│   ├── transactionState.js              exchange + recipient storage, now with review confirmation
│   ├── converter.js                     pure ZEC conversion math (Quest 2)
│   ├── rateService.js                   rate-provider orchestration (Quest 2)
│   ├── app.js                           DOM wiring for all three steps
│   └── rateProviders/                   CoinGecko / ExchangeRate-API providers (Quest 2)
├── tests/
│   ├── converter.test.js                12 assertions
│   ├── bankDetailsValidator.test.js     25 assertions
│   └── transactionState.test.js         15 assertions, including review-confirmation logic
├── vendor/bootstrap/                    Bootstrap 5, vendored locally
├── assets/zec-icon.svg
├── screenshots/
└── README.md                             this file
```

## Testing in isolation

```bash
node tests/converter.test.js             # 12 assertions
node tests/bankDetailsValidator.test.js  # 25 assertions
node tests/transactionState.test.js      # 15 assertions
```

52 assertions total, all passing, all plain Node — no browser.

## Running the app

No server or build step needed:

1. Download the `private-bill-quest4` folder.
2. Open `index.html` in any modern browser, desktop or mobile.
3. Complete Step 1 (amount), Step 2 (bank details), then review and
   confirm in Step 3.

To serve it locally instead:

```bash
cd private-bill-quest4
python3 -m http.server 8000
```

## Integrating with the existing (Quest 1–3) work

Steps 1 and 2's markup, styling, and logic are unchanged from Quest 3.
This Quest added Step 3 alongside them and:

- Enabled and relabeled Step 2's previously-disabled forward button
  from "Continue to ZEC payment →" to the now-functional
  "Review transaction →"
- Updated the Step 1 preview modal's forward-reference text, which
  previously (incorrectly, after Quest 3 shipped) pointed at "Quest 4"
  for the payment step — it now correctly describes the review step
  landing in this Quest and points the actual payment step at Quest 5

**Note on the branch this was built from:** as with prior Quests, this
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
git checkout -b <your-assigned-quest-4-branch-name>
# copy this Quest's files in, on top of the pulled main
git add .
git commit -m "Quest 4: transaction review stage with confirm gate"
git push origin <your-assigned-quest-4-branch-name>
```

Then open a pull request from that branch into `main` for review.

## Screenshots

| # | File | Shows |
|---|------|-------|
| 1 | `screenshots/01-step2-saved.png` | Step 2's saved-recipient card, "Review transaction →" now enabled |
| 2 | `screenshots/02-review-unconfirmed.png` | Step 3, every required field visible: currency, amount, ZEC, rate, fee, bank, masked account number, account name |
| 3 | `screenshots/03-review-checkbox-checked.png` | Acknowledgment checkbox checked, Confirm button now enabled |
| 4 | `screenshots/04-review-confirmed.png` | Confirmed state, with the disabled Quest-5 "Create order" stub |
| 5 | `screenshots/05-review-unconfirmed-again.png` | "Make changes" returns to the unconfirmed, unchecked state |
| 6 | `screenshots/06-back-to-step1-from-review.png` | "Edit amount" from the review returns to Step 1 with data preserved |
| 7 | `screenshots/07-after-amount-change-step2.png` | Bug fix in action: after actually changing the amount, Step 2 correctly still shows the previously saved recipient instead of a wiped form |
| 8 | `screenshots/08-review-after-amount-change.png` | The review after that real change, correctly showing unconfirmed with updated figures — not a stale confirmation |

Screenshots were captured with the CoinGecko and ExchangeRate-API
responses mocked at the Playwright layer (documented in Quest 2's
README), since this environment has no outbound access to either
service.

## Sources used to verify technical information

No new external technical sources were needed for this Quest — it
consumes exchange and recipient data already validated in Quests 2
and 3 (see those Quests' READMEs for the CoinGecko, ExchangeRate-API,
CBN NUBAN, and Bank of Ghana sources behind that data) rather than
introducing new domain facts of its own.

## What I learned

- **A review screen is a consumer of state, not a new source of it.**
  It was tempting to duplicate some of Step 1/2's formatting logic
  directly in the review's rendering code; instead, reusing the exact
  same `formatFiat`/`formatZec` helpers and reading only from
  `transactionState.js` meant the review can never show a number that
  disagrees with what Steps 1 and 2 actually captured.
- **"Return and correct before confirming" implies the confirmation
  has to be revocable by data, not just by button.** A checkbox that
  resets on re-entry handles the user *deciding* to make changes; the
  auto-unconfirm in `transactionState.js` handles the case where they
  *actually* change something after confirming and then land back on
  the review a different way (e.g., through Step 2's own "Continue"
  button rather than the review's "Edit" links). Both paths needed to
  produce the same correct "unconfirmed" state.
- **Re-entering an earlier step in a multi-step flow is exactly the
  scenario that finds bugs single-pass testing won't.** Every prior
  Quest's testing moved forward through the steps once. This Quest's
  "review, then edit, then come back" flow is what actually exercised
  a second visit to Step 2 — and that's precisely where a real bug
  (the wiped recipient form) had been hiding since Quest 3.

## Difficulties / challenges encountered

- **The wiped-recipient bug**, described above — caught by testing the
  actual round-trip a user described in the Quest brief ("return and
  correct information before confirming"), not by re-testing Quest 3's
  original single-pass flow, which never surfaced it.
- **Deciding what invalidates a confirmation versus what doesn't.**
  Clicking "Make changes" needed to *not* silently discard the
  confirmation timestamp the instant it's clicked — only an actual
  edit (a real call to `setExchange`/`setRecipient`/`clearRecipient`)
  should do that. Otherwise clicking "Make changes" and then
  immediately re-confirming without changing anything would look like
  the button did nothing, or worse, feel like confirming twice was
  somehow different from confirming once.
- **Currency changing after a recipient was already saved.** Nothing
  in Quest 3 needed to consider what happens to a saved Nigerian bank
  account if the user later switches the exchange currency to GHS.
  Left alone, Step 2 would show a Naira bank recap alongside a "Ghana
  (GHS)" country chip — silently inconsistent data. `clearRecipient()`
  exists specifically to close that gap the moment it was noticed
  while designing the review step's need for internally consistent
  data.
