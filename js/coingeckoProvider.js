/**
 * Private Bill — CoinGecko rate provider
 * -----------------------------------------
 * A CRYPTO PRICE PROVIDER (see provider.js for the contract).
 * Fetches ZEC's current price in USD from CoinGecko's public API.
 *
 * To swap this out later (e.g. for a paid data feed, a different
 * exchange's API, or an internal Private Bill price oracle), write a
 * new file that exposes the same `getZecUsd()` shape and list it
 * ahead of — or instead of — this one in rateService.js. Nothing
 * else in the codebase needs to know it changed.
 */

const PB_COINGECKO_PROVIDER = (() => {
  const URL = "https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd";
  const TIMEOUT_MS = 8000;

  async function getZecUsd() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`CoinGecko request failed (${res.status})`);
      const data = await res.json();
      const price = data && data.zcash && data.zcash.usd;
      if (typeof price !== "number") throw new Error("Unexpected CoinGecko response shape");
      return price;
    } finally {
      clearTimeout(timer);
    }
  }

  return { name: "coingecko", getZecUsd };
})();
