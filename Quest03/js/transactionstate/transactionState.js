/**
 * Private Bill — transaction state
 * -------------------------------------
 * The single place that holds what's been confirmed so far in this
 * session: the exchange amount/rate, and the recipient's bank
 * details. Whatever Quest implements the actual ZEC payment/deposit
 * step reads from here rather than re-deriving or re-collecting
 * anything — that's what "available to the next transaction stage"
 * means concretely.
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
    exchange: null,   // { fiatAmount, currencyCode, totalZec, feeZec, effectiveRate, fetchedAt }
    recipient: null   // { country, bankName, accountNumber, accountName }
  };

  function setExchange(exchange) {
    state.exchange = { ...exchange };
  }

  function setRecipient(recipient) {
    state.recipient = { ...recipient };
  }

  function getExchange() {
    return state.exchange ? { ...state.exchange } : null;
  }

  function getRecipient() {
    return state.recipient ? { ...state.recipient } : null;
  }

  /**
   * The full payload the next transaction stage (ZEC deposit address
   * generation / payment execution) would consume. Includes the
   * un-masked account number deliberately — that stage needs the
   * real value to actually pay out to. UI code should use
   * getMaskedSummary() instead for anything rendered on screen after
   * the form is submitted.
   */
  function getPayload() {
    if (!state.exchange || !state.recipient) return null;
    return {
      exchange: getExchange(),
      recipient: getRecipient()
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
      }
    };
  }

  /** Explicit, safe-by-construction string for any future debug logging. */
  function toSafeLogString() {
    const summary = getMaskedSummary();
    return summary ? JSON.stringify(summary) : "(no transaction data yet)";
  }

  function reset() {
    state = { exchange: null, recipient: null };
  }

  return {
    setExchange,
    setRecipient,
    getExchange,
    getRecipient,
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
