# Private Bill — Quest 5: Order-Management Foundation

Part of **Private Bill**, a Zcash-to-fiat payment platform being built
collaboratively during the ZcashGH Residency. Private Bill lets a
sender fund a payment with ZEC while the recipient receives ordinary
fiat currency — Nigerian Naira (NGN) or Ghanaian Cedi (GHS) — in their
bank account.

**Quest 1** built the exchange interface. **Quest 2** implemented ZEC
conversion. **Quest 3** added recipient bank details. **Quest 4** added
the review-and-confirm stage. **This Quest (Quest 5)** is the moment
those all lead to: confirming the review now creates a real, trackable
**order** — a persistent record with its own ID, status, and lifecycle
rather than just a "confirmed" flag on a draft.

Built with **Bootstrap 5** (vendored locally, not loaded from a CDN),
vanilla JavaScript, and no build step. Steps 1–4 are preserved
unchanged; this Quest wires order creation into Step 4's existing
confirm action rather than adding a new step.

## What an order contains

Every order created by `PB_ORDER_STORE.createOrder()` carries:

| Field | Example | Requirement |
|---|---|---|
| `id` | `PB-A82B0D19` | Unique identifier |
| `currencyCode` | `NGN` | Fiat currency |
| `fiatAmount` | `150000` | Fiat amount |
| `zecAmount` | `0.09398148` | Required ZEC amount |
| `recipient` | `{ bankName, accountNumber, accountName, country }` | Recipient payment information |
| `status` | `AWAITING_ZEC` | Transaction status |
| `createdAt` | `Date` | Creation time |
| `expiresAt` | `Date` | Expiration information |
| `effectiveRate`, `feeZec` | — | Rate/fee context, carried forward for the record |

## Unique identifiers

`generateOrderId()` uses `crypto.randomUUID()` where available (every
modern browser) for genuine collision-resistant uniqueness, taking its
first segment and prefixing it for readability: `PB-A82B0D19`. In an
environment without `crypto.randomUUID` (this file's own Node test
run, or a very old browser), it falls back to a timestamp-plus-random
scheme. Uniqueness is verified directly: `tests/orderStore.test.js`
generates many IDs in a loop and asserts none collide.

## Initial state and status lifecycle

New orders begin in **`AWAITING_ZEC`**, exactly as specified. The full
status set is defined up front — including states this Quest doesn't
use yet (`ZEC_RECEIVED`, `PROCESSING_PAYOUT`, `COMPLETED`) — so a later
Quest implementing the actual ZEC payment step has a status to
transition into rather than needing to redesign the enum. `updateStatus()`
refuses to change an order once it's in a **terminal** state
(`COMPLETED`, `EXPIRED`, `CANCELLED`) — a completed or cancelled order
can never be silently reopened.

```
AWAITING_ZEC ──► ZEC_RECEIVED ──► PROCESSING_PAYOUT ──► COMPLETED
     │
     ├──► EXPIRED     (rate lock elapsed unpaid)
     └──► CANCELLED   (user made changes before paying)
```

## Expiration

Orders expire **10 minutes** after creation (`PB_CONFIG.orderExpiryMs`)
— chosen to match [ff.io](https://ff.io/)'s own published fixed-rate
lock window, the same reference this project has followed for the
exchange-widget pattern since Quest 1. `expireIfDue()` checks a given
order against the current time and transitions it to `EXPIRED` if
due — called on every tick of the review screen's live countdown, so
an order that expires while the user is simply looking at the screen
transitions for real, not just cosmetically. A dedicated banner
appears with a **Start over** action that fully resets the flow.

## "Persistent," honestly scoped

The Quest asks for a "persistent transaction/order that can be
identified and tracked throughout the remaining payment process."
Orders here live in an in-memory `Map`, not `localStorage` or
`sessionStorage` — deliberately, for two separate reasons:

1. An order carries the same recipient bank account number that
   `transactionState.js` (Quest 3) already avoids writing to
   persistent browser storage, for the same shared/public-machine
   concern documented there.
2. A *genuinely* persistent, trackable order — one that survives a
   closed tab, a different device, or a crashed browser — needs a
   server-side database and an authoritative backend, not a
   client-side cache pretending to be one. Simulating durability with
   `localStorage` here would look more production-ready than it
   actually is, without solving the real problem (an order backend a
   future Quest would need regardless).

What this module provides instead is the exact **interface** a real
backend-backed store would expose — `createOrder` / `getOrder` /
`updateStatus` / expiry checks — so wiring it to an actual API later
is a matter of reimplementing these functions against real HTTP calls.
Nothing that reads from `PB_ORDER_STORE` elsewhere in the app would
need to change.

## Order lifecycle in the UI

- **Confirming the review** (Step 4's existing "Confirm & create
  order" button) is the one moment an order is created — directly
  satisfying "when a user confirms the transaction information, the
  system must create a persistent order."
- **"Make changes"** on an active order explicitly cancels it
  (`CANCELLED`) before returning to the editable review — its label
  says so, and it means it.
- **Editing the amount or recipient** from the review (Step 4's own
  Edit buttons) also cancels any active order first, for the same
  reason: an order's figures are meant to be fixed once created, so a
  user who's actually changing something needs a fresh order, not a
  mutated stale one.
- **Re-confirming after a cancellation** creates a genuinely new order
  with a new ID — verified end-to-end (two different order IDs, the
  first left in `CANCELLED` status, never reused).

## Architecture

```
config.js (orderExpiryMs)  →  orderStore.js  →  app.js (DOM only)
```

`orderStore.js` is a pure module: no DOM access, no dependency on
`transactionState.js`'s internals beyond the plain payload shape
`getPayload()` already returns. `app.js` calls `createOrder`,
`updateStatus`, and `expireIfDue`; it renders whatever they return and
owns no order logic itself — the same separation-of-concerns pattern
as `converter.js` (Quest 2) and `bankDetailsValidator.js` (Quest 3).

## Two bugs found and fixed while wiring this up

1. **`config.js` had no Node export.** Every other logic module
   (`converter.js`, `banks.js`, `bankDetailsValidator.js`,
   `transactionState.js`, `rateService.js`) already had the
   `module.exports` guard needed for its own tests to `require()` it
   under Node — `config.js` never needed one before, since it was only
   consumed as a browser global. `orderStore.js`'s tests were the
   first to need `PB_CONFIG.orderExpiryMs` directly from Node, and
   immediately failed with `Cannot read properties of undefined`
   until the export was added.
2. **A `var` hoisting collision that only broke the browser, not
   Node.** `orderStore.js`'s Node-compatibility guard originally read
   `var { PB_CONFIG } = require("./config.js")` inside an
   `if (typeof module !== "undefined" ...)` block. `var` declarations
   hoist to the top of their script regardless of whether that branch
   ever runs — so in the browser, where the condition is false and the
   `require` call itself never executes, the mere *presence* of
   `var PB_CONFIG` still collided with `config.js`'s
   `const PB_CONFIG` in the shared top-level scope, throwing
   `Identifier 'PB_CONFIG' has already been declared` and silently
   breaking order creation entirely. All Node tests passed the whole
   time — this only showed up when actually running the app in a
   browser. Fixed by assigning to `global.PB_CONFIG` instead of
   declaring a new binding, which sidesteps hoisting entirely. (The
   equivalent pattern in `bankDetailsValidator.js`, for `pbFindBank`,
   was checked and confirmed safe — `banks.js` declares it with
   `function`, not `const`, and function declarations are
   hoisting-compatible with `var` redeclaration.)

## File structure

```
private-bill-quest5/
├── index.html                          Steps 1–4 markup, now including order display
├── css/style.css
├── js/
│   ├── config.js                        + orderExpiryMs, + Node export (this Quest)
│   ├── orderStore.js                    NEW — order creation, status, expiry
│   ├── banks.js / bankDetailsValidator.js / transactionState.js   (Quest 3/4)
│   ├── converter.js / rateService.js / rateProviders/              (Quest 2)
│   └── app.js                           DOM wiring for all steps + order display
├── tests/
│   ├── converter.test.js                12 assertions
│   ├── bankDetailsValidator.test.js     25 assertions
│   ├── transactionState.test.js         15 assertions
│   └── orderStore.test.js               NEW — 23 assertions
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
node tests/orderStore.test.js            # 23 assertions
```

75 assertions total, all passing, all plain Node — no browser.
`orderStore.test.js` covers order creation (including the two payload-
completeness guards), unique-ID generation, status transitions
(including the terminal-state guard), and expiry logic using an
injectable `now` parameter — so expiry is tested by passing a future
timestamp, not by actually waiting.

## Running the app

No server or build step needed:

1. Download the `private-bill-quest5` folder.
2. Open `index.html` in any modern browser, desktop or mobile.
3. Complete Steps 1–3, then confirm the review in Step 4 to create an
   order and watch its live countdown.

To serve it locally instead:

```bash
cd private-bill-quest5
python3 -m http.server 8000
```

## Integrating with the existing (Quest 1–4) work

Steps 1–3's markup and logic are unchanged. Step 4's confirm button
and confirmed-state card were extended (not replaced) to create and
display a real order instead of a generic confirmation message, and
its forward-reference text now correctly points the actual ZEC-payment
step at Quest 6.

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
git checkout -b <your-assigned-quest-5-branch-name>
# copy this Quest's files in, on top of the pulled main
git add .
git commit -m "Quest 5: order-management foundation (create/status/expiry)"
git push origin <your-assigned-quest-5-branch-name>
```

Then open a pull request from that branch into `main` for review.

## Screenshots

| # | File | Shows |
|---|------|-------|
| 1 | `screenshots/01-order-created.png` | Order just created: ID, `AWAITING_ZEC` badge, created/expiry times, countdown |
| 2 | `screenshots/02-order-countdown-ticking.png` | Countdown genuinely ticking (9:59 → 9:57 across ~2 seconds) |
| 3 | `screenshots/03-after-make-changes.png` | "Make changes" clicked — order cancelled, back to the unconfirmed checkbox state |
| 4 | `screenshots/04-second-order-created.png` | Re-confirming creates a distinct new order ID |
| 5 | `screenshots/05-order-expired.png` | An order's rate lock expiring live, with the "Start over" recovery banner |
| 6 | `screenshots/06-after-start-over.png` | "Start over" fully resets back to a clean Step 1 |

Screenshots 1–4 and 6 used the CoinGecko/ExchangeRate-API mocking
approach documented in Quest 2's README. Screenshot 5 additionally
shrank `PB_CONFIG.orderExpiryMs` to a few seconds for that single test
run only (via `page.evaluate`, not a code change) so the real 10-minute
expiry could be observed without an actual 10-minute wait.

## Sources used to verify technical information

- FixedFloat (ff.io) FAQ — the published fixed-rate lock duration this
  Quest's `orderExpiryMs` value follows, consistent with the UI
  reference used since Quest 1 — https://ff.io/
- MDN, *`crypto.randomUUID()`* — browser support and behavior for the
  primary order-ID generation path — https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
- MDN, *`var` hoisting* — confirms the hoisting behavior behind the
  `PB_CONFIG` collision bug fixed in this Quest — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var

## What I learned

- **A test suite passing under Node doesn't mean the code works in a
  browser, and vice versa.** Every `orderStore.test.js` assertion
  passed on the first try in Node — the `var`/`const` collision only
  exists because a browser loads multiple `<script>` tags into one
  shared top-level scope, a constraint Node's `require()`-based module
  system doesn't have. Passing tests were necessary but not sufficient
  proof of correctness here; the actual Playwright run against a real
  page is what caught it.
- **"Persistent" is a word worth pinning down before writing code
  against it**, the same way "avoid hard-coded rates" was in Quest 2.
  Treating it as "must survive a page reload" would have meant
  `sessionStorage`, which would have quietly reopened the exact
  sensitive-data concern Quest 3 closed. Treating it as "an
  addressable, ID-keyed record with a defined lifecycle, as opposed to
  a loose variable" let this Quest satisfy the actual intent (an order
  that can be "identified and tracked") without contradicting a
  decision already made for good reason two Quests ago.
- **A status enum is worth designing for the states you don't need
  yet.** `AWAITING_ZEC` is the only status this Quest's flow ever
  reaches, but defining `ZEC_RECEIVED`, `PROCESSING_PAYOUT`, and
  `COMPLETED` now — along with the terminal-state guard — means
  whichever Quest implements the actual payment step extends an
  existing lifecycle instead of inventing one under time pressure.

## Difficulties / challenges encountered

- **The `var`-hoisting bug**, described in detail above — the single
  hardest issue this Quest surfaced, precisely because every automated
  test passed while the actual application was completely broken.
  Resolved by not trusting "tests pass" as sufficient and running the
  real Playwright flow, which failed immediately and pointed at the
  exact line.
- **Deciding what "cancels this order" should actually cancel.** It
  was tempting to make "Make changes" just hide the order card without
  touching its status, since nothing downstream reads cancelled orders
  yet. Actually transitioning it to `CANCELLED` — even though no
  current code checks for that status — was worth doing anyway,
  because the alternative (an order silently abandoned in
  `AWAITING_ZEC` forever) is exactly the kind of orphaned state a
  later Quest's "track orders awaiting ZEC" view would need to filter
  out by hand.
- **No direct repository access**, the same as every prior Quest —
  handled the same way: built from the latest available deliverable,
  documented above that `main` should be pulled and diffed before
  merging.
