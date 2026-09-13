# Private Bill — Quest 6: The ZEC Payment Stage

Part of **Private Bill**, a Zcash-to-fiat payment platform being built
collaboratively during the ZcashGH Residency. Private Bill lets a
sender fund a payment with ZEC while the recipient receives ordinary
fiat currency — Nigerian Naira (NGN) or Ghanaian Cedi (GHS) — in their
bank account.

**Quest 1** built the exchange interface. **Quest 2** implemented ZEC
conversion. **Quest 3** added recipient bank details. **Quest 4** added
the review-and-confirm stage. **Quest 5** turned a confirmed review
into a persistent, trackable order. **This Quest (Quest 6)** is what
an order is actually *for*: showing the user exactly where and how
much ZEC to send to fund it.

Built with **Bootstrap 5** (vendored locally, not loaded from a CDN),
vanilla JavaScript, and no build step. Steps 1–3 are unchanged; Quest
5's order-confirmation card gained a real, working "Proceed to ZEC
payment" button leading to this Quest's new Step 4.

## What the payment screen shows

Per the Quest brief, all six requirements are on screen together:

- **Required ZEC amount** — large, monospace, with its own Copy button
- **ZEC receiving address** — the order's own demo deposit address,
  with its own Copy button
- **Copy-address functionality** — both Copy buttons use the real
  Clipboard API (`navigator.clipboard.writeText`), with a fallback for
  contexts where it's unavailable, and visible "Copied!" feedback
- **Order/transaction ID** — shown prominently, and again inline in
  the instructions ("keep this order's ID for your records")
- **Current transaction status** — the same status badge component
  used in Step 3, so its color and label conventions are consistent
  across the whole app
- **Clear instructions** — a numbered list: copy the address, send
  *exactly* the required amount, keep the order ID, and an honest note
  that automatic payment detection isn't built yet (that's Quest 7)

## ⚠️ The deposit address is not real

This matters enough to repeat in three places: this README, a
prominent red banner at the top of the payment screen itself, and the
doc comment in `depositAddress.js`. **Nothing in this prototype talks
to a Zcash node, a wallet, or any key-management system.**
`depositAddress.js` produces a string that looks like a Sapling
shielded address (`zs1…`, roughly the right length, drawn from the
real bech32 character set) purely so this screen has something
realistic to display. It is **not** validated bech32, is not derived
from any real key, and cannot receive funds. Sending real ZEC to it
would send those funds nowhere recoverable. A real implementation
would request an address from an actual node or wallet — see
`depositAddress.js`'s doc comment for exactly what would need to
change, and nothing else.

## The address "corresponds to the correct transaction"

This was the Quest's explicit data-integrity requirement, and it's
enforced structurally, not just by convention:

1. **Generated once, at order creation, in `orderStore.js`** —
   `createOrder()` calls `PB_DEPOSIT_ADDRESS.generateDepositAddress(id)`
   itself and stores the result permanently on the order record. The
   address is never regenerated, recomputed, or looked up separately
   by the UI.
2. **Deterministic per order ID** — `generateDepositAddress(orderId)`
   is a pure function (FNV-1a hash → mulberry32 PRNG, both seeded only
   by the order's own ID). The same order always yields the same
   address on every read; different orders yield different addresses
   (verified for 2,000 distinct IDs with zero collisions in
   `tests/depositAddress.test.js`).
3. **One render function, one order object** — `renderOrder(order)` in
   `app.js` populates *both* Step 3's order summary and Step 4's
   payment screen from the exact same order object in the same call.
   There's no code path where the two screens could read from
   different sources and disagree.
4. **Verified end-to-end**, not just asserted: a live browser test
   confirmed the payment screen's displayed order ID and address match
   `PB_ORDER_STORE`'s own record for that order, and that starting a
   second order after cancelling the first produces a genuinely
   different ID and a genuinely different address.

## Architecture

```
depositAddress.js  →  orderStore.js  →  app.js (DOM only)
(pure, seeded)         (attaches once)    (renders + copy handling)
```

`depositAddress.js` has no knowledge of orders, currencies, or the
UI — it's a one-function module (order ID in, address string out).
`orderStore.js` is the only thing that calls it, and only at creation
time. `app.js` never calls it at all; it only ever reads
`order.depositAddress` from whatever `PB_ORDER_STORE` hands back. This
is the same separation pattern as `converter.js` (Quest 2) and
`bankDetailsValidator.js` (Quest 3): the piece most likely to change
later (a real address source) is isolated behind the smallest possible
interface.

## Copy-to-clipboard implementation

`copyElementText()` in `app.js` is a single function shared by both
Copy buttons (`data-copy-target` on each button points at the element
whose text to copy). It tries `navigator.clipboard.writeText()` first;
if that API is unavailable (an older browser, or a non-HTTPS context
where browsers restrict it), it falls back to creating an off-screen
`<textarea>`, selecting its contents, and calling the older
`document.execCommand("copy")`. Verified in a real browser with
clipboard permissions granted: both buttons write the exact displayed
text, and `navigator.clipboard.readText()` confirms it after the
click, not just that no error was thrown.

## File structure

```
private-bill-quest6/
├── index.html                          Steps 1–4 markup, Step 4 new
├── css/style.css
├── js/
│   ├── config.js
│   ├── depositAddress.js                NEW — demo address generation
│   ├── orderStore.js                    + depositAddress attached at creation (this Quest)
│   ├── banks.js / bankDetailsValidator.js / transactionState.js   (Quest 3/4)
│   ├── converter.js / rateService.js / rateProviders/              (Quest 2)
│   └── app.js                           + Step 4 rendering, copy handling, cancel/expiry
├── tests/
│   ├── converter.test.js                12 assertions
│   ├── bankDetailsValidator.test.js     25 assertions
│   ├── transactionState.test.js         15 assertions
│   ├── orderStore.test.js               25 assertions (+2 for depositAddress, this Quest)
│   └── depositAddress.test.js           NEW — 7 assertions
├── vendor/bootstrap/
├── assets/zec-icon.svg
├── screenshots/
└── README.md
```

## Testing in isolation

```bash
node tests/converter.test.js             # 12 assertions
node tests/bankDetailsValidator.test.js  # 25 assertions
node tests/transactionState.test.js      # 15 assertions
node tests/orderStore.test.js            # 25 assertions
node tests/depositAddress.test.js        # 7 assertions
```

84 assertions total, all passing, all plain Node — no browser needed.
`depositAddress.test.js` specifically covers format (prefix, length,
bech32-only characters), determinism (same ID in → same address out),
and uniqueness (2,000 distinct IDs, zero collisions).

## Running the app

No server or build step needed:

1. Download the `private-bill-quest6` folder.
2. Open `index.html` in any modern browser, desktop or mobile.
3. Complete Steps 1–3 through to a confirmed order, then click
   **Proceed to ZEC payment** to reach this Quest's new screen.

To serve it locally instead:

```bash
cd private-bill-quest6
python3 -m http.server 8000
```

## Integrating with the existing (Quest 1–5) work

Steps 1–3's markup and logic are unchanged. Quest 5's previously
disabled "Proceed to ZEC payment →" stub button is now enabled and
functional, leading to this Quest's new Step 4. The Step 1 preview
modal's forward-reference text was also corrected — it previously
(from Quest 5) pointed "the actual ZEC payment step" at "Quest 6";
since that's now built, the reference points Quest 7 at the next real
gap instead (automatic on-chain payment detection).

**Note on the branch this was built from:** as with every prior Quest,
this environment has no direct access to the `ZcashGH-Residency01`
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
git checkout -b <your-assigned-quest-6-branch-name>
# copy this Quest's files in, on top of the pulled main
git add .
git commit -m "Quest 6: ZEC payment screen (address, amount, copy, instructions)"
git push origin <your-assigned-quest-6-branch-name>
```

Then open a pull request from that branch into `main` for review.

## Screenshots

| # | File | Shows |
|---|------|-------|
| 1 | `screenshots/01-payment-screen.png` | Full payment screen: warning banner, order ID, status, ZEC amount, address, countdown, instructions |
| 2 | `screenshots/02-copied-zec-amount.png` | "Copied!" feedback after copying the ZEC amount |
| 3 | `screenshots/03-copied-address.png` | "Copied!" feedback after copying the address |
| 4 | `screenshots/04-after-cancel-from-payment.png` | "Cancel this order" returns to an unconfirmed review |
| 5 | `screenshots/05-payment-screen-expired.png` | Order expiring while the user is on the payment screen itself |

Screenshots were captured with the CoinGecko/ExchangeRate-API mocking
approach documented in Quest 2's README, and with browser clipboard
permissions explicitly granted so the Copy buttons could be tested
against the real Clipboard API rather than just checking for a thrown
error. Screenshot 5 additionally shrank `PB_CONFIG.orderExpiryMs` to a
few seconds for that single test run only, the same technique used in
Quest 5.

## Sources used to verify technical information

- MDN, *Clipboard: writeText() method* — the primary copy
  implementation and its browser-support/context caveats (HTTPS,
  permissions) — https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
- MDN, *Document: execCommand() method* — the fallback copy path for
  contexts without Clipboard API access — https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
- Zcash Documentation, *Addresses and Value Pools* — Sapling address
  format and approximate length, referenced in Quest 1 and reused here
  for the demo address's shape — https://zcash.readthedocs.io/en/master/rtd_pages/addresses.html

## What I learned

- **A believable placeholder still needs a loud disclaimer, not a
  quiet one.** It would be easy to bury "this address isn't real" in
  the README alone and let the UI look convincing on its own. Payment
  screens are exactly where a convincing-looking fake causes real
  harm, so the warning had to be the first thing on the screen, not an
  afterthought — visible without scrolling, styled as an alert, not
  gray disclaimer text.
- **"Corresponds to the correct transaction" is best enforced by
  removing the opportunity to disagree, not by careful bookkeeping.**
  It would have been possible to have Step 3 and Step 4 each fetch and
  format the order independently and simply be careful to keep them in
  sync. Routing both through one `renderOrder(order)` call instead
  means there's no second code path to drift out of sync in the first
  place.
- **Determinism is what makes a fake address trustworthy *as a
  fake*.** A randomly-regenerated address on every screen visit would
  have been a subtler, more confusing failure than an obviously static
  one — a user copying the address twice and getting different values
  would reasonably assume something was broken. Seeding the generator
  from the order's own ID means "revisit the same order, see the same
  address" holds even though nothing is actually being persisted to a
  real address registry.

## Difficulties / challenges encountered

- **Testing clipboard behavior for real, not just for lack of an
  error.** A copy button that silently does nothing still "passes" a
  test that only checks whether an exception was thrown. Granting
  clipboard permissions in the Playwright browser context and calling
  `navigator.clipboard.readText()` afterward to check the actual
  content was necessary to catch that class of bug, not just assume
  the happy path worked.
- **Deciding what "cancel" from the payment screen should return to.**
  Returning all the way to Step 1 would have discarded a still-valid
  amount and recipient just because the user wanted a fresh order.
  Returning to Step 3's *unconfirmed* review — preserving the entered
  data but requiring a fresh, deliberate re-confirmation (and thus a
  fresh order) — matched the cancellation semantics Quest 5 already
  established for "Make changes," so this Quest reused that pattern
  rather than inventing a third one.
- **No direct repository access**, the same as every prior Quest —
  handled the same way: built from the latest available deliverable,
  documented above that `main` should be pulled and diffed before
  merging.
