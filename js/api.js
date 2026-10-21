/**
 * Private Bill — Quest 1 rate fetching
 * -------------------------------------
 * Pulls two independent pieces of data and combines them:
 *   1. ZEC → USD price, from CoinGecko's public API.
 *   2. USD → {NGN, GHS} rates, from the ExchangeRate-API open endpoint
 *      (CoinGecko's vs_currencies list supports NGN but not GHS, so a
 *      separate forex source is needed to cover both fiat options).

  PB_API.getRates() resolves to:
    {
      zecUsd: number,
      usdToNgn: number,
     usdToGhs: number,
     isLive: boolean,   // false if either source fell back
     fetchedAt: Date
   }

 * If a source fails, its piece falls back to PB_CONFIG.fallback and
 * isLive is set to false so the UI can disclose that clearly.
 */

const PB_API = (() => {
  const COINGECKO_URL =
    "https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd";
  const FX_URL = "https://open.er-api.com/v6/latest/USD";
  const TIMEOUT_MS = 8000;

  function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(url, { signal: controller.signal }).finally(() =>
      clearTimeout(timer),
    );
  }


  async function fetchZecUsd() {
    const res = await fetchWithTimeout(COINGECKO_URL);
    if (!res.ok) throw new Error("CoinGecko request failed");
    const data = await res.json();
    const price = data && data.zcash && data.zcash.usd;
    if (typeof price !== "number")
      throw new Error("Unexpected CoinGecko response");
    return price;
  }

  async function fetchFxRates() {
    const res = await fetchWithTimeout(FX_URL);
    if (!res.ok) throw new Error("Exchange-rate request failed");
    const data = await res.json();
    const ngn = data && data.rates && data.rates.NGN;
    const ghs = data && data.rates && data.rates.GHS;
    if (typeof ngn !== "number" || typeof ghs !== "number") {
      throw new Error("Unexpected exchange-rate response");
    }
    return { usdToNgn: ngn, usdToGhs: ghs };
  }

  async function getRates() {
    const results = await Promise.allSettled([fetchZecUsd(), fetchFxRates()]);
    const [zecResult, fxResult] = results;

    const zecUsd =
      zecResult.status === "fulfilled"
        ? zecResult.value
        : PB_CONFIG.fallback.zecUsd;

    const usdToNgn =
      fxResult.status === "fulfilled"
        ? fxResult.value.usdToNgn
        : PB_CONFIG.fallback.usdToNgn;

    const usdToGhs =
      fxResult.status === "fulfilled"
        ? fxResult.value.usdToGhs
        : PB_CONFIG.fallback.usdToGhs;

    const isLive =
      zecResult.status === "fulfilled" && fxResult.status === "fulfilled";

    return { zecUsd, usdToNgn, usdToGhs, isLive, fetchedAt: new Date() };
  }

  return { getRates };
})();
