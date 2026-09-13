/**
 * Private Bill — deposit address generation (DEMO ONLY)
 * -------------------------------------------------------------
 * ⚠️ THIS DOES NOT GENERATE A REAL, FUNDED ZCASH ADDRESS. ⚠️
 *
 * Nothing in this prototype talks to a Zcash node, a wallet, or any
 * key-management system. This module produces a bech32-alphabet
 * string that *looks* like a Sapling shielded address (starts
 * "zs1…", roughly the right length) purely so the payment screen has
 * something realistic to display and let a user practice copying.
 * It is deterministic — the same order ID always yields the same
 * string — so an order's payment details stay stable across repeat
 * visits, but the string itself is never validated against, derived
 * from, or capable of controlling any real Zcash key. Sending real
 * ZEC to it would send those funds nowhere recoverable.
 *
 * Kept as its own module (not inlined into orderStore.js) so that
 * wiring this platform to a real address source later — a Zebra/
 * Zakura full node's `z_getnewaddress`, a wallet's HD derivation, or
 * a custodial provider's API — means replacing only this file's
 * export. Nothing in orderStore.js, app.js, or the UI needs to know
 * or care how the address was produced.
 */

const PB_DEPOSIT_ADDRESS = (() => {
  // The bech32 character set (Zcash's Sapling/Unified addresses use
  // this same alphabet), used here purely for visual authenticity —
  // no checksum is computed, so this is NOT a valid bech32 string.
  const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const ADDRESS_BODY_LENGTH = 75; // real Sapling addresses run ~78 chars total incl. prefix

  /** Simple deterministic string hash (FNV-1a), good enough to seed a PRNG — not cryptographic. */
  function hashString(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /** mulberry32 — a small, fast, deterministic PRNG seeded from a 32-bit integer. */
  function mulberry32(seed) {
    let a = seed;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Deterministically derives a demo address string from an order ID.
   * Same id in -> same address out, always. Different ids -> different
   * addresses (collision chance is negligible for this display-only
   * purpose, though not cryptographically guaranteed).
   *
   * @param {string} orderId
   * @returns {string} e.g. "zs1q9x8gf2tvdw0s3jn54khce6mua7lqpzry9x8gf2tvdw0s3jn54khce6mua7lqpzry9x"
   */
  function generateDepositAddress(orderId) {
    if (!orderId) throw new RangeError("generateDepositAddress requires an order id.");

    const rand = mulberry32(hashString(String(orderId)));
    let body = "";
    for (let i = 0; i < ADDRESS_BODY_LENGTH; i++) {
      body += BECH32_CHARSET[Math.floor(rand() * BECH32_CHARSET.length)];
    }
    return "zs1" + body;
  }

  return { generateDepositAddress };
})();

// Support both browser <script> usage and Node (for tests).
if (typeof module !== "undefined" && module.exports) {
  module.exports = PB_DEPOSIT_ADDRESS;
}
