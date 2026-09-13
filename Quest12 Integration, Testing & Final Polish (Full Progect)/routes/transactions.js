/**
 * Transaction API routes
 * Quest 08 — exposes the status engine over HTTP for the frontend.
 * Quest 05 — POST / now creates a real, validated order via orderService.js.
 * Quest 09 — POST /:id/payout triggers the fiat payout via payoutService.js.
 * Quest 11 — GET routes now lazily expire overdue orders; added POST /:id/cancel.
 *
 * NOTE: POST /:id/transition is here for now so we can drive the state
 * machine manually while Quest 07 (ZEC detection) isn't built yet. In the
 * meantime it also doubles as a way to demo Quest 09 in isolation: walk an
 * order to ZEC_CONFIRMED by hand, then call /payout. Once Quest 07 exists,
 * it should call `engine.transition(...)` internally instead of relying on
 * this open, unauthenticated endpoint — this is a placeholder, not
 * something to ship to production.
 */

const express = require('express');
const {
  InvalidTransitionError,
  TransactionNotFoundError,
  STATUS,
} = require('../models/transactionStatusEngine');
const { createOrder } = require('../services/orderService');
const { processPayout, PayoutError } = require('../services/payoutService');
const { expireIfNeeded } = require('../services/expiryService');

function createTransactionRouter(engine) {
  const router = express.Router();

  // Create a real order (Quest 05) from the payment + recipient details
  // gathered across Quests 01-04.
  router.post('/', (req, res) => {
    try {
      const order = createOrder(engine, req.body);
      res.status(201).json(order);
    } catch (err) {
      // A validation failure here (missing fields) is a client error --
      // anything else is unexpected and should surface as a 500.
      res.status(400).json({ error: err.message });
    }
  });

  // List transactions (optionally ?status=AWAITING_ZEC)
  router.get('/', (req, res) => {
    const { status } = req.query;
    res.json(engine.list({ status }));
  });

  // Get a single transaction's current status + full record.
  // Lazily expires it first if it's overdue (Quest 11).
  router.get('/:id', (req, res) => {
    try {
      const tx = expireIfNeeded(engine, req.params.id);
      res.json(tx);
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }
  });

  // Get just the history (useful for the progress-tracking UI, Quest 10)
  router.get('/:id/history', (req, res) => {
    try {
      const tx = expireIfNeeded(engine, req.params.id);
      res.json({ id: tx.id, status: tx.status, history: tx.history });
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }
  });

  // Manually drive a transition (temporary — see note above)
  router.post('/:id/transition', (req, res) => {
    const { status, meta } = req.body || {};
    try {
      const tx = engine.transition(req.params.id, status, meta);
      res.json(tx);
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof InvalidTransitionError) {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }
  });

  // Trigger the fiat payout for an order (Quest 09). Only works once the
  // order's ZEC has been confirmed (status ZEC_CONFIRMED) -- see the note
  // at the top of this file for how to reach that state without Quest 07.
  router.post('/:id/payout', async (req, res) => {
    try {
      const order = await processPayout(engine, req.params.id);
      res.json(order);
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof InvalidTransitionError) {
        return res.status(409).json({
          error: `Order is not ready for payout (${err.message}).`,
        });
      }
      if (err instanceof PayoutError) {
        return res.status(502).json({ error: err.message });
      }
      throw err;
    }
  });

  // Cancel an order (Quest 11). Only allowed while still CREATED or
  // AWAITING_ZEC -- the engine's own transition table already blocks
  // cancelling an order once ZEC has been detected, since money may
  // already be in flight by then.
  router.post('/:id/cancel', (req, res) => {
    try {
      const order = engine.transition(req.params.id, STATUS.CANCELLED, {
        reason: (req.body && req.body.reason) || 'Cancelled by user.',
      });
      res.json(order);
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof InvalidTransitionError) {
        return res.status(409).json({
          error: 'This order can no longer be cancelled — payment has already progressed too far.',
        });
      }
      throw err;
    }
  });

  return router;
}

module.exports = createTransactionRouter;
