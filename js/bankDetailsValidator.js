/**
 * Private Bill — recipient bank-details validation
 * ------------------------------------------------------
 * Pure functions only: no DOM access, no fetch calls, no dependency
 * on where the data came from or where it's going. Same pattern as
 * converter.js — this is what makes it separately unit-testable
 * (see tests/bankDetailsValidator.test.js) and reusable if this
 * validation is ever needed outside the browser (a backend
 * re-validation step before a real payout, for instance).
 */

// In the browser, banks.js is loaded first via <script> and
// pbFindBank already exists as a global. Under Node (tests), pull it
// in explicitly instead of relying on script load order.
if (typeof module !== "undefined" && typeof pbFindBank === "undefined") {
  var { pbFindBank } = require("./banks.js");
}

const PB_BANK_VALIDATOR = (() => {
  const NUBAN_WEIGHTS = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];

  /**
   * Computes the CBN NUBAN check digit for a given 3-digit bank code
   * and 9-digit account serial number.
   * Reference: CBN "Revised Standards on NUBAN" specification.
   */
  function computeNubanCheckDigit(bankCode, serial9) {
    const input = (bankCode + serial9).split("").map(Number);
    const sum = input.reduce((acc, digit, i) => acc + digit * NUBAN_WEIGHTS[i], 0);
    return (10 - (sum % 10)) % 10;
  }

  /**
   * Validates a 10-digit NUBAN against a specific bank's CBN code.
   * Returns true only if the format is correct AND the check digit
   * matches — this catches most typos (a single mistyped digit will
   * almost always fail the checksum), not just wrong length.
   */
  function isValidNuban(accountNumber, bankCode) {
    if (!/^\d{10}$/.test(accountNumber)) return false;
    const serial9 = accountNumber.slice(0, 9);
    const checkDigit = Number(accountNumber[9]);
    return computeNubanCheckDigit(bankCode, serial9) === checkDigit;
  }

  /**
   * Ghana has no nationwide check-digit standard — account number
   * length varies by bank (e.g. Absa Ghana uses 7 digits plus a
   * separate branch code; others differ). This validates only that
   * the value is plausible: digits only, within a generous length
   * range covering documented formats.
   */
  function isPlausibleGhanaianAccountNumber(accountNumber) {
    return /^\d{7,17}$/.test(accountNumber);
  }

  /**
   * @param {string} rawAccountNumber
   * @param {"NGN"|"GHS"} currencyCode
   * @param {string} [bankCode] - required for NGN, ignored for GHS
   * @returns {string|null} an error message, or null if valid
   */
  function validateAccountNumber(rawAccountNumber, currencyCode, bankCode) {
    const value = (rawAccountNumber || "").trim();

    if (!value) return "Account number is required.";
    if (!/^\d+$/.test(value)) return "Account number must contain digits only.";

    if (currencyCode === "NGN") {
      if (!bankCode) return "Select a bank before entering the account number.";
      if (value.length !== 10) return "A Nigerian account number (NUBAN) must be exactly 10 digits.";
      if (!isValidNuban(value, bankCode)) {
        return "This account number doesn't check out for the selected bank — double-check the digits and the bank.";
      }
      return null;
    }

    if (currencyCode === "GHS") {
      if (!isPlausibleGhanaianAccountNumber(value)) {
        return "Enter a valid Ghanaian account number (7–17 digits).";
      }
      return null;
    }

    return "Unsupported currency.";
  }

  /**
   * Account holder name: letters (including accented characters),
   * spaces, hyphens, and apostrophes only — covers the overwhelming
   * majority of real names without accepting obvious junk input.
   */
  function validateAccountName(rawName) {
    const value = (rawName || "").trim();

    if (!value) return "Account name is required.";
    if (value.length < 3) return "Account name looks too short — enter the full name on the account.";
    if (value.length > 70) return "Account name is too long.";
    if (!/^[\p{L}][\p{L}\s'\-.]*$/u.test(value)) {
      return "Account name can only contain letters, spaces, hyphens, and apostrophes.";
    }
    return null;
  }

  /**
   * @param {string} bankName
   * @param {"NGN"|"GHS"} currencyCode
   */
  function validateBank(bankName, currencyCode) {
    if (!bankName) return "Select a bank.";
    const bank = pbFindBank(currencyCode, bankName);
    if (!bank) return "Select a bank from the list.";
    return null;
  }

  /**
   * Validates the full recipient bank-details form at once.
   * @returns {{ valid: boolean, errors: Object<string,string> }}
   *   errors is keyed by field name; only invalid fields are present.
   */
  function validateBankDetails({ bankName, accountNumber, accountName, currencyCode }) {
    const errors = {};

    const bankError = validateBank(bankName, currencyCode);
    if (bankError) errors.bankName = bankError;

    const bank = pbFindBank(currencyCode, bankName);
    const accountNumberError = validateAccountNumber(accountNumber, currencyCode, bank && bank.code);
    if (accountNumberError) errors.accountNumber = accountNumberError;

    const accountNameError = validateAccountName(accountName);
    if (accountNameError) errors.accountName = accountNameError;

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /**
   * Masks an account number for display after it's been confirmed —
   * e.g. in a summary or receipt view — showing only the last 4
   * digits. Never used while the user is actively editing the field
   * (they need to see what they typed to catch mistakes); only once
   * the details are saved and shown back in a read-only context.
   */
  function maskAccountNumber(accountNumber) {
    const value = (accountNumber || "").trim();
    if (value.length <= 4) return value;
    return "•".repeat(value.length - 4) + value.slice(-4);
  }

  return {
    isValidNuban,
    computeNubanCheckDigit,
    validateAccountNumber,
    validateAccountName,
    validateBank,
    validateBankDetails,
    maskAccountNumber
  };
})();

// Support both browser <script> usage and Node (for tests).
if (typeof module !== "undefined" && module.exports) {
  module.exports = PB_BANK_VALIDATOR;
}
