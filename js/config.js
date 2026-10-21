/**
 * Private Bill — Quest 1 configuration
 * ------------------------------------
 * Central place for everything that isn't API-fetching logic or DOM
 * wiring: supported currencies, minimums, the service fee, and the
 * fallback rates used only if a live rate source can't be reached.
 */

const PB_CONFIG = {
  // Cryptocurrency this Quest funds transactions with.
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

  // How often the rate auto-refreshes, in milliseconds.
  refreshIntervalMs: 60000,

  /**
   * Fallback rates — used ONLY if both live sources (CoinGecko for
   * ZEC/USD, and the open exchange-rate API for USD/NGN and USD/GHS)
   * fail to respond. These are approximate figures from early
   * September 2026 and exist so the interface still demonstrates its
   * behavior offline; the UI always labels them clearly as a fallback
   * rather than presenting them as live data.
   */
  fallback: {
    zecUsd: 1200,
    usdToNgn: 1350,
    usdToGhs: 11.4
  }
};
