/**
 * track.js — Quest 10: Transaction Tracking UI.
 *
 * Renders the "core flow" from models/transactionStatusEngine.js as a
 * step-by-step progress tracker, and polls the real order endpoint every
 * few seconds so the status shown here is always what the server actually
 * has -- never a simulated/fake progression.
 */

$(function () {
  const POLL_INTERVAL_MS = 5000;

  // The main happy-path stages, in order, with a human-friendly label.
  // Keep this in sync with STATUS in models/transactionStatusEngine.js.
  const HAPPY_PATH = [
    { status: 'AWAITING_ZEC', label: 'Waiting for ZEC' },
    { status: 'ZEC_DETECTED', label: 'Payment detected' },
    { status: 'CONFIRMING', label: 'Confirming' },
    { status: 'ZEC_CONFIRMED', label: 'ZEC confirmed' },
    { status: 'PAYOUT_PROCESSING', label: 'Processing payout' },
    { status: 'FIAT_SENT', label: 'Fiat sent' },
    { status: 'COMPLETED', label: 'Completed' },
  ];

  // Exception states aren't steps on the stepper -- they're shown as a
  // banner instead, since they don't represent "further along," they
  // represent "something needs attention." Wording lives in
  // exceptionMessages.js (Quest 11) so this page and payment-instructions.js
  // stay consistent.
  const EXCEPTION_MESSAGES = PrivateBillExceptionMessages;

  // Keep in sync with TERMINAL_STATUSES in models/transactionStatusEngine.js --
  // once an order reaches one of these, polling stops since nothing more
  // will change.
  const TERMINAL_STATUSES = ['COMPLETED', 'EXPIRED', 'CANCELLED'];

  const orderId = new URLSearchParams(window.location.search).get('orderId');
  let pollTimer = null;

  if (!orderId) {
    showError('No order was specified.');
    return;
  }

  loadOrder();

  function loadOrder() {
    $.ajax({
      url: `/api/transactions/${encodeURIComponent(orderId)}`,
      method: 'GET',
    })
      .done(renderOrder)
      .fail(function (xhr) {
        const message =
          (xhr.responseJSON && xhr.responseJSON.error) || 'That order could not be found.';
        showError(message);
      });
  }

  function renderOrder(order) {
    $('#loading-panel').prop('hidden', true);
    $('#error-panel').prop('hidden', true);
    $('#tracking-panel').prop('hidden', false);

    $('#track-order-id').text(order.id);
    $('#track-summary').text(
      `${formatZec(order.data.zecAmount)} ZEC → ${formatFiat(order.data.fiatAmount, order.data.fiatCurrency)}`
    );

    renderBanner(order.status);
    renderStepper(order);
    schedulePoll(order.status);
  }

  function renderBanner(status) {
    const $banner = $('#status-banner');

    if (EXCEPTION_MESSAGES[status]) {
      $banner
        .removeClass('status-banner--success')
        .addClass('status-banner--warning')
        .text(EXCEPTION_MESSAGES[status])
        .prop('hidden', false);
    } else if (status === 'COMPLETED') {
      $banner
        .removeClass('status-banner--warning')
        .addClass('status-banner--success')
        .text('This payment is complete.')
        .prop('hidden', false);
    } else {
      $banner.prop('hidden', true);
    }
  }

  function renderStepper(order) {
    const $stepper = $('#stepper').empty();
    const currentIndex = HAPPY_PATH.findIndex((step) => step.status === order.status);
    // If the order is in an exception state, nothing on the happy path
    // counts as "current" -- everything reached so far still shows as done.
    const isException = Boolean(EXCEPTION_MESSAGES[order.status]);

    HAPPY_PATH.forEach((step, index) => {
      const historyEntry = order.history.find((h) => h.status === step.status);
      const isDone = historyEntry && (isException ? true : index < currentIndex);
      const isCurrent = !isException && index === currentIndex;

      const $item = $('<li class="stepper-item"></li>');
      if (isDone) $item.addClass('is-done');
      if (isCurrent) $item.addClass('is-current');

      const $dot = $('<span class="stepper-dot"></span>');
      const $labelWrap = $('<div></div>');
      const $label = $('<span class="stepper-label"></span>').text(step.label);
      $labelWrap.append($label);

      if (historyEntry) {
        $labelWrap.append(
          $('<span class="stepper-timestamp"></span>').text(
            new Date(historyEntry.at).toLocaleString()
          )
        );
      }

      $item.append($dot, $labelWrap);
      $stepper.append($item);
    });
  }

  function schedulePoll(status) {
    clearTimeout(pollTimer);
    if (TERMINAL_STATUSES.includes(status)) {
      $('#live-note').text('This order has reached a final state — no further updates expected.');
      return;
    }
    pollTimer = setTimeout(loadOrder, POLL_INTERVAL_MS);
  }

  function showError(message) {
    clearTimeout(pollTimer);
    $('#loading-panel').prop('hidden', true);
    $('#tracking-panel').prop('hidden', true);
    $('#error-message').text(message);
    $('#error-panel').prop('hidden', false);
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
});
