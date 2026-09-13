/**
 * zecRateProvider.js
 *
 * Talks to CoinGecko's public API to find out what 1 ZEC is worth.
 * Kept deliberately tiny and single-purpose: exchangeService.js decides
 * *how* to combine these numbers, this file just knows how to fetch one.
 */

const COINGECKO_SIMPLE_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price';

/**
 * Get the price of 1 ZEC in the given CoinGecko-supported currency code
 * (lowercase, e.g. 'usd', 'ngn').
 */
async function fetchZecPrice(vsCurrency) {
  const url = `${COINGECKO_SIMPLE_PRICE_URL}?ids=zcash&vs_currencies=${vsCurrency}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CoinGecko request failed with status ${response.status}`);
  }

  const data = await response.json();
  const price = data?.zcash?.[vsCurrency];

  if (typeof price !== 'number') {
    throw new Error(`CoinGecko did not return a ZEC price in ${vsCurrency}`);
  }

  return price;
}

module.exports = { fetchZecPrice };
