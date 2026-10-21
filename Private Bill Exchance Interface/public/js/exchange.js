/**
 * exchange.js — Quest 01: the exchange interface.
 *
 * What this screen does:
 *   1. Let the user pick NGN or GHS.
 *   2. Let the user type the amount their recipient should receive.
 *   3. Validate that amount.
 *   4. Save the selection so the next screen (Quest 02, ZEC conversion)
 *      can pick up where this one left off.
 *
 * No ZEC math happens here on purpose — that's Quest 02's job. This screen
 * only collects and validates the fiat side.
 */

$(function () {
  const CURRENCY_SYMBOLS = {
    NGN: '₦',
    GHS: '₵',
  };

  const $currencyButtons = $('.currency-option');
  const $amountInput = $('#fiat-amount');
  const $amountError = $('#amount-error');
  const $currencySymbol = $('#currency-symbol');
  const $continueBtn = $('#continue-btn');

  let selectedCurrency = 'NGN';

  // Restore anything the user already entered, in case they came back here.
  const saved = PrivateBillState.get();
  if (saved.currency) {
    selectedCurrency = saved.currency;
  }
  if (saved.fiatAmount) {
    $amountInput.val(saved.fiatAmount);
  }

  function setActiveCurrencyButton() {
    $currencyButtons.each(function () {
      const isActive = $(this).data('currency') === selectedCurrency;
      $(this).toggleClass('is-active', isActive);
      $(this).attr('aria-checked', isActive ? 'true' : 'false');
    });
    $currencySymbol.text(CURRENCY_SYMBOLS[selectedCurrency]);
  }

  function getAmountValue() {
    return parseFloat($amountInput.val());
  }

  // A valid amount just needs to be a real number greater than zero.
  // (Minimums/maximums can be tightened later once the business rules
  // for NGN/GHS are confirmed — kept simple on purpose for now.)
  function validateAmount() {
    const amount = getAmountValue();

    if ($amountInput.val().trim() === '') {
      showError('');
      return false;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      showError('Enter an amount greater than zero.');
      return false;
    }

    hideError();
    return true;
  }

  function showError(message) {
    if (message) {
      $amountError.text(message).prop('hidden', false);
    } else {
      hideError();
    }
    $continueBtn.prop('disabled', true);
  }

  function hideError() {
    $amountError.text('').prop('hidden', true);
  }

  function updateContinueState() {
    const isValid = validateAmount();
    $continueBtn.prop('disabled', !isValid);
  }

  $currencyButtons.on('click', function () {
    selectedCurrency = $(this).data('currency');
    setActiveCurrencyButton();
    updateContinueState();
  });

  $amountInput.on('input', updateContinueState);

  $continueBtn.on('click', function () {
    if (!validateAmount()) return;

    PrivateBillState.update({
      currency: selectedCurrency,
      fiatAmount: getAmountValue(),
    });

    // Quest 02 (ZEC conversion) will live at this URL once it's built.
    window.location.href = '/conversion.html';
  });

  // Initial paint
  setActiveCurrencyButton();
  updateContinueState();
});
