/**
 * Private Bill — ZEC conversion logic
 * --------------------------------------
 * Pure calculation only: no DOM access, no network calls, no knowledge
 * of Bootstrap or the page at all. Given a fiat amount and the two
 * rates it depends on, it returns the ZEC breakdown. This is what
 * "the conversion logic is separated from the interface" means in
 * practice — everything here can be unit-tested by calling it
 * directly (see js/converter.test.js), and the UI layer (app.js)
 * only ever reads the numbers this module hands back.
 *
 * It doesn't care where zecUsd or fxRate came from — a live API, a
 * fallback constant, or a future internal Private Bill rate oracle
 * are all the same to this module, as long as they arrive as plain
 * numbers. That's what keeps the conversion math decoupled from the
 * rate SOURCE (see js/rateProviders/ and js/rateService.js).
 */

const PB_CONVERTER = (() => {
  /**
   * @param {Object} input
   * @param {number} input.fiatAmount   Amount the recipient should receive, in `currencyCode`.
   * @param {string} input.currencyCode "NGN" or "GHS" — used only for the returned label, not the math.
   * @param {number} input.zecUsd       Current ZEC price in USD.
   * @param {number} input.fxRate       Units of `currencyCode` per 1 USD (e.g. ~1350 for NGN).
   * @param {number} input.feePct       Service fee, as a percentage (e.g. 1.5 for 1.5%).
   * @returns {{
   *   currencyCode: string,
   *   fiatAmount: number,
   *   usdAmount: number,
   *   baseZec: number,
   *   feeZec: number,
   *   totalZec: number,
   *   effectiveRate: number   // 1 ZEC expressed in `currencyCode`
   * }}
   */
  function convertFiatToZec({ fiatAmount, currencyCode, zecUsd, fxRate, feePct }) {
    if (typeof fiatAmount !== "number" || fiatAmount <= 0) {
      throw new RangeError("fiatAmount must be a positive number");
    }
    if (typeof zecUsd !== "number" || zecUsd <= 0) {
      throw new RangeError("zecUsd must be a positive number");
    }
    if (typeof fxRate !== "number" || fxRate <= 0) {
      throw new RangeError("fxRate must be a positive number");
    }
    if (typeof feePct !== "number" || feePct < 0) {
      throw new RangeError("feePct must be zero or a positive number");
    }

    const usdAmount = fiatAmount / fxRate;
    const baseZec = usdAmount / zecUsd;
    const feeZec = baseZec * (feePct / 100);
    const totalZec = baseZec + feeZec;
    const effectiveRate = zecUsd * fxRate; // 1 ZEC in the fiat currency

    return {
      currencyCode,
      fiatAmount,
      usdAmount,
      baseZec,
      feeZec,
      totalZec,
      effectiveRate
    };
  }

  /**
   * Validates a fiat amount against a currency's minimum before
   * conversion is attempted. Kept here (rather than in app.js) so the
   * validation rule travels with the conversion logic it protects,
   * not with the DOM code that happens to call it first.
   *
   * @returns {string|null} an error message, or null if the amount is valid.
   */
  function validateFiatAmount(rawValue, currencyMeta) {
    if (!rawValue || !rawValue.toString().trim()) return null; // empty = no error yet, just nothing to convert
    const amount = Number(rawValue);
    if (Number.isNaN(amount) || amount <= 0) {
      return "Enter a valid amount greater than zero.";
    }
    if (amount < currencyMeta.minAmount) {
      return `Minimum amount is ${currencyMeta.symbol}${currencyMeta.minAmount.toLocaleString()}.`;
    }
    return null;
  }

  return { convertFiatToZec, validateFiatAmount };
})();

// Support both browser <script> usage and Node (for the test file / any future test runner).
if (typeof module !== "undefined" && module.exports) {
  module.exports = PB_CONVERTER;
}
