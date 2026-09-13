/**
 * Private Bill — transaction state
 * -------------------------------------
 * The single place that holds what's been confirmed so far in this
 * session: the exchange amount/rate, the recipient's bank details,
 * and (as of this Quest) whether the user has reviewed and confirmed
 * everything before an order is created. Whatever Quest implements
 * the actual order-creation step reads from here rather than
 * re-deriving or re-collecting anything — that's what "available to
 * the next transaction stage" means concretely.
 *
 * Deliberately in-memory only (a plain JS object), not localStorage
 * or sessionStorage: it holds a recipient's bank account number, and
 * writing that to persistent browser storage would keep it around
 * longer than this transaction needs, on a shared or public machine.
 * It's cleared automatically on page reload, same as never having
 * left the page in the first place.
 *
 * Sensitive-data handling: nothing in this file ever calls
 * console.log (or similar) with raw state. toSafeLogString() exists
 * specifically so any future debugging code has a redacted option
 * instead of reaching for the raw object.
 */

const PB_TRANSACTION = (() => {
  let state = {
    exchange: null,          // { fiatAmount, currencyCode, totalZec, feeZec, effectiveRate }
    recipient: null,         // { country, bankName, accountNumber, accountName }
    reviewConfirmedAt: null  // Date, set only once the user confirms the review screen
  };

  function setExchange(exchange) {
    state.exchange = { ...exchange };
    // Editing the amount after a review was confirmed invalidates
    // that confirmation — the user needs to review again before an
    // order can be created from the new figures.
    state.reviewConfirmedAt = null;
  }

  function setRecipient(recipient) {
    state.recipient = { ...recipient };
    state.reviewConfirmedAt = null;
  }

  /**
   * Clears only the recipient — used when the exchange currency
   * changes to one with a different country, making a previously
   * saved recipient (tied to the old country's bank list) no longer
   * applicable. Exchange data is left untouched.
   */
  function clearRecipient() {
    state.recipient = null;
    state.reviewConfirmedAt = null;
  }

  function getExchange() {
    return state.exchange ? { ...state.exchange } : null;
  }

  function getRecipient() {
    return state.recipient ? { ...state.recipient } : null;
  }

  /**
   * Marks the review stage as complete. Only meaningful once both
   * exchange and recipient data exist; returns false (and does
   * nothing) otherwise, so callers can't accidentally confirm a
   * review with missing information.
   */
  function confirmReview() {
    if (!state.exchange || !state.recipient) return false;
    state.reviewConfirmedAt = new Date();
    return true;
  }

  function isReviewConfirmed() {
    return state.reviewConfirmedAt !== null;
  }

  /**
   * The full payload the next transaction stage (order creation / ZEC
   * deposit address generation) would consume. Includes the
   * un-masked account number deliberately — that stage needs the
   * real value to actually pay out to. UI code should use
   * getMaskedSummary() instead for anything rendered on screen.
   */
  function getPayload() {
    if (!state.exchange || !state.recipient) return null;
    return {
      exchange: getExchange(),
      recipient: getRecipient(),
      reviewConfirmedAt: state.reviewConfirmedAt
    };
  }

  /**
   * A version of the current state safe to render in a confirmation
   * UI or write to a log: the account number is masked to its last 4
   * digits via PB_BANK_VALIDATOR, and nothing else about the
   * recipient is sensitive enough to need redacting.
   */
  function getMaskedSummary() {
    if (!state.exchange || !state.recipient) return null;
    const maskFn = (typeof PB_BANK_VALIDATOR !== "undefined" && PB_BANK_VALIDATOR.maskAccountNumber)
      || ((v) => v.replace(/.(?=.{4})/g, "•")); // fallback if loaded standalone
    return {
      exchange: getExchange(),
      recipient: {
        ...getRecipient(),
        accountNumber: maskFn(state.recipient.accountNumber)
      },
      reviewConfirmedAt: state.reviewConfirmedAt
    };
  }

  /** Explicit, safe-by-construction string for any future debug logging. */
  function toSafeLogString() {
    const summary = getMaskedSummary();
    return summary ? JSON.stringify(summary) : "(no transaction data yet)";
  }

  function reset() {
    state = { exchange: null, recipient: null, reviewConfirmedAt: null };
  }

  return {
    setExchange,
    setRecipient,
    clearRecipient,
    getExchange,
    getRecipient,
    confirmReview,
    isReviewConfirmed,
    getPayload,
    getMaskedSummary,
    toSafeLogString,
    reset
  };
})();

// Support both browser <script> usage and Node (for tests).
if (typeof module !== "undefined" && module.exports) {
  module.exports = PB_TRANSACTION;
}
