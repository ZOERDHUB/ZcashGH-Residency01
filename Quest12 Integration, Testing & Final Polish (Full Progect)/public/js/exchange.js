/**
 * exchange.js — Quest 01: currency + amount selection.
 *
 * Owns the "Recipient receives" side only: picking NGN/GHS, validating the
 * amount, and showing inline errors. It doesn't know anything about ZEC or
 * conversion rates — it just announces changes via a custom event, and
 * conversion.js (Quest 02) listens for that and does the ZEC math.
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
  function validateAmount() {
    const raw = $amountInput.val().trim();
    const amount = getAmountValue();

    if (raw === '') {
      hideError();
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
    $amountError.text(message).prop('hidden', false);
  }

  function hideError() {
    $amountError.text('').prop('hidden', true);
  }

  function announceChange() {
    const isValid = validateAmount();
    $(document).trigger('privatebill:fiat-input-changed', {
      currency: selectedCurrency,
      amount: getAmountValue(),
      isValid,
    });
  }

  $currencyButtons.on('click', function () {
    selectedCurrency = $(this).data('currency');
    setActiveCurrencyButton();
    announceChange();
  });

  $amountInput.on('input', announceChange);

  // Initial paint
  setActiveCurrencyButton();
  announceChange();
});
