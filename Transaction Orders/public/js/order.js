/**
 * order.js — Quest 05: Create Transaction Orders.
 *
 * This is the first point in the whole flow where the draft sitting in
 * localStorage (PrivateBillState) becomes a real, server-side order. Every
 * earlier step (Quests 01, 03, 04) only ever touched the local draft;
 * Quest 02 called the server for a rate quote but didn't persist anything.
 * This page POSTs to /api/transactions, which routes/transactions.js hands
 * to orderService.createOrder(), which uses the Quest 08 status engine.
 */

$(function () {
  const draft = PrivateBillState.get();

  if (!draft.currency || !draft.fiatAmount || !draft.zecAmount || !draft.bankDetails) {
    window.location.href = '/index.html';
    return;
  }

  createOrder();

  function createOrder() {
    showLoading();

    $.ajax({
      url: '/api/transactions',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        fiatCurrency: draft.currency,
        fiatAmount: draft.fiatAmount,
        zecAmount: draft.zecAmount,
        rate: draft.rate,
        recipient: draft.bankDetails,
      }),
    })
      .done(function (order) {
        // The order is now safely on the server -- the local draft has
        // done its job and can be cleared.
        PrivateBillState.clear();
        showOrder(order);
      })
      .fail(function (xhr) {
        const message =
          (xhr.responseJSON && xhr.responseJSON.error) ||
          'Something went wrong creating your order.';
        showError(message);
      });
  }

  function showLoading() {
    $('#order-title').text('Creating your order…');
    $('#order-subtitle').text('Hang on a moment.');
    $('#order-details').prop('hidden', true);
    $('#order-error').prop('hidden', true);
  }

  function showOrder(order) {
    $('#order-title').text('Order created');
    $('#order-subtitle').text('Here are the details, for your records.');

    $('#order-id').text(order.id);
    $('#order-status').text(order.status);
    $('#order-expires').text(new Date(order.data.expiresAt).toLocaleString());
    $('#continue-to-payment').attr('href', `/payment-instructions.html?orderId=${encodeURIComponent(order.id)}`);

    $('#order-details').prop('hidden', false);
    $('#order-error').prop('hidden', true);
  }

  function showError(message) {
    $('#order-title').text("Couldn't create your order");
    $('#order-subtitle').text('');
    $('#order-error-message').text(message);
    $('#order-error').prop('hidden', false);
    $('#order-details').prop('hidden', true);
  }

  $('#retry-btn').on('click', createOrder);
});
