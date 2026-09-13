/**
 * Private Bill — ExchangeRate-API FX provider
 * -----------------------------------------------
 * An FX RATE PROVIDER (see provider.js for the contract).
 * Fetches USD-to-fiat rates from the free, no-key open.er-api.com
 * endpoint and returns the NGN and GHS figures Private Bill needs.
 *
 * CoinGecko's vs_currencies list covers NGN but not GHS, which is why
 * FX rates are sourced separately from the crypto price rather than
 * from a single combined provider.
 */

const PB_EXCHANGERATE_PROVIDER = (() => {
  const URL = "https://open.er-api.com/v6/latest/USD";
  const TIMEOUT_MS = 8000;

  async function getFxRates() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`Exchange-rate request failed (${res.status})`);
      const data = await res.json();
      const ngn = data && data.rates && data.rates.NGN;
      const ghs = data && data.rates && data.rates.GHS;
      if (typeof ngn !== "number" || typeof ghs !== "number") {
        throw new Error("Unexpected exchange-rate response shape");
      }
      return { NGN: ngn, GHS: ghs };
    } finally {
      clearTimeout(timer);
    }
  }

  return { name: "exchangerate-api", getFxRates };
})();
