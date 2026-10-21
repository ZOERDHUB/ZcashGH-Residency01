/**
 * forexRateProvider.js
 *
 * CoinGecko doesn't quote ZEC directly in Ghanaian Cedi (GHS), only in a
 * fixed list of currencies that happens to include NGN but not GHS. So for
 * GHS we go via USD: ZEC -> USD (from CoinGecko) -> GHS (from here).
 *
 * Uses open.er-api.com, a free forex API that needs no API key.
 */

const FOREX_URL = 'https://open.er-api.com/v6/latest/USD';

/**
 * Get how many units of `targetCurrency` (e.g. 'GHS') equal 1 USD.
 */
async function fetchUsdToRate(targetCurrency) {
  const response = await fetch(FOREX_URL);

  if (!response.ok) {
    throw new Error(`Forex rate request failed with status ${response.status}`);
  }

  const data = await response.json();
  const rate = data?.rates?.[targetCurrency];

  if (typeof rate !== 'number') {
    throw new Error(`No forex rate found for USD -> ${targetCurrency}`);
  }

  return rate;
}

module.exports = { fetchUsdToRate };
