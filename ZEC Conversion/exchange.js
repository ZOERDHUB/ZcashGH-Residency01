/**
 * Exchange rate / conversion routes
 * Quest 02 — exposes exchangeService.js to the frontend over HTTP.
 */

const express = require('express');
const {
  convertFiatToZec,
  getZecRate,
  RateUnavailableError,
  UnsupportedCurrencyError,
} = require('../services/exchangeService');

function createExchangeRouter() {
  const router = express.Router();

  // GET /api/exchange/rate/NGN -> current ZEC price in NGN
  router.get('/rate/:currency', async (req, res) => {
    const currency = req.params.currency.toUpperCase();
    try {
      const rate = await getZecRate(currency);
      res.json({ currency, ...rate });
    } catch (err) {
      handleError(err, res);
    }
  });

  // POST /api/exchange/convert  { amount, currency } -> ZEC amount to pay
  router.post('/convert', async (req, res) => {
    const { amount, currency } = req.body || {};
    try {
      const result = await convertFiatToZec(Number(amount), String(currency || '').toUpperCase());
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  return router;
}

function handleError(err, res) {
  if (err instanceof RateUnavailableError) {
    return res.status(503).json({
      error: 'Exchange rate is temporarily unavailable. Please try again in a moment.',
    });
  }
  if (err instanceof UnsupportedCurrencyError) {
    return res.status(400).json({ error: err.message });
  }
  // Anything else (e.g. bad amount) is treated as a client error here,
  // since it's almost always caused by invalid input.
  res.status(400).json({ error: err.message });
}

module.exports = createExchangeRouter;
