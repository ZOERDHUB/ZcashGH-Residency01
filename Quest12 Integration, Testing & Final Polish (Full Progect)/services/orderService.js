/**
 * orderService.js — Quest 05: Create Transaction Orders
 *
 * This is intentionally a THIN layer on top of the Transaction Status
 * Engine already built in Quest 08 (models/transactionStatusEngine.js).
 * That engine already knows how to store a transaction, track its status,
 * and keep a history -- Quest 05 doesn't reinvent any of that.
 *
 * What Quest 05 actually adds:
 *   1. Validates that the payment + recipient details collected across
 *      Quests 01-04 are actually present.
 *   2. Attaches an expiration time to the order.
 *   3. Creates the order (which starts in CREATED, per the engine), then
 *      immediately moves it to AWAITING_ZEC -- because by the time an
 *      order exists here, the user has already picked an amount and a
 *      recipient. CREATED is a one-tick transient state on the way in,
 *      not something the user ever actually sees.
 */

const { generatePlaceholderAddress } = require('./zecAddressProvider');

const ORDER_EXPIRY_MINUTES = 30;

/**
 * @param {import('../models/transactionStatusEngine').TransactionStatusEngine} engine
 * @param {object} orderInput - { fiatCurrency, fiatAmount, zecAmount, rate, recipient }
 */
function createOrder(engine, orderInput = {}) {
  const { fiatCurrency, fiatAmount, zecAmount, rate, recipient } = orderInput;

  if (!fiatCurrency || !fiatAmount || !zecAmount || !recipient) {
    throw new Error(
      'Missing required order fields: fiatCurrency, fiatAmount, zecAmount, and recipient are all required.'
    );
  }

  const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const order = engine.create({
    fiatCurrency,
    fiatAmount,
    zecAmount,
    rate,
    recipient,
    expiresAt,
  });

  // The receiving address is tied to the order's own id, so it only
  // exists (and is only knowable) once the order itself does.
  const receivingAddress = generatePlaceholderAddress(order.id);
  engine.updateData(order.id, { receivingAddress });

  // CREATED -> AWAITING_ZEC, see the note above on why this happens
  // immediately rather than staying in CREATED.
  return engine.transition(order.id, 'AWAITING_ZEC');
}

module.exports = { createOrder, ORDER_EXPIRY_MINUTES };
