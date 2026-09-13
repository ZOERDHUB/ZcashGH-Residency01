/**
 * mockPayoutProvider.js
 *
 * A controlled sandbox stand-in for a real fiat payout provider (e.g.
 * Paystack Transfers, Flutterwave Transfers). No production provider has
 * been approved/configured for this project yet, so this is what
 * payoutService.js uses instead -- exactly as Quest 09 allows.
 *
 * No real money moves here, and there are no real API credentials
 * anywhere in this file (there's nothing to leak, on purpose).
 *
 * Test convention, similar to how real payment sandboxes work: an account
 * number of all zeros ('0000000000') is treated as a guaranteed failure,
 * so the failure path can actually be exercised without needing a real
 * provider's sandbox test data.
 */

const providerName = 'mock-sandbox';

async function initiatePayout({ amount, currency, recipient, orderId }) {
  // Simulate the provider taking a moment to respond.
  await new Promise((resolve) => setTimeout(resolve, 150));

  if (recipient.accountNumber === '0000000000') {
    const error = new Error('Recipient account could not be validated by the payout provider.');
    error.code = 'PAYOUT_PROVIDER_REJECTED';
    throw error;
  }

  return {
    success: true,
    providerReference: `mock_${orderId}_${Date.now()}`,
  };
}

module.exports = { initiatePayout, providerName };
