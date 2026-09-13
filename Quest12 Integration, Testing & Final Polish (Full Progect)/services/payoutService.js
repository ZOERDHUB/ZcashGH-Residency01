/**
 * payoutService.js — Quest 09: Fiat Payout Layer.
 *
 * This is the ONLY place in the app that knows a payout is happening.
 * The transaction engine and the routes just see status changes and a
 * record of attempts -- neither of them needs to know which provider
 * is behind it. That separation is what the quest actually asks for:
 * swap `defaultProvider` below for a real one later (e.g. Paystack) and
 * nothing else in this file, or anywhere else in the app, needs to change.
 *
 * No production payout provider has been approved/configured yet, so this
 * defaults to services/payoutProviders/mockPayoutProvider.js -- a
 * sandbox/mock implementation, exactly as the quest allows for this case.
 */

const mockPayoutProvider = require('./payoutProviders/mockPayoutProvider');

const defaultProvider = mockPayoutProvider;

class PayoutError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'PayoutError';
    this.cause = cause;
  }
}

/**
 * Run the payout for an order whose ZEC has already been confirmed.
 *
 * @param {import('../models/transactionStatusEngine').TransactionStatusEngine} engine
 * @param {string} orderId
 * @param {object} [provider] - injectable for testing / future real providers;
 *   defaults to the mock sandbox provider.
 */
async function processPayout(engine, orderId, provider = defaultProvider) {
  // engine.transition() already only allows PAYOUT_PROCESSING to be
  // reached from ZEC_CONFIRMED or PAYOUT_FAILED (see the status engine's
  // TRANSITIONS table). That naturally blocks double-processing an order
  // that's already been paid out -- we don't need to re-implement that
  // guard here.
  const order = engine.transition(orderId, 'PAYOUT_PROCESSING');

  const attemptNumber = (order.data.payoutAttempts || []).length + 1;
  const startedAt = new Date().toISOString();

  try {
    const result = await provider.initiatePayout({
      amount: order.data.fiatAmount,
      currency: order.data.fiatCurrency,
      recipient: order.data.recipient,
      orderId: order.id,
    });

    recordAttempt(engine, order.id, {
      attemptNumber,
      provider: provider.providerName,
      startedAt,
      finishedAt: new Date().toISOString(),
      outcome: 'success',
      providerReference: result.providerReference,
    });

    return engine.transition(order.id, 'FIAT_SENT');
  } catch (err) {
    recordAttempt(engine, order.id, {
      attemptNumber,
      provider: provider.providerName,
      startedAt,
      finishedAt: new Date().toISOString(),
      outcome: 'failed',
      failureReason: err.message,
    });

    engine.transition(order.id, 'PAYOUT_FAILED');
    throw new PayoutError(`Payout failed for order ${order.id}: ${err.message}`, err);
  }
}

function recordAttempt(engine, orderId, attempt) {
  const current = engine.get(orderId);
  const payoutAttempts = [...(current.data.payoutAttempts || []), attempt];
  engine.updateData(orderId, { payoutAttempts });
}

module.exports = { processPayout, PayoutError };
