# Build My Crypto

ZEC-to-fiat off-ramp — built for the Zcash Privacy Developers Residency.

## Setup

```bash
npm install
npm start        # runs the server on http://localhost:3000
npm test         # runs the automated test suite
```

## Implemented so far

### Quest 08 — Transaction Status Engine (`models/transactionStatusEngine.js`)

A dependency-free state machine that tracks each transaction through its
lifecycle:

```
CREATED → AWAITING_ZEC → ZEC_DETECTED → CONFIRMING → ZEC_CONFIRMED
        → PAYOUT_PROCESSING → FIAT_SENT → COMPLETED
```

Plus exception states: `EXPIRED`, `UNDERPAID`, `OVERPAID`, `PAYOUT_FAILED`,
`CANCELLED`.

- Every transaction's status, full history, and per-status timestamps are
  stored (in-memory for now — see "Known limitations" below).
- Invalid transitions (e.g. jumping straight from `CREATED` to `COMPLETED`)
  are rejected with an `InvalidTransitionError`.
- Terminal states (`COMPLETED`, `EXPIRED`, `CANCELLED`) can never transition
  further.
- 7 automated tests cover creation, valid/invalid transitions, terminal-state
  enforcement, unknown-id handling, and the full happy-path lifecycle.

Exposed over HTTP via `routes/transactions.js`:

| Method | Path                              | Purpose                                    |
|--------|-----------------------------------|---------------------------------------------|
| POST   | `/api/transactions`               | Create a transaction (stand-in for Quests 01-05 order creation) |
| GET    | `/api/transactions`               | List transactions (optional `?status=`)    |
| GET    | `/api/transactions/:id`           | Get one transaction's current state        |
| GET    | `/api/transactions/:id/history`   | Get status history (for the progress UI, Quest 10) |
| POST   | `/api/transactions/:id/transition`| Manually drive a transition (temporary — see note in the route file) |

### Quest 02 — ZEC Conversion (`services/exchangeService.js`)

Converts a fiat amount into the ZEC the user needs to send.

- **NGN**: CoinGecko quotes ZEC in NGN directly.
- **GHS**: CoinGecko doesn't support GHS as a quote currency, so this goes
  ZEC → USD (CoinGecko) → GHS (via `services/forexRateProvider.js`, using
  the free open.er-api.com forex API). The two-hop logic is invisible to
  everything else — callers just get a ZEC amount either way.
- Rates are cached for 60 seconds (`services/rateCache.js`) to avoid
  hammering the external APIs.
- If a live fetch fails, a stale cached rate is used instead (clearly
  labeled `source: 'stale-cache'` in the response) rather than breaking the
  flow. Only throws `RateUnavailableError` if there's genuinely no rate to
  fall back on.
- No hardcoded rates in the real code path. There's an opt-in
  `USE_MOCK_RATES=true` environment variable for offline dev/demo use,
  clearly separated and never active unless explicitly set.
- 7 automated tests cover the NGN path, the GHS two-hop path, caching,
  the stale-cache fallback, and error cases — all using a mocked `fetch`
  so the suite runs offline.

Exposed via `routes/exchange.js`:

| Method | Path                          | Purpose                                  |
|--------|-------------------------------|-------------------------------------------|
| GET    | `/api/exchange/rate/:currency`| Current ZEC price in NGN or GHS           |
| POST   | `/api/exchange/convert`       | `{ amount, currency }` → ZEC amount to pay|

On the frontend, `public/js/exchange.js` (Quest 01) and
`public/js/conversion.js` (Quest 02) are deliberately split: exchange.js
only knows about currency/amount selection and fires a
`privatebill:fiat-input-changed` event; conversion.js listens for that,
debounces, calls the API, and owns the "You send" box, rate line, and the
Continue button (which only enables once a real quote exists).

### Quest 03 — Recipient Bank Details Form (`public/bank-details.html` + `public/js/bank-details.js`)

Collects the recipient's bank, account number, and account name.

- Bank list is currency-specific (different bank lists for NGN vs GHS).
- Account number validation is format-only (not a live bank-verification
  lookup, which would be a reasonable future upgrade but is out of scope
  here): NGN requires exactly 10 digits (Nigeria's NUBAN standard), GHS
  allows 8-17 digits since Ghanaian banks don't share one fixed length.
- Account name must look like a real name (letters, spaces, apostrophes,
  hyphens).
- Redirects back to the exchange screen if the user lands here without an
  amount/currency/ZEC quote already chosen — this stage can't function on
  its own.
- The entered details are saved into the same shared draft
  (`PrivateBillState`) as the earlier steps, so Quest 04 (review) can read
  them. Nothing here is sent to the server yet — that starts with Quest 05
  (order creation) — so there's nothing to log in the first place.

### Quest 04 — Transaction Review (`public/review.html` + `public/js/review.js`)

Shows everything gathered so far — fiat amount, ZEC amount, rate, bank,
account number, account name — for a final check before confirming.

- Account number is masked by default (`01••••••89`) with a Show/Hide
  toggle, so the full number isn't sitting on-screen by default. It's
  purely a display choice — the real value is still in the draft and is
  used as-is once an order is created.
- Each section has an "Edit" link back to the step where that data was
  entered (Quest 01 for payment, Quest 03 for recipient), rather than
  allowing edits inline here — keeps this page a pure review step.
- Fees are described honestly: since no separate fee structure has been
  built anywhere else in the project, this says so plainly rather than
  inventing a number. The exchange rate already shown is the only cost.
- "Confirm and continue" currently moves on to where Quest 05 (order
  creation) will live — it doesn't create a real order yet, since that's
  Quest 05's job specifically.

### Quest 05 — Create Transaction Orders (`services/orderService.js` + `public/order.html`)

This is where the flow stops being "just a form" and becomes a real
order. See "How it all connects" below for the full picture.

- `orderService.createOrder()` validates the payment + recipient data,
  attaches a 30-minute expiration, creates the order via the Quest 08
  status engine, and immediately transitions it from `CREATED` to
  `AWAITING_ZEC` (since by this point the user has already picked an
  amount and a recipient — there's nothing left to wait on except payment).
- `routes/transactions.js`'s `POST /api/transactions` now uses this
  instead of calling the engine directly, so a malformed request is
  rejected with a clear 400 rather than silently creating a broken order.
- `public/order.html` + `order.js` is the first page in the whole flow
  that talks to the server about the *order itself* (Quest 02 talked to
  the server too, but only for a rate quote, not to persist anything).
  It POSTs the draft, shows the resulting order ID/status/expiry, and
  clears the local draft once the server confirms it's saved.
- 5 more automated tests cover: the CREATED→AWAITING_ZEC transition,
  required fields being stored, the expiration window, rejected incomplete
  input, and fetching the order back by id.

## How it all connects

It's easy to lose track of how six separate quests fit together, so here's
the actual chain of custody for one payment, start to finish:

1. **Quest 01** (`index.html` / `exchange.js`) — user picks NGN/GHS and
   types an amount. Saved into `PrivateBillState` (localStorage only).
2. **Quest 02** (`conversion.js` → `POST /api/exchange/convert` →
   `exchangeService.js`) — as soon as the amount is valid, the frontend
   asks the server "how much ZEC is that?" The answer (zecAmount, rate) is
   added to the same `PrivateBillState` draft.
3. **Quest 03** (`bank-details.html` / `bank-details.js`) — user enters
   recipient bank details. Also saved into the draft. Still nothing has
   touched the server for persistence — everything so far is local.
4. **Quest 04** (`review.html` / `review.js`) — reads the whole draft back
   out and displays it for a final check. Still read-only, still local.
5. **Quest 05** (`order.html` / `order.js` → `POST /api/transactions` →
   `orderService.js` → `TransactionStatusEngine` from Quest 08) — THIS is
   the handoff point. The local draft is sent to the server exactly once,
   `orderService` turns it into a real order, and the Quest 08 engine takes
   over as the source of truth from here on. The local draft is then
   cleared — its job is done.
6. **From here (Quests 06, 07, 09, 10, 11 — not yet built)** would all
   operate on the *server-side order*, not the local draft: Quest 06 would
   read the order's `zecAmount` to show payment instructions, Quest 07
   would watch for payment and call `engine.transition()` to
   `ZEC_DETECTED`, and so on through the state machine Quest 08 already
   defines. None of them need to know anything about Quests 01-04 — they
   only need an order id.

The reason Quest 08 got built first (back before Quests 01-05 existed) is
what makes this handoff clean: the status engine doesn't care *how* an
order was created, only that it's valid. Quest 05 is deliberately a thin
adapter in front of it rather than a second, separate storage system.

### Quest 06 — ZEC Payment Instructions (`public/payment-instructions.html` + `services/zecAddressProvider.js`)

Shows the exact amount and address to fund an order, once it exists.

- **`services/zecAddressProvider.js` is a clearly-labeled placeholder.**
  It does NOT generate a real, usable Zcash address — nothing sent to it
  would be recoverable. It exists so the app has something address-shaped
  to display while real wallet integration (the residency's original plan
  was "Zakura," currently paused) isn't available. The address is
  deterministic per order id, so the same order always shows the same
  address, matching the quest's "payment information must correspond to
  the correct transaction" requirement. Swapping in a real address source
  later should only mean changing this one file.
- The address is attached to the order once, at creation time (Quest 05),
  via a new `engine.updateData()` method added to the Quest 08 engine —
  not generated fresh every time this page loads.
- This page gets the order id from the URL (`?orderId=...`), not
  localStorage — by this point Quest 05 has already cleared the local
  draft on purpose. (This mirrors how ff.io/FixedFloat's own order pages
  work, per their terms of service.)
- Copy-to-clipboard button, with a fallback for browsers without the
  Clipboard API.
- A "Refresh status" button re-fetches the order — useful once Quest 07
  (ZEC detection) exists and can actually change the status; for now it'll
  just keep showing `AWAITING_ZEC`, which is expected and worth mentioning
  in the video rather than hiding.
- 9 more automated tests cover the address generator (deterministic,
  unique per order, correct shape) and the new engine method.

### Quest 09 — Fiat Payout Layer (`services/payoutService.js` + `services/payoutProviders/mockPayoutProvider.js`)

Pays out the fiat amount once an order's ZEC has been confirmed.

- **The provider is fully decoupled**, per the quest's actual requirement.
  `payoutService.js` never talks to a specific provider's API directly —
  it calls whatever provider object it's given (`initiatePayout()` +
  `providerName`). Swapping in a real provider later (Paystack Transfers,
  Flutterwave, etc.) means writing one new file with that shape and
  changing one line (`defaultProvider`) — nothing else in the app changes.
- **No production provider has been approved**, so `mockPayoutProvider.js`
  is used — a sandbox stand-in with no real API credentials anywhere (and
  therefore nothing that could be leaked). It has a built-in guaranteed-
  failure case (account number `0000000000`), the same convention real
  payment sandboxes use, so the failure path can actually be exercised.
- **Double-processing is blocked for free.** `processPayout()` calls
  `engine.transition(id, 'PAYOUT_PROCESSING')` first, and the Quest 08
  engine only allows that transition from `ZEC_CONFIRMED` or
  `PAYOUT_FAILED` — so an order that's already paid out (`FIAT_SENT`)
  can't be re-processed, without payoutService needing its own guard.
- **Every attempt is recorded** (`data.payoutAttempts`), including failed
  ones, with a provider name, timestamps, and either a `providerReference`
  (success) or `failureReason` (failure) — supports retrying a failed
  order without losing the history of what was already tried.
- On success: order moves to `FIAT_SENT`. On failure: order moves to
  `PAYOUT_FAILED` and a `PayoutError` is thrown with context.
- Exposed via `POST /api/transactions/:id/payout`.
- Since Quest 07 (ZEC detection) isn't built, there's no automatic way to
  reach `ZEC_CONFIRMED` yet. Use the manual `POST /:id/transition` endpoint
  (see the note in `routes/transactions.js`) to walk a test order through
  `AWAITING_ZEC → ZEC_DETECTED → CONFIRMING → ZEC_CONFIRMED` by hand, then
  call `/payout` — this is exactly what the automated tests do internally.
- 6 more automated tests cover: success, failure + reason, retry after
  failure (attempt numbering), the double-processing guard, requiring
  `ZEC_CONFIRMED` first, and provider swappability via dependency injection.

### Quest 10 — Transaction Tracking UI (`public/track.html` + `public/js/track.js`)

Renders the status engine's happy-path stages as a step-by-step progress
tracker: Waiting for ZEC → Payment detected → Confirming → ZEC confirmed
→ Processing payout → Fiat sent → Completed.

- **Not simulated.** Every render comes from `GET /api/transactions/:id`,
  the same real endpoint Quest 06 uses. The page polls that endpoint every
  5 seconds and stops automatically once the order reaches a terminal
  status (`COMPLETED`, `EXPIRED`, `CANCELLED`) — there's nothing left that
  could change at that point.
- Shows the order ID and a plain-language summary (amount in, amount out).
- Exception states (`UNDERPAID`, `OVERPAID`, `PAYOUT_FAILED`, etc.) don't
  try to fit onto the happy-path stepper — they show as a separate banner
  instead, since "went wrong" isn't the same shape as "further along."
  Full handling of these is Quest 11's job; this just avoids showing
  something misleading in the meantime.
- Linked in from the payment instructions page (Quest 06) via a "Track
  this payment" button, so the two pages connect into one continuous flow.

### Quest 11 — Error Handling & Exceptions

The quest lists 10 scenarios. Several were already covered by earlier
quests; this section fills the real gaps (expiry, cancellation) and
documents where each one actually lives:

| Scenario | Where it's handled |
|---|---|
| Underpayment / Overpayment | `UNDERPAID`/`OVERPAID` states already exist in the Quest 08 engine and are reachable via the manual `/transition` endpoint (real detection is Quest 07's job, currently blocked). Shown as a banner, not forced onto the tracker's happy-path steps. |
| Expired transaction | **New**: `services/expiryService.js`. Since there's no background job in this project, expiry is checked lazily — any `GET` on an order first checks if it's overdue and flips it to `EXPIRED` before returning, rather than needing a cron sweep. |
| Payment not detected | This is just the `AWAITING_ZEC` steady state persisting — there's no separate "not detected" status, since not-yet-detected and waiting are the same thing until Quest 07 exists. |
| Exchange-rate failure | Quest 02's `RateUnavailableError` → `503`, with the frontend showing a clear retry state. Nothing new needed here. |
| Zcash/network failure | Same shape as exchange-rate failure — an external dependency being down surfaces as a clear error, never a silent fake success. Full handling depends on Quest 07 existing. |
| Invalid recipient information | Format-validated at entry (Quest 03). At payout time, `mockPayoutProvider.js`'s built-in rejection case (Quest 09) simulates a provider-side rejection, surfaced as a normal payout failure. |
| Payout failure | Quest 09 — `PAYOUT_FAILED` status, attempt recorded with a reason, retryable. |
| Duplicate processing attempts | Quest 09's transition guard, now with an explicit test proving two *simultaneous* payout calls on the same order don't both succeed — only one goes through, the other is rejected by the engine. |
| Cancelled transaction | **New**: `POST /api/transactions/:id/cancel`. Only allowed from `CREATED`/`AWAITING_ZEC` — the engine's own transition table blocks cancelling once ZEC has been detected, since funds may already be in flight by then. Exposed as a "Cancel this order" button on the payment instructions page while still waiting for ZEC. |

**"Errors must not incorrectly mark transactions as successfully
completed"** — this is enforced structurally, not just by convention:
`COMPLETED` is only reachable from `FIAT_SENT` in the engine's transition
table, and every failure path (`PAYOUT_FAILED`, `EXPIRED`, `CANCELLED`)
explicitly moves to its own terminal-adjacent state rather than falling
through to success. There's an automated test asserting this directly for
the payout failure case.

Frontend copy for exception states is centralized in
`public/js/exceptionMessages.js`, shared by both `payment-instructions.js`
and `track.js`, so the wording stays consistent rather than drifting
between the two pages.

7 more automated tests cover: expiry (overdue, not-yet-due, already-past
AWAITING_ZEC), cancellation (allowed, blocked-once-ZEC-detected, terminal),
and the explicit never-marked-completed + concurrent-duplicate-payout checks.

## Known limitations / next steps

- **In-memory store.** Transactions vanish on server restart. Fine for
  demoing the state machine; needs a real DB before this goes further.
- **The `/transition` route is a placeholder.** It exists so we can drive
  the engine manually while Quests 06 (payment instructions), 07 (ZEC
  detection), and 09 (payout) aren't built yet. Those quests should call
  `engine.transition()` internally, not through an open, unauthenticated
  HTTP endpoint.
- **Quests 01-05** (currency select, fiat amount, ZEC calculation, bank
  details, review, order creation) aren't available on the residency
  platform yet, so `POST /api/transactions` currently accepts an arbitrary
  body as a stand-in for whatever order-creation payload those quests will
  eventually produce.
- **Rate quotes aren't locked to an order yet.** Right now the ZEC amount
  shown is just a live quote — nothing stops it from changing between when
  the user sees it and when Quest 05 (order creation) exists to lock it in.
  That should be tightened once orders are real.
