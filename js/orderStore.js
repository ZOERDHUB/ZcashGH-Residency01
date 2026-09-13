/**
 * Private Bill — order store
 * -------------------------------
 * Confirming the transaction review (Quest 4) produces a draft in
 * transactionState.js. This module is what turns that draft into a
 * distinct, trackable ORDER: something with its own identifier,
 * status lifecycle, creation time, and expiry — independent of
 * whatever the user does next in the UI.
 *
 * That distinction matters: a draft can still be edited (Quest 4's
 * whole point); an order, once created, is a fixed record of what
 * was agreed at that moment. This module never lets an order's core
 * financial figures change after creation — only its status does.
 *
 * PERSISTENCE, HONESTLY STATED: orders live in an in-memory Map, not
 * localStorage/sessionStorage. Two reasons, not one:
 *   1. An order carries the same recipient bank account number
 *      transactionState.js already avoids writing to persistent
 *      browser storage, for the same shared/public-machine reasoning
 *      documented there.
 *   2. A real "persistent, trackable order" — one that survives a
 *      closed tab, a different device, or a crashed browser — needs a
 *      server-side database and an authoritative backend, not a
 *      client-side cache pretending to be one. Simulating durability
 *      with localStorage here would look more production-ready than
 *      it is.
 * What this module gives instead is the exact interface a real
 * backend-backed store would expose (create / get / update status /
 * check expiry), so wiring it to an actual API later is a matter of
 * reimplementing these functions against real HTTP calls — nothing
 * that reads from PB_ORDER_STORE elsewhere in the app would need to
 * change.
 */

// In the browser, config.js is loaded first via <script> and
// PB_CONFIG already exists as a global. Under Node (tests), pull it
// in explicitly instead of relying on script load order.
//
// NOTE: this deliberately assigns to `global`, not `var { PB_CONFIG }
// = require(...)`. A `var` declaration here would be hoisted to the
// top of this script regardless of whether this branch runs, and in
// the browser that collides with config.js's `const PB_CONFIG` in the
// shared top-level scope ("Identifier 'PB_CONFIG' has already been
// declared") even though this line never executes there.
if (typeof module !== "undefined" && typeof PB_CONFIG === "undefined") {
  global.PB_CONFIG = require("./config.js").PB_CONFIG;
}
if (typeof module !== "undefined" && typeof PB_DEPOSIT_ADDRESS === "undefined") {
  global.PB_DEPOSIT_ADDRESS = require("./depositAddress.js");
}

const PB_ORDER_STATUS = Object.freeze({
  AWAITING_ZEC: "AWAITING_ZEC",   // initial state — waiting for the sender's ZEC deposit
  ZEC_RECEIVED: "ZEC_RECEIVED",   // deposit detected, awaiting confirmations (future Quest)
  PROCESSING_PAYOUT: "PROCESSING_PAYOUT", // sending fiat to the recipient bank (future Quest)
  COMPLETED: "COMPLETED",         // payout sent — terminal
  EXPIRED: "EXPIRED",             // order window elapsed before ZEC arrived — terminal
  CANCELLED: "CANCELLED"          // cancelled before completion — terminal
});

const PB_TERMINAL_STATUSES = Object.freeze([
  PB_ORDER_STATUS.COMPLETED,
  PB_ORDER_STATUS.EXPIRED,
  PB_ORDER_STATUS.CANCELLED
]);

const PB_ORDER_STORE = (() => {
  const orders = new Map();

  function isValidStatus(status) {
    return Object.values(PB_ORDER_STATUS).includes(status);
  }

  function isTerminalStatus(status) {
    return PB_TERMINAL_STATUSES.includes(status);
  }

  /**
   * Generates a unique, reasonably human-shareable order ID. Uses
   * crypto.randomUUID() where available (all modern browsers) for
   * genuine uniqueness; falls back to a timestamp+random scheme in
   * environments without it (e.g. this file's own Node test run).
   */
  function generateOrderId() {
    const hasCrypto = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
    const raw = hasCrypto
      ? crypto.randomUUID().split("-")[0]
      : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    return "PB-" + raw.toUpperCase();
  }

  /**
   * Creates a new order from a confirmed transaction payload (the
   * exact shape PB_TRANSACTION.getPayload() returns). Returns null —
   * creating nothing — if the payload is missing either half, so a
   * caller can't accidentally create an order for an unconfirmed or
   * incomplete transaction.
   *
   * @param {{exchange: object, recipient: object}} payload
   * @returns {object|null} the created order (a copy), or null
   */
  function createOrder(payload) {
    if (!payload || !payload.exchange || !payload.recipient) return null;

    const id = generateOrderId();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + PB_CONFIG.orderExpiryMs);

    const order = {
      id,
      status: PB_ORDER_STATUS.AWAITING_ZEC,
      createdAt,
      expiresAt,
      currencyCode: payload.exchange.currencyCode,
      fiatAmount: payload.exchange.fiatAmount,
      zecAmount: payload.exchange.totalZec,
      effectiveRate: payload.exchange.effectiveRate,
      feeZec: payload.exchange.feeZec,
      // Generated once, here, and never again — the same order must
      // always show the same payment details (Quest 6's "must
      // correspond to the correct transaction" requirement). See
      // depositAddress.js for why this is a DEMO address only.
      depositAddress: PB_DEPOSIT_ADDRESS.generateDepositAddress(id),
      recipient: { ...payload.recipient }
    };

    orders.set(id, order);
    return { ...order, recipient: { ...order.recipient } };
  }

  /** @returns {object|null} a copy of the order, or null if unknown */
  function getOrder(id) {
    const order = orders.get(id);
    return order ? { ...order, recipient: { ...order.recipient } } : null;
  }

  /**
   * Transitions an order to a new status. Refuses (returns null,
   * changes nothing) if the order doesn't exist, the status isn't a
   * recognized value, or the order is already in a terminal state —
   * a completed, expired, or cancelled order never changes again.
   */
  function updateStatus(id, newStatus) {
    const order = orders.get(id);
    if (!order) return null;
    if (!isValidStatus(newStatus)) return null;
    if (isTerminalStatus(order.status)) return null;

    order.status = newStatus;
    orders.set(id, order);
    return { ...order, recipient: { ...order.recipient } };
  }

  /**
   * Whether an order's rate lock has elapsed. Takes an optional `now`
   * (defaults to the real current time) so this is testable without
   * waiting or mocking global time.
   */
  function isExpired(order, now = new Date()) {
    if (!order) return false;
    return now.getTime() >= order.expiresAt.getTime();
  }

  /**
   * Convenience: checks expiry and, if due, transitions the order to
   * EXPIRED in the same call. Safe to call repeatedly (e.g. from a
   * UI countdown timer) — does nothing once the order is already in
   * any terminal state.
   */
  function expireIfDue(id, now = new Date()) {
    const order = orders.get(id);
    if (!order) return null;
    if (isTerminalStatus(order.status)) return { ...order, recipient: { ...order.recipient } };
    if (isExpired(order, now)) {
      return updateStatus(id, PB_ORDER_STATUS.EXPIRED);
    }
    return { ...order, recipient: { ...order.recipient } };
  }

  /**
   * A version of the order safe to render on screen: the account
   * number masked to its last 4 digits, same convention as
   * transactionState.js's getMaskedSummary().
   */
  function getMaskedOrder(id) {
    const order = getOrder(id);
    if (!order) return null;
    const maskFn = (typeof PB_BANK_VALIDATOR !== "undefined" && PB_BANK_VALIDATOR.maskAccountNumber)
      || ((v) => v.replace(/.(?=.{4})/g, "•"));
    return {
      ...order,
      recipient: { ...order.recipient, accountNumber: maskFn(order.recipient.accountNumber) }
    };
  }

  /** Test/dev only — clears every order. Never called from app.js. */
  function resetStore() {
    orders.clear();
  }

  return {
    createOrder,
    getOrder,
    updateStatus,
    isExpired,
    expireIfDue,
    getMaskedOrder,
    isTerminalStatus,
    resetStore
  };
})();

// Support both browser <script> usage and Node (for tests).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PB_ORDER_STORE, PB_ORDER_STATUS, PB_TERMINAL_STATUSES };
}
