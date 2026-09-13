/**
 * Private Bill — configuration
 * ------------------------------------
 * Central place for everything that isn't API-fetching logic or DOM
 * wiring: supported currencies, minimums, the service fee, and refresh
 * timing.
 *
 * Deliberately absent: any hard-coded exchange rate. A payment
 * interface that silently falls back to a stale numeric rate when its
 * live sources fail can quietly under- or over-charge a real sender —
 * so when rates can't be fetched, the app shows an explicit
 * "unavailable" state (see rateService.js and app.js) instead of
 * computing anything from a guessed number. If you're looking for
 * fixed numbers to compute against, that's tests/converter.test.js
 * (test fixtures, not production logic).
 */

const PB_CONFIG = {
  // Cryptocurrency this platform funds transactions with.
  crypto: {
    id: "zcash",      // CoinGecko coin id
    symbol: "ZEC",
    decimals: 8
  },

  // Fiat currencies a recipient can be paid in.
  currencies: {
    NGN: {
      code: "NGN",
      name: "Nigerian Naira",
      flag: "🇳🇬",
      symbol: "₦",
      minAmount: 5000,      // minimum amount the recipient can receive
      decimals: 2
    },
    GHS: {
      code: "GHS",
      name: "Ghanaian Cedi",
      flag: "🇬🇭",
      symbol: "GH₵",
      minAmount: 50,
      decimals: 2
    }
  },

  // Flat service fee applied on top of the raw market conversion,
  // shown transparently in the breakdown before the user continues.
  serviceFeePct: 1.5,

  // How often the rate auto-refreshes when live, and how often a
  // failed fetch is silently retried in the background, in milliseconds.
  refreshIntervalMs: 60000,

  // How long a created order's rate stays locked before it expires
  // unattended. 10 minutes matches ff.io's own published fixed-rate
  // lock window (see FAQ) — the reference this project already
  // follows for the exchange-widget pattern, and a realistic figure
  // for how long a quoted rate can be honored before ZEC's price
  // could move enough to matter.
  orderExpiryMs: 10 * 60 * 1000
};

// Support both browser <script> usage and Node (for tests).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PB_CONFIG };
}
