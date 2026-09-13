/**
 * zecAddressProvider.js
 *
 * PLACEHOLDER. This does NOT generate a real, usable Zcash address — there
 * is no private key behind what this returns, and nothing sent to it would
 * actually be recoverable. It exists purely so the rest of the app (order
 * creation, payment instructions) has *something* shaped like an address
 * to work with while real wallet integration isn't available yet.
 *
 * In production, this function would be replaced with a call to a real
 * Zcash wallet/node (this project's original plan was to use "Zakura" for
 * this, currently paused) to derive one fresh, real shielded address per
 * order. Everything downstream of this file (orderService, the payment
 * instructions page) only cares that it gets *a* string back — swapping
 * this out later shouldn't require touching anything else.
 */

const crypto = require('crypto');

/**
 * Deterministically derive a placeholder address from an order id, so the
 * "same order always shows the same address" requirement holds even
 * though this isn't a real address.
 */
function generatePlaceholderAddress(orderId) {
  const hash = crypto.createHash('sha256').update(orderId).digest('hex');
  // Sapling shielded addresses start with "zs1" -- mimicking the shape
  // only so the UI looks realistic, not because this is a valid one.
  return `zs1${hash.slice(0, 38)}`;
}

module.exports = { generatePlaceholderAddress };
