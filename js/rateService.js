/**
 * Private Bill — rate service
 * -------------------------------
 * Sits between the rate PROVIDERS (js/rateProviders/) and the UI
 * (app.js). Its job is orchestration only: try each live provider in
 * a chain in order, and — if every provider in a chain fails — REJECT
 * rather than substitute a guessed number. There is no numeric
 * fallback here on purpose: this is a payment app, and silently
 * showing a stale hard-coded rate as if it were current could cause a
 * real sender to pay the wrong amount. app.js is responsible for
 * turning a rejection into a clear "rates unavailable" state.
 *
 * This is also the one file that knows which providers exist and in
 * what order to try them. Upgrading or replacing a rate source later
 * means editing the two chains below (or passing different chains
 * into createRateService) — converter.js and app.js don't change.
 */

const PB_RATE_SERVICE = (() => {
  /**
   * @param {Object} options
   * @param {Array<{name: string, getZecUsd: Function}>} options.cryptoProviders
   *   Tried in order for the ZEC/USD price. Each must resolve a number or throw.
   * @param {Array<{name: string, getFxRates: Function}>} options.fxProviders
   *   Tried in order for USD-to-fiat rates. Each must resolve
   *   { NGN, GHS } (or throw).
   */
  function createRateService({ cryptoProviders, fxProviders }) {
    async function tryChain(providers, methodName) {
      if (!providers || providers.length === 0) {
        throw new Error(`No providers configured for ${methodName}`);
      }
      let lastError = null;
      for (const provider of providers) {
        try {
          const value = await provider[methodName]();
          return { value, source: provider.name };
        } catch (err) {
          lastError = err;
          // fall through to the next provider in the chain
        }
      }
      throw new PB_RateUnavailableError(
        `All providers failed for ${methodName}`,
        lastError
      );
    }

    /**
     * Resolves with live rate data, or REJECTS with a
     * PB_RateUnavailableError if every configured provider in either
     * chain failed. Callers must handle the rejection — there is no
     * silent fallback value.
     *
     * @returns {Promise<{
     *   zecUsd: number, usdToNgn: number, usdToGhs: number,
     *   sources: {crypto: string, fx: string}, fetchedAt: Date
     * }>}
     */
    async function getRates() {
      const [cryptoResult, fxResult] = await Promise.all([
        tryChain(cryptoProviders, "getZecUsd"),
        tryChain(fxProviders, "getFxRates")
      ]);

      return {
        zecUsd: cryptoResult.value,
        usdToNgn: fxResult.value.NGN,
        usdToGhs: fxResult.value.GHS,
        sources: { crypto: cryptoResult.source, fx: fxResult.source },
        fetchedAt: new Date()
      };
    }

    return { getRates };
  }

  return { createRateService };
})();

/**
 * Thrown when no configured provider in a chain could supply a rate.
 * app.js catches this specifically to show the "rates unavailable"
 * state rather than treating it as an unexpected bug.
 */
class PB_RateUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "PB_RateUnavailableError";
    this.cause = cause;
  }
}

/**
 * The service Private Bill actually uses: CoinGecko for the ZEC
 * price, ExchangeRate-API for FX. To upgrade or add a source later,
 * add a new provider file under js/rateProviders/ implementing the
 * same shape (see provider.js) and list it here — ahead of, or
 * instead of, the current entry. Nothing else in the app changes.
 */
const PB_LIVE_RATE_SERVICE = PB_RATE_SERVICE.createRateService({
  cryptoProviders: [PB_COINGECKO_PROVIDER],
  fxProviders: [PB_EXCHANGERATE_PROVIDER]
});

// Support both browser <script> usage and Node (for tests).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PB_RATE_SERVICE, PB_RateUnavailableError };
}
