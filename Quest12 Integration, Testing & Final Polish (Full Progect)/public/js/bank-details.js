/**
 * bank-details.js — Quest 03: recipient bank details.
 *
 * Collects bank, account number, and account name for the recipient.
 * Validation rules are intentionally simple format checks (not live bank
 * verification, e.g. via a NUBAN-lookup API) -- that's a reasonable future
 * upgrade, but out of scope for this quest.
 *
 * IMPORTANT: we never console.log the account number or account name
 * anywhere in this file. If you add debugging later, keep it that way --
 * this is exactly the kind of data that shouldn't end up in logs.
 */

$(function () {
  // Bank lists are illustrative, not exhaustive -- easy to extend later.
  const BANKS_BY_CURRENCY = {
    NGN: [
      'Access Bank', 'GTBank', 'Zenith Bank', 'First Bank of Nigeria',
      'United Bank for Africa (UBA)', 'Fidelity Bank', 'Union Bank',
      'Stanbic IBTC', 'Ecobank Nigeria', 'FCMB', 'Wema Bank',
      'Sterling Bank', 'Kuda Bank', 'Opay', 'PalmPay', 'Moniepoint',
    ],
    GHS: [
      'GCB Bank', 'Ecobank Ghana', 'Absa Bank Ghana', 'Stanbic Bank Ghana',
      'Fidelity Bank Ghana', 'Zenith Bank Ghana', 'CalBank',
      'Access Bank Ghana', 'Republic Bank Ghana', 'Consolidated Bank Ghana',
      'ADB Bank', 'Universal Merchant Bank',
    ],
  };

  // Account number length rules, by currency's country.
  // NGN: Nigeria's NUBAN standard is a fixed 10 digits.
  // GHS: Ghanaian banks don't share one fixed length, so we allow a
  // reasonable range instead of a single exact number.
  const ACCOUNT_NUMBER_RULES = {
    NGN: { test: (v) => /^\d{10}$/.test(v), message: 'Nigerian account numbers are 10 digits.' },
    GHS: {
      test: (v) => /^\d{8,17}$/.test(v),
      message: 'Enter a valid account number (8-17 digits).',
    },
  };

  const ACCOUNT_NAME_PATTERN = /^[A-Za-z][A-Za-z' -]{1,}$/;

  const $contextSummary = $('#context-summary');
  const $contextFiat = $('#context-fiat');
  const $contextZec = $('#context-zec');
  const $bankSelect = $('#bank-select');
  const $bankError = $('#bank-error');
  const $accountNumber = $('#account-number');
  const $accountNumberError = $('#account-number-error');
  const $accountName = $('#account-name');
  const $accountNameError = $('#account-name-error');
  const $continueBtn = $('#continue-btn');

  const draft = PrivateBillState.get();

  // Can't collect bank details for a transaction that doesn't have an
  // amount and currency yet -- send the user back to start that.
  if (!draft.currency || !draft.fiatAmount || !draft.zecAmount) {
    window.location.href = '/index.html';
    return;
  }

  renderContextSummary(draft);
  populateBankOptions(draft.currency);
  restorePreviousEntry(draft);
  wireValidation();
  updateContinueState();

  function renderContextSummary(state) {
    const fiatFormatted = formatFiat(state.fiatAmount, state.currency);
    $contextFiat.text(fiatFormatted);
    $contextZec.text(`${formatZec(state.zecAmount)} ZEC`);
    $contextSummary.prop('hidden', false);
  }

  function formatFiat(amount, currency) {
    const localeByCurrency = { NGN: 'en-NG', GHS: 'en-GH' };
    const locale = localeByCurrency[currency];
    if (!locale) return `${amount} ${currency}`;
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  }

  function formatZec(amount) {
    return Number(amount).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  }

  function populateBankOptions(currency) {
    const banks = BANKS_BY_CURRENCY[currency] || [];
    banks.forEach((bankName) => {
      $bankSelect.append($('<option></option>').val(bankName).text(bankName));
    });
  }

  function restorePreviousEntry(state) {
    if (state.bankDetails) {
      $bankSelect.val(state.bankDetails.bankName);
      $accountNumber.val(state.bankDetails.accountNumber);
      $accountName.val(state.bankDetails.accountName);
    }
  }

  function wireValidation() {
    $bankSelect.on('change', updateContinueState);
    $accountNumber.on('input', updateContinueState);
    $accountName.on('input', updateContinueState);
    $continueBtn.on('click', handleContinue);
  }

  function validateBank() {
    const value = $bankSelect.val();
    if (!value) {
      showError($bankError, 'Select the recipient\'s bank.');
      return false;
    }
    hideError($bankError);
    return true;
  }

  function validateAccountNumber() {
    const value = $accountNumber.val().trim();
    const rule = ACCOUNT_NUMBER_RULES[draft.currency];

    if (value === '') {
      hideError($accountNumberError);
      return false;
    }
    if (!rule.test(value)) {
      showError($accountNumberError, rule.message);
      return false;
    }
    hideError($accountNumberError);
    return true;
  }

  function validateAccountName() {
    const value = $accountName.val().trim();

    if (value === '') {
      hideError($accountNameError);
      return false;
    }
    if (!ACCOUNT_NAME_PATTERN.test(value)) {
      showError(
        $accountNameError,
        'Enter the name as it appears on the account (letters only).'
      );
      return false;
    }
    hideError($accountNameError);
    return true;
  }

  function updateContinueState() {
    const isValid = validateBank() & validateAccountNumber() & validateAccountName();
    // (bitwise `&` intentionally combines all three checks without
    // short-circuiting, so every field's error message gets a chance to show)
    $continueBtn.prop('disabled', !isValid);
  }

  function showError($el, message) {
    $el.text(message).prop('hidden', false);
  }

  function hideError($el) {
    $el.text('').prop('hidden', true);
  }

  function handleContinue() {
    // Re-validate on click too, in case the button state is ever stale.
    if (!validateBank() || !validateAccountNumber() || !validateAccountName()) {
      return;
    }

    PrivateBillState.update({
      bankDetails: {
        bankName: $bankSelect.val(),
        accountNumber: $accountNumber.val().trim(),
        accountName: $accountName.val().trim(),
      },
    });

    // Quest 04 (transaction review) will live at this URL once it's built.
    window.location.href = '/review.html';
  }
});
