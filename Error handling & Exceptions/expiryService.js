/**
 * expiryService.js — Quest 11: expired transactions.
 *
 * An order that's still AWAITING_ZEC past its expiresAt time should stop
 * being "waiting" and become EXPIRED. There's no background job/queue in
 * this project, so instead of a cron-style sweep, expiry is checked
 * lazily: any time an order is fetched, we first check whether it should
 * have expired, and flip it if so, before returning it. Simple, and
 * correct for a single-process app like this one.
 */

const { STATUS } = require('../models/transactionStatusEngine');

/**
 * Given an order, expire it if it's overdue. Returns the (possibly
 * updated) order either way.
 */
function expireIfNeeded(engine, orderId) {
  const order = engine.get(orderId);

  const isOverdue = order.data.expiresAt && new Date(order.data.expiresAt) < new Date();

  if (order.status === STATUS.AWAITING_ZEC && isOverdue) {
    return engine.transition(orderId, STATUS.EXPIRED, {
      reason: 'Order expired before ZEC was received.',
    });
  }

  return order;
}

module.exports = { expireIfNeeded };
