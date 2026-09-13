/**
 * Private Bill — bank reference data
 * -------------------------------------
 * Pure data, no logic. Kept separate from bankDetailsValidator.js so
 * the bank list can be updated (a bank renamed, a new one licensed)
 * without touching any validation code.
 *
 * Nigerian banks list their 3-digit CBN interbank code because it's
 * needed to validate a NUBAN account number's check digit (see
 * bankDetailsValidator.js). Ghana has no equivalent nationwide
 * check-digit standard — account number length varies by bank — so
 * Ghanaian banks are listed by name only.
 *
 * Sources: CBN/NIBSS-published bank codes (as compiled by
 * currentaffairs.com.ng/bank-codes, reviewed September 2026) and the
 * Bank of Ghana's list of licensed banks. See README for full
 * citations.
 */

const PB_BANKS = {
  NGN: [
    { name: "Access Bank", code: "044" },
    { name: "Citibank Nigeria", code: "023" },
    { name: "Ecobank Nigeria", code: "050" },
    { name: "Fidelity Bank", code: "070" },
    { name: "First Bank of Nigeria", code: "011" },
    { name: "First City Monument Bank (FCMB)", code: "214" },
    { name: "Guaranty Trust Bank (GTBank)", code: "058" },
    { name: "Jaiz Bank", code: "301" },
    { name: "Lotus Bank", code: "303" },
    { name: "PremiumTrust Bank", code: "105" },
    { name: "Providus Bank", code: "101" },
    { name: "Stanbic IBTC Bank", code: "221" },
    { name: "Standard Chartered Bank", code: "068" },
    { name: "Sterling Bank", code: "232" },
    { name: "TAJ Bank", code: "302" },
    { name: "United Bank for Africa (UBA)", code: "033" },
    { name: "Wema Bank / ALAT", code: "035" },
    { name: "Zenith Bank", code: "057" }
  ],

  // No CBN-style code needed — Ghana has no single nationwide
  // check-digit algorithm, so `code` is omitted rather than filled
  // with a placeholder that would look meaningful but isn't used.
  GHS: [
    { name: "Absa Bank Ghana" },
    { name: "Access Bank Ghana" },
    { name: "CalBank" },
    { name: "Consolidated Bank Ghana" },
    { name: "Ecobank Ghana" },
    { name: "Fidelity Bank Ghana" },
    { name: "First National Bank Ghana" },
    { name: "GCB Bank" },
    { name: "GT Bank Ghana" },
    { name: "Republic Bank Ghana" },
    { name: "Societe Generale Ghana" },
    { name: "Stanbic Bank Ghana" },
    { name: "Standard Chartered Ghana" },
    { name: "United Bank for Africa Ghana" },
    { name: "Zenith Bank Ghana" }
  ]
};

const PB_CURRENCY_COUNTRY = {
  NGN: "Nigeria",
  GHS: "Ghana"
};

function pbGetBanksForCurrency(currencyCode) {
  return PB_BANKS[currencyCode] || [];
}

function pbGetCountryForCurrency(currencyCode) {
  return PB_CURRENCY_COUNTRY[currencyCode] || null;
}

function pbFindBank(currencyCode, bankName) {
  return pbGetBanksForCurrency(currencyCode).find((b) => b.name === bankName) || null;
}

// Support both browser <script> usage and Node (for tests).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PB_BANKS, PB_CURRENCY_COUNTRY, pbGetBanksForCurrency, pbGetCountryForCurrency, pbFindBank };
}
