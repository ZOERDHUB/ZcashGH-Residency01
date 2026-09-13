/**
 * exceptionMessages.js — Quest 11.
 *
 * One shared place for "what does this status mean to the user," so
 * payment-instructions.js and track.js show the same wording instead of
 * each maintaining their own copy of it.
 */

const PrivateBillExceptionMessages = {
  EXPIRED: 'This order expired before payment was received.',
  UNDERPAID: 'The ZEC received was less than required for this order.',
  OVERPAID: 'The ZEC received was more than required for this order.',
  PAYOUT_FAILED: 'The fiat payout failed and is awaiting retry.',
  CANCELLED: 'This order was cancelled.',

  get(status) {
    return this[status] || null;
  },
};
