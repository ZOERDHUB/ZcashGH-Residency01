/**
 * conversion.js — Quest 02: ZEC conversion.
 *
 * Listens for the 'privatebill:fiat-input-changed' event from exchange.js
 * and, whenever the amount is valid, asks the backend for the ZEC
 * equivalent. Owns the "You send" box, the rate line, and the Continue
 * button — Continue only turns on once we have a real, matching quote.
 */

$(function () {
  const DEBOUNCE_MS = 400;
  const CURRENCY_LOCALE = {
    NGN: { locale: 'en-NG', currency: 'NGN' },
    GHS: { locale: 'en-GH', currency: 'GHS' },
  };

  const $zecAmount = $('#zec-amount');
  const $zecNote = $('#zec-note');
  const $rateLine = $('#rate-line');
  const $continueBtn = $('#continue-btn');

  let debounceTimer = null;
  let requestToken = 0; // guards against an older, slower request overwriting a newer one
  let latestQuote = null; // the last successful conversion result

  function formatZec(amount) {
    // Trim trailing zeros but keep it readable (up to 8 decimal places).
    return amount.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatFiat(amount, currency) {
    const { locale, currency: code } = CURRENCY_LOCALE[currency] || {};
    if (!locale) return `${amount} ${currency}`;
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(amount);
  }

  function setLoadingState() {
    $zecAmount.text('…');
    $zecNote.text('Calculating…');
    $rateLine.text('Fetching the current rate…');
    $continueBtn.prop('disabled', true);
  }

  function setIdleState() {
    $zecAmount.text('—');
    $zecNote.text('Calculated on the next step');
    $rateLine.text('Rate updates once you enter an amount');
    $continueBtn.prop('disabled', true);
    latestQuote = null;
  }

  function setErrorState(message) {
    $zecAmount.text('—');
    $zecNote.text(message);
    $rateLine.text('');
    $continueBtn.prop('disabled', true);
    latestQuote = null;
  }

  function setQuoteState(quote) {
    latestQuote = quote;
    $zecAmount.text(formatZec(quote.zecAmount));

    const staleWarning =
      quote.source === 'stale-cache' ? ' (rate may be a few minutes old)' : '';
    $zecNote.text(`This is the exact ZEC amount you'll be asked to send.${staleWarning}`);

    $rateLine.text(`1 ZEC ≈ ${formatFiat(quote.rate, quote.currency)}`);
    $continueBtn.prop('disabled', false);
  }

  function requestConversion(amount, currency) {
    const myToken = ++requestToken;
    setLoadingState();

    $.ajax({
      url: '/api/exchange/convert',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ amount, currency }),
    })
      .done(function (quote) {
        if (myToken !== requestToken) return; // a newer request has since started
        setQuoteState(quote);
      })
      .fail(function (xhr) {
        if (myToken !== requestToken) return;
        const message =
          (xhr.responseJSON && xhr.responseJSON.error) ||
          'Could not calculate the ZEC amount. Please try again.';
        setErrorState(message);
      });
  }

  $(document).on('privatebill:fiat-input-changed', function (event, detail) {
    clearTimeout(debounceTimer);

    if (!detail.isValid) {
      setIdleState();
      return;
    }

    debounceTimer = setTimeout(() => {
      requestConversion(detail.amount, detail.currency);
    }, DEBOUNCE_MS);
  });

  $continueBtn.on('click', function () {
    if (!latestQuote) return; // shouldn't happen, button is disabled until we have one

    PrivateBillState.update({
      currency: latestQuote.currency,
      fiatAmount: latestQuote.fiatAmount,
      zecAmount: latestQuote.zecAmount,
      rate: latestQuote.rate,
    });

    // Quest 03 (bank details form) will live at this URL once it's built.
    window.location.href = '/bank-details.html';
  });

  setIdleState();
});
