/**
 * state.js
 *
 * Very small helper for passing the in-progress transaction between pages
 * (exchange -> conversion -> bank details -> review -> order).
 *
 * We use localStorage because there's no logged-in "session" yet in this
 * project — it's just carrying draft form data from one screen to the next
 * on the same device. Nothing sensitive should live here long-term; once
 * Quest 05 (Create Transaction Orders) exists, the order itself should be
 * the source of truth on the server, not this local draft.
 */

const PrivateBillState = {
  KEY: 'privateBillDraft',

  /** Read the current draft (or an empty object if there isn't one yet). */
  get() {
    const raw = localStorage.getItem(this.KEY);
    return raw ? JSON.parse(raw) : {};
  },

  /** Merge new fields into the draft and save it. */
  update(fields) {
    const current = this.get();
    const next = { ...current, ...fields };
    localStorage.setItem(this.KEY, JSON.stringify(next));
    return next;
  },

  /** Clear the draft (call this once a real order has been created). */
  clear() {
    localStorage.removeItem(this.KEY);
  },
};
