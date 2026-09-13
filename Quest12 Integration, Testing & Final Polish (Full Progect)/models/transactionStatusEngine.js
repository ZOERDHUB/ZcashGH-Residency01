/**
 * Transaction Status Engine
 * Quest 08 — Build My Crypto (Zcash Privacy Developers Residency)
 *
 * Owns the lifecycle of a single transaction/order as it moves from
 * "just created" through to "completed" (or one of several exception states).
 *
 * This module is intentionally storage-agnostic: it keeps transactions in
 * memory (a Map) for now. Swap `this.store` for a real DB-backed repository
 * later without touching the transition logic below.
 */

const { randomUUID } = require('crypto');

// --- Status catalogue -------------------------------------------------

const STATUS = Object.freeze({
  CREATED: 'CREATED',
  AWAITING_ZEC: 'AWAITING_ZEC',
  ZEC_DETECTED: 'ZEC_DETECTED',
  CONFIRMING: 'CONFIRMING',
  ZEC_CONFIRMED: 'ZEC_CONFIRMED',
  PAYOUT_PROCESSING: 'PAYOUT_PROCESSING',
  FIAT_SENT: 'FIAT_SENT',
  COMPLETED: 'COMPLETED',
  // Exception states
  EXPIRED: 'EXPIRED',
  UNDERPAID: 'UNDERPAID',
  OVERPAID: 'OVERPAID',
  PAYOUT_FAILED: 'PAYOUT_FAILED',
  CANCELLED: 'CANCELLED',
});

// Terminal states can never transition further.
const TERMINAL_STATUSES = new Set([
  STATUS.COMPLETED,
  STATUS.EXPIRED,
  STATUS.CANCELLED,
]);

// --- Valid transition graph --------------------------------------------
// Adjust this table as the real payment/payout quests land — it's the
// single source of truth for "what can happen next."
const TRANSITIONS = {
  [STATUS.CREATED]: [STATUS.AWAITING_ZEC, STATUS.CANCELLED],
  [STATUS.AWAITING_ZEC]: [STATUS.ZEC_DETECTED, STATUS.EXPIRED, STATUS.CANCELLED],
  [STATUS.ZEC_DETECTED]: [STATUS.CONFIRMING, STATUS.UNDERPAID, STATUS.OVERPAID],
  [STATUS.CONFIRMING]: [STATUS.ZEC_CONFIRMED, STATUS.UNDERPAID, STATUS.OVERPAID],
  [STATUS.ZEC_CONFIRMED]: [STATUS.PAYOUT_PROCESSING],
  [STATUS.PAYOUT_PROCESSING]: [STATUS.FIAT_SENT, STATUS.PAYOUT_FAILED],
  [STATUS.FIAT_SENT]: [STATUS.COMPLETED],
  [STATUS.COMPLETED]: [],
  [STATUS.EXPIRED]: [],
  [STATUS.CANCELLED]: [],
  // Recovery paths out of exception states — tune to match product rules.
  [STATUS.UNDERPAID]: [STATUS.AWAITING_ZEC, STATUS.CANCELLED, STATUS.EXPIRED],
  [STATUS.OVERPAID]: [STATUS.CONFIRMING, STATUS.CANCELLED],
  [STATUS.PAYOUT_FAILED]: [STATUS.PAYOUT_PROCESSING, STATUS.CANCELLED],
};

class InvalidTransitionError extends Error {
  constructor(from, to) {
    super(`Invalid transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

class TransactionNotFoundError extends Error {
  constructor(id) {
    super(`Transaction not found: ${id}`);
    this.name = 'TransactionNotFoundError';
    this.id = id;
  }
}

class TransactionStatusEngine {
  constructor() {
    /** @type {Map<string, object>} */
    this.store = new Map();
  }

  /**
   * Create a new transaction in the CREATED state.
   * @param {object} data - order details (amounts, addresses, recipient info, etc.)
   * @returns {object} the newly created transaction record
   */
  create(data = {}) {
    const id = data.id || randomUUID();
    const now = new Date().toISOString();

    const transaction = {
      id,
      status: STATUS.CREATED,
      data: { ...data, id },
      timestamps: {
        [STATUS.CREATED]: now,
      },
      history: [{ status: STATUS.CREATED, at: now, meta: null }],
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(id, transaction);
    return this._clone(transaction);
  }

  /**
   * Fetch a transaction by id.
   */
  get(id) {
    const tx = this.store.get(id);
    if (!tx) throw new TransactionNotFoundError(id);
    return this._clone(tx);
  }

  /**
   * List all transactions (optionally filtered by status).
   */
  list({ status } = {}) {
    const all = [...this.store.values()];
    const filtered = status ? all.filter((t) => t.status === status) : all;
    return filtered.map((t) => this._clone(t));
  }

  /**
   * Merge extra fields into a transaction's data after it's been created --
   * e.g. attaching a ZEC receiving address once one has been generated.
   * Doesn't touch status or history; use transition() for that.
   */
  updateData(id, patch = {}) {
    const tx = this.store.get(id);
    if (!tx) throw new TransactionNotFoundError(id);

    tx.data = { ...tx.data, ...patch };
    tx.updatedAt = new Date().toISOString();

    return this._clone(tx);
  }

  /**
   * Attempt to move a transaction to a new status.
   * Throws InvalidTransitionError if the move isn't allowed.
   * @param {string} id
   * @param {string} toStatus
   * @param {object} [meta] - optional context (e.g. { reason, amountReceived })
   */
  transition(id, toStatus, meta = null) {
    const tx = this.store.get(id);
    if (!tx) throw new TransactionNotFoundError(id);

    if (!Object.values(STATUS).includes(toStatus)) {
      throw new InvalidTransitionError(tx.status, toStatus);
    }

    if (TERMINAL_STATUSES.has(tx.status)) {
      throw new InvalidTransitionError(tx.status, toStatus);
    }

    const allowed = TRANSITIONS[tx.status] || [];
    if (!allowed.includes(toStatus)) {
      throw new InvalidTransitionError(tx.status, toStatus);
    }

    const now = new Date().toISOString();
    tx.status = toStatus;
    tx.timestamps[toStatus] = now;
    tx.updatedAt = now;
    tx.history.push({ status: toStatus, at: now, meta });

    this.store.set(id, tx);
    return this._clone(tx);
  }

  /**
   * True/false check without throwing — handy for UI-side validation.
   */
  canTransition(id, toStatus) {
    const tx = this.store.get(id);
    if (!tx) return false;
    if (TERMINAL_STATUSES.has(tx.status)) return false;
    return (TRANSITIONS[tx.status] || []).includes(toStatus);
  }

  isTerminal(status) {
    return TERMINAL_STATUSES.has(status);
  }

  _clone(tx) {
    // Defensive copy so callers can't mutate internal state directly.
    return JSON.parse(JSON.stringify(tx));
  }
}

module.exports = {
  TransactionStatusEngine,
  STATUS,
  TRANSITIONS,
  TERMINAL_STATUSES,
  InvalidTransitionError,
  TransactionNotFoundError,
};
