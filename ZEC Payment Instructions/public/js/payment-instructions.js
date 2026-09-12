/**
 * payment-instructions.js — Quest 06: ZEC Payment Instructions.
 *
 * The order id comes from the URL (?orderId=...), NOT from localStorage --
 * by this point in the flow, Quest 05 has already cleared the local draft
 * on purpose. This page's only job is: given an order id, fetch that exact
 * order from the server and show what it needs.
 */

$(function () {
  const orderId = new URLSearchParams(window.location.search).get('orderId');

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
    $('#instructions-panel').prop('hidden', false);

    $('#pay-zec-amount').text(`${formatZec(order.data.zecAmount)} ZEC`);
    $('#pay-order-id').text(order.id);
    $('#pay-address').text(order.data.receivingAddress);
    $('#pay-expires').text(new Date(order.data.expiresAt).toLocaleString());

    $('#status-text').text(order.status);
    $('#status-dot').css('background', statusColor(order.status));
    $('#track-link').attr('href', `/track.html?orderId=${encodeURIComponent(order.id)}`);

    renderExceptionBanner(order.status);
    // Cancelling only makes sense while still waiting for ZEC -- the
    // engine itself also enforces this, this just hides a button that
    // would otherwise always fail once payment is further along.
    $('#cancel-btn').prop('hidden', order.status !== 'AWAITING_ZEC');
  }

  function renderExceptionBanner(status) {
    const message = PrivateBillExceptionMessages.get(status);
    const $banner = $('#exception-banner');

    if (message) {
      $banner.text(message).addClass('status-banner--warning').prop('hidden', false);
    } else {
      $banner.prop('hidden', true);
    }
  }

  function showError(message) {
    $('#loading-panel').prop('hidden', true);
    $('#instructions-panel').prop('hidden', true);
    $('#error-message').text(message);
    $('#error-panel').prop('hidden', false);
  }

  function statusColor(status) {
    // Just a visual cue -- not a substitute for reading the actual status
    // text. Quest 11 (error handling) will likely want a fuller mapping
    // than this once more statuses are reachable from this page.
    if (status === 'AWAITING_ZEC') return '#e3a438';
    if (status === 'COMPLETED') return '#3fb8af';
    if (['EXPIRED', 'CANCELLED', 'PAYOUT_FAILED', 'UNDERPAID', 'OVERPAID'].includes(status)) {
      return '#e06a6a';
    }
    return '#8792a8';
  }

  function formatZec(amount) {
    return Number(amount).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  }

  $('#refresh-btn').on('click', loadOrder);

  $('#cancel-btn').on('click', function () {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;

    $.ajax({
      url: `/api/transactions/${encodeURIComponent(orderId)}/cancel`,
      method: 'POST',
    })
      .done(renderOrder)
      .fail(function (xhr) {
        const message =
          (xhr.responseJSON && xhr.responseJSON.error) || 'Could not cancel this order.';
        window.alert(message);
        loadOrder(); // re-sync with whatever the server actually has
      });
  });

  $('#copy-btn').on('click', function () {
    const address = $('#pay-address').text();
    const $btn = $(this);

    copyToClipboard(address).then(() => {
      $btn.addClass('is-copied').text('Copied!');
      setTimeout(() => {
        $btn.removeClass('is-copied').text('Copy');
      }, 1500);
    });
  });

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers without the Clipboard API.
    const $temp = $('<textarea>').val(text).appendTo('body').select();
    document.execCommand('copy');
    $temp.remove();
    return Promise.resolve();
  }
});
