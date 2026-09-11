# Private Bill — Quest 2: ZEC Conversion Functionality

Part of **Private Bill**, a Zcash-to-fiat payment platform being built
collaboratively during the ZcashGH Residency. Private Bill lets a
sender fund a payment with ZEC while the recipient receives ordinary
fiat currency — Nigerian Naira (NGN) or Ghanaian Cedi (GHS) — in their
bank account.

**Quest 1** built the exchange interface: a user picks NGN or GHS and
enters the amount the recipient should receive. **This Quest (Quest 2)**
implements the functionality behind it — retrieving or calculating the
ZEC equivalent and displaying it clearly — with the conversion logic
kept fully separate from the interface, no hard-coded exchange rates
anywhere in production logic, and explicit handling for when the rate
service can't be reached.

Built with **Bootstrap 5** (vendored locally, not loaded from a CDN),
vanilla JavaScript, and no build step. The existing Quest 1 exchange
interface — layout, currency selector, preview modal — is preserved
unchanged; only the logic behind it was added and restructured.

## Architecture

```
Rate PROVIDERS  →  Rate SERVICE  →  Converter  →  UI (app.js)
(raw data)         (orchestration)  (pure math)   (DOM only)
```

- **`js/rateProviders/`** — one file per live data source. Each
  implements a small, fixed shape (`getZecUsd()` or `getFxRates()`,
  see `provider.js`) and knows nothing about Private Bill, retries, or
  the UI. Swapping CoinGecko for a different price feed, or adding a
  second FX source, means adding one file here and nothing else.
- **`js/rateService.js`** — the only file that knows which providers
  exist and in what order to try them. It tries each provider in a
  chain and, if every provider in a chain fails, **rejects** — it does
  not substitute a guessed number. This is the one place you'd edit to
  reorder, add, or retire a provider.
- **`js/converter.js`** — pure calculation: zero DOM access, zero
  network calls, zero knowledge of where its input numbers came from.
  Given a fiat amount and two rate numbers, it returns the ZEC
  breakdown. Separately unit-testable (`tests/converter.test.js`) with
  plain Node, no browser required.
- **`js/app.js`** — UI glue only: DOM references, event handlers,
  currency selection, and rendering, including turning a rate-service
  rejection into the visible "rates unavailable" banner. It contains
  no arithmetic and no `fetch` calls of its own.

## No hard-coded exchange rates in production

Earlier drafts of this Quest included a static fallback rate, used
only if live sources failed. That's been deliberately removed: **a
payment interface that silently substitutes a stale numeric rate when
its live sources fail can cause a sender to pay the wrong amount**,
with no visible sign anything was estimated. `config.js` now holds no
rate numbers at all, and `rateService.js` has no fallback provider in
its chains — if CoinGecko and the FX API are both unreachable,
`PB_LIVE_RATE_SERVICE.getRates()` rejects, and the UI shows an
explicit "Exchange rate unavailable" state instead of a number.

The only numeric rate figures anywhere in the repository are literal
values inside `tests/converter.test.js` — test fixtures for the pure
math, not something the running app ever reads.

## Handling unavailable or failed exchange-rate requests

When `getRates()` rejects, `app.js`:

- Turns the rate-ticker dot red and its label to "Exchange rate
  unavailable"
- Shows a dedicated amber banner: *"We couldn't reach the
  exchange-rate service, so no ZEC amount can be shown right now,"*
  with its own **Retry** button
- Replaces the "You send" field's contents with a "Rate unavailable"
  placeholder rather than a blank field or a stale number
- Disables **Continue** regardless of what's typed in the fiat field
- Keeps retrying automatically every 60 seconds in the background
  (`PB_CONFIG.refreshIntervalMs`), so a transient outage clears itself
  without the user needing to act, while the Retry button and the
  header refresh icon both cover the impatient case

This state is entirely separate from field-level validation errors
(invalid or below-minimum amounts), which use their own red banner and
can appear regardless of whether rates are available.

## File structure

```
private-bill-quest2/
├── index.html                          markup only — no inline styles or scripts
├── css/
│   └── style.css                        styling, layered on top of Bootstrap
├── js/
│   ├── config.js                        currencies, minimums, fee %, refresh interval — no rate numbers
│   ├── converter.js                     pure ZEC conversion math + input validation
│   ├── rateService.js                   orchestrates provider chains; rejects on total failure
│   ├── app.js                           DOM wiring + rate-unavailable UI state
│   └── rateProviders/
│       ├── provider.js                   the shape every provider implements (docs only)
│       ├── coingeckoProvider.js          ZEC → USD price
│       └── exchangeRateApiProvider.js    USD → NGN / GHS rates
├── tests/
│   └── converter.test.js                plain-Node tests for the pure conversion logic
├── vendor/
│   └── bootstrap/                        Bootstrap 5, vendored locally
├── assets/
│   └── zec-icon.svg
├── screenshots/                          screenshots of both the live and unavailable states
└── README.md                             this file
```

## How the conversion works

1. **`rateService.js`** asks the CoinGecko provider for ZEC/USD and the
   ExchangeRate-API provider for USD→NGN and USD→GHS, in parallel.
   CoinGecko's `vs_currencies` list supports NGN but not GHS, which is
   why FX rates come from a separate provider rather than one combined
   source. If either request fails, the promise for that side rejects;
   with no fallback provider configured, `getRates()` as a whole
   rejects and `app.js` shows the unavailable state.
2. **`converter.js`** takes the resolved numbers and the amount the
   user typed, and computes:
   `usdAmount = fiatAmount ÷ fxRate`, `baseZec = usdAmount ÷ zecUsd`,
   `feeZec = baseZec × feePct`, `totalZec = baseZec + feeZec`, plus an
   `effectiveRate` (1 ZEC expressed in the chosen fiat currency) used
   for the rate ticker and the preview modal.
3. **`app.js`** renders `totalZec` in the "You send" field — clearly
   labeled, in a monospace, teal-highlighted, read-only field — along
   with the fee breakdown and the rate actually used.

## Why the source-swap claim is real, not aspirational

To upgrade or add a rate source later:

- **Add a provider** — write a new file in `js/rateProviders/`
  implementing `getZecUsd()` or `getFxRates()`, matching the contract
  documented in `provider.js`.
- **Wire it in** — add it to the relevant chain in `rateService.js`
  (`cryptoProviders` or `fxProviders`), ahead of or instead of the
  current entry — multiple real providers can be chained for
  redundancy without ever needing a hard-coded numeric fallback.

Nothing in `converter.js` or `app.js` needs to change either way —
they only ever see the final `{ zecUsd, usdToNgn, usdToGhs }` shape or
a rejection, never which provider produced it.

## Testing the conversion logic in isolation

Because `converter.js` has no DOM or network dependency, it runs
directly under Node:

```bash
node tests/converter.test.js
```

12 assertions cover the core math (base amount, fee, effective rate),
that currency/amount pass through unchanged, and the validation rules
(non-numeric input, zero/negative amounts, below-minimum amounts).
This is the concrete demonstration that the conversion logic is
separated from the interface — it runs with no browser involved.

## Running the app

No server or build step needed:

1. Download the `private-bill-quest2` folder.
2. Open `index.html` in any modern browser, desktop or mobile.

To serve it locally instead:

```bash
cd private-bill-quest2
python3 -m http.server 8000
```

## Integrating with the existing (Quest 1) work

This Quest was built directly on top of the Quest 1 exchange
interface: the same `index.html` layout, Bootstrap styling, currency
selector, and preview modal are reused unchanged. Only the calculation
and rate-fetching internals were added and restructured, and `app.js`
was updated to call the new modules and handle their failure case
instead of computing anything inline.

**Note on the branch this was built from:** this environment doesn't
have direct access to the `ZcashGH-Residency01` repository, so this
was built from the most recent Quest 1/2 deliverable already on hand,
not by pulling `main` directly. Before opening a PR, pull the latest
`main`, diff it against the files in this bundle, and carry forward
any changes merged there since that aren't reflected here.

## Git workflow

Submit to `ZcashGH-Residency01` on your **assigned Quest branch** —
never directly to `main`:

```bash
git checkout main
git pull origin main
git checkout -b <your-assigned-quest-2-branch-name>
# copy this Quest's files in, on top of the pulled main
git add .
git commit -m "Quest 2: ZEC conversion functionality, separated from the UI, no hard-coded rates"
git push origin <your-assigned-quest-2-branch-name>
```

Then open a pull request from that branch into `main` for review.

## Screenshots

| # | File | Shows |
|---|------|-------|
| 1 | `screenshots/01-live-empty.png` | Live rate resolved, empty input, teal "live" dot with timestamp |
| 2 | `screenshots/02-live-ngn-filled.png` | NGN amount converted to ZEC via the live rate |
| 3 | `screenshots/03-live-ghs-filled.png` | Currency switched to GHS, rate ticker and totals both update |
| 4 | `screenshots/04-live-preview-modal.png` | Preview modal populated from the converter's output |
| 5 | `screenshots/05-unavailable-empty.png` | Every provider failed: red dot, amber banner, Retry button |
| 6 | `screenshots/06-unavailable-with-amount.png` | Same failure state with a valid amount typed — "Rate unavailable" shown instead of a number, Continue stays disabled |

Screenshots 1–4 were captured with the CoinGecko and ExchangeRate-API
responses mocked at the network layer, since this build environment
has no outbound access to either service — the mocked values (ZEC at
$1,200; 1,350 NGN and 11.4 GHS per USD) exist only in the screenshot
script, not anywhere in the shipped code. Screenshots 5–6 needed no
mocking at all — the unavailable state is what this environment
produces naturally, which is itself a real (if accidental) end-to-end
test of the failure path.

## Sources used to verify technical information

- CoinGecko API docs, *Simple Price* and *Supported Currencies List* — endpoint used for ZEC/USD, and confirmation that GHS isn't in its `vs_currencies` list — https://docs.coingecko.com/reference/simple-price and https://docs.coingecko.com/reference/simple-supported-currencies
- ExchangeRate-API, *Open Access documentation* — the free, no-key endpoint used for USD→NGN and USD→GHS — https://www.exchangerate-api.com/docs/free
- FixedFloat (ff.io) — UI reference carried over unchanged from Quest 1 — https://ff.io/

## What I learned

- **"No hard-coded rates" and "handle failed requests" are the same
  requirement seen from two sides.** A fallback rate and a clear
  unavailable state are mutually exclusive ways of handling the same
  failure — you can't fully commit to one while keeping the other
  as a safety net, or the safety net quietly becomes the thing you
  said you'd avoid. Removing the fallback provider is what made the
  unavailable-state UI necessary, not an unrelated addition.
- **A rejection is a more honest API than a masked failure.**
  Changing `rateService.getRates()` from "always resolves, sometimes
  with fallback data" to "resolves with live data or rejects" pushed
  the decision of what to show the user up to `app.js`, where it
  belongs — the service itself now can't accidentally paper over an
  outage.
- **The natural test environment became the best test of the failure
  path.** With no outbound network access here, every unmocked run of
  the app exercises the unavailable-state code for free; mocking was
  only needed to prove the *live* path still works, which is the
  opposite of how most of this project's earlier testing went.

## Difficulties / challenges encountered

- **Distinguishing two kinds of "no rates yet."** There's a real
  difference between "still loading, first request in flight" and
  "every provider has failed" — both involve `state.rates` being
  temporarily unusable, but only the second should show the red
  banner. Solved with an explicit `state.ratesUnavailable` flag rather
  than trying to infer which case applies from `state.rates` alone.
- **No direct repository access**, as with Quest 1's prior handoff —
  handled the same way: built from the latest available deliverable
  and documented explicitly, above, that `main` should be pulled and
  diffed before merging.
- **Proving the live path still works after removing the safety net.**
  Once the fallback provider was gone, this sandboxed environment
  could no longer demonstrate a successful conversion naturally.
  Mocking the two HTTP endpoints at the Playwright layer (not in the
  shipped code) was the only way to screenshot the live state
  honestly, without reintroducing hard-coded numbers into the app
  itself to make testing easier.
