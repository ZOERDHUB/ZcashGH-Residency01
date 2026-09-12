/**
 * review.js — Quest 04: transaction review.
 *
 * Pulls everything the user has entered so far out of the shared draft
 * and lays it out for a final check before confirming. Doesn't collect
 * anything new -- if something's wrong, the user goes back and edits it
 * on the step where it was entered (Quest 01/03), rather than editing it
 * here directly. Keeps this page simple: it only displays and confirms.
 */

$(function () {
  const draft = PrivateBillState.get();

  // Can't review a transaction that isn't fully assembled yet.
  if (!draft.currency || !draft.fiatAmount || !draft.zecAmount || !draft.bankDetails) {
    window.location.href = '/index.html';
    return;
  }

  renderPayment(draft);
  renderRecipient(draft);
  wireMaskToggle(draft.bankDetails.accountNumber);
  wireConfirm();

  function renderPayment(state) {
    $('#review-fiat').text(formatFiat(state.fiatAmount, state.currency));
    $('#review-zec').text(`${formatZec(state.zecAmount)} ZEC`);
    $('#review-rate').text(`1 ZEC ≈ ${formatFiat(state.rate, state.currency)}`);
  }

  function renderRecipient(state) {
    const { bankName, accountName } = state.bankDetails;
    $('#review-bank').text(bankName);
    $('#review-account-name').text(accountName);
    $('#review-account-number').text(maskAccountNumber(state.bankDetails.accountNumber));
  }

  function wireMaskToggle(fullAccountNumber) {
    let revealed = false;
    $('#mask-toggle').on('click', function () {
      revealed = !revealed;
      $('#review-account-number').text(
        revealed ? fullAccountNumber : maskAccountNumber(fullAccountNumber)
      );
      $(this).text(revealed ? 'Hide' : 'Show');
    });
  }

  function wireConfirm() {
    $('#confirm-btn').on('click', function () {
      // Quest 05 (order creation) will actually create the persistent
      // order here. For now this just moves to where that will happen.
      window.location.href = '/order.html';
    });
  }

  // --- formatting helpers -------------------------------------------

  function formatFiat(amount, currency) {
    const localeByCurrency = { NGN: 'en-NG', GHS: 'en-GH' };
    const locale = localeByCurrency[currency];
    if (!locale) return `${amount} ${currency}`;
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  }

  function formatZec(amount) {
    return Number(amount).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  }

  // Shows the first 2 and last 2 digits, masks the rest. e.g. "0123456789"
  // becomes "01••••••89". Purely a display choice to avoid a full account
  // number sitting on-screen longer than needed -- the real value is still
  // in the draft and gets used as-is when the order is created.
  function maskAccountNumber(accountNumber) {
    if (accountNumber.length <= 4) return accountNumber;
    const first = accountNumber.slice(0, 2);
    const last = accountNumber.slice(-2);
    const maskedMiddle = '•'.repeat(accountNumber.length - 4);
    return `${first}${maskedMiddle}${last}`;
  }
});
