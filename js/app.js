/**
 * Private Bill — UI logic
 * ---------------------------------
 * Wires the exchange card up: currency selection, input handling, and
 * rendering. This file deliberately contains NO conversion math and
 * NO fetch calls — it asks js/rateService.js for rates and
 * js/converter.js to do the arithmetic, then only touches the DOM
 * with the numbers those modules hand back. See converter.js and
 * rateService.js for why the split is drawn there.
 *
 * It also owns the one job that has to live at this layer: turning a
 * rate-service rejection into a visible, honest "rates unavailable"
 * state, since rateService.js deliberately never substitutes a
 * guessed number for a live one.
 */

(() => {
  const els = {
    fiatAmount: document.getElementById("fiatAmount"),
    fiatCurrencyBtn: document.getElementById("fiatCurrencyBtn"),
    fiatFlag: document.getElementById("fiatFlag"),
    fiatCode: document.getElementById("fiatCode"),
    fiatMinNote: document.getElementById("fiatMinNote"),
    currencyItems: document.querySelectorAll("[data-currency]"),
    zecAmount: document.getElementById("zecAmount"),
    zecUsdNote: document.getElementById("zecUsdNote"),
    rateTicker: document.getElementById("rateTicker"),
    rateDot: document.getElementById("rateDot"),
    rateText: document.getElementById("rateText"),
    refreshBtn: document.getElementById("refreshBtn"),
    rateUnavailableBanner: document.getElementById("rateUnavailableBanner"),
    rateRetryBtn: document.getElementById("rateRetryBtn"),
    breakdown: document.getElementById("breakdown"),
    feePct: document.getElementById("feePct"),
    feeRow: document.getElementById("feeRow"),
    totalRow: document.getElementById("totalRow"),
    errorBanner: document.getElementById("errorBanner"),
    continueBtn: document.getElementById("continueBtn"),
    modalFiat: document.getElementById("modalFiat"),
    modalZec: document.getElementById("modalZec"),
    modalRate: document.getElementById("modalRate"),
    modalFee: document.getElementById("modalFee"),
    modalFeePct: document.getElementById("modalFeePct"),
    continueToBankDetailsBtn: document.getElementById("continueToBankDetailsBtn"),

    // Step containers
    stepExchange: document.getElementById("stepExchange"),
    stepBankDetails: document.getElementById("stepBankDetails"),
    editAmountBtn: document.getElementById("editAmountBtn"),

    // Recap strip
    recapFiat: document.getElementById("recapFiat"),
    recapZec: document.getElementById("recapZec"),

    // Bank details form
    bankDetailsForm: document.getElementById("bankDetailsForm"),
    bankFormCard: document.getElementById("bankFormCard"),
    recipientCountryChip: document.getElementById("recipientCountryChip"),
    bankNameSelect: document.getElementById("bankName"),
    bankNameError: document.getElementById("bankNameError"),
    accountNumberInput: document.getElementById("accountNumber"),
    accountNumberError: document.getElementById("accountNumberError"),
    accountNameInput: document.getElementById("accountName"),
    accountNameError: document.getElementById("accountNameError"),
    bankFormErrorBanner: document.getElementById("bankFormErrorBanner"),
    saveRecipientBtn: document.getElementById("saveRecipientBtn"),

    // Saved-recipient confirmation
    recipientSavedCard: document.getElementById("recipientSavedCard"),
    savedBankName: document.getElementById("savedBankName"),
    savedAccountNumber: document.getElementById("savedAccountNumber"),
    savedAccountName: document.getElementById("savedAccountName"),
    savedCountry: document.getElementById("savedCountry"),
    editRecipientBtn: document.getElementById("editRecipientBtn"),
    reviewTransactionBtn: document.getElementById("reviewTransactionBtn"),

    // Step 3: review
    stepReview: document.getElementById("stepReview"),
    reviewCurrency: document.getElementById("reviewCurrency"),
    reviewFiatAmount: document.getElementById("reviewFiatAmount"),
    reviewZecAmount: document.getElementById("reviewZecAmount"),
    reviewRate: document.getElementById("reviewRate"),
    reviewFee: document.getElementById("reviewFee"),
    reviewEditAmountBtn: document.getElementById("reviewEditAmountBtn"),
    reviewBankName: document.getElementById("reviewBankName"),
    reviewAccountNumber: document.getElementById("reviewAccountNumber"),
    reviewAccountName: document.getElementById("reviewAccountName"),
    reviewCountry: document.getElementById("reviewCountry"),
    reviewEditRecipientBtn: document.getElementById("reviewEditRecipientBtn"),
    reviewConfirmSection: document.getElementById("reviewConfirmSection"),
    reviewAckCheckbox: document.getElementById("reviewAckCheckbox"),
    confirmReviewBtn: document.getElementById("confirmReviewBtn"),
    reviewConfirmedCard: document.getElementById("reviewConfirmedCard"),
    unconfirmReviewBtn: document.getElementById("unconfirmReviewBtn"),
    orderStatusBadge: document.getElementById("orderStatusBadge"),
    orderIdText: document.getElementById("orderIdText"),
    orderCreatedAt: document.getElementById("orderCreatedAt"),
    orderExpiresAt: document.getElementById("orderExpiresAt"),
    orderCountdown: document.getElementById("orderCountdown"),
    proceedToPaymentBtn: document.getElementById("proceedToPaymentBtn"),

    // Step 4: send ZEC
    stepPayment: document.getElementById("stepPayment"),
    paymentCard: document.getElementById("paymentCard"),
    paymentOrderId: document.getElementById("paymentOrderId"),
    paymentStatusBadge: document.getElementById("paymentStatusBadge"),
    paymentZecAmount: document.getElementById("paymentZecAmount"),
    paymentAddress: document.getElementById("paymentAddress"),
    paymentCountdown: document.getElementById("paymentCountdown"),
    instructionsOrderId: document.getElementById("instructionsOrderId"),
    paymentExpiredBanner: document.getElementById("paymentExpiredBanner"),
    paymentExpiredRetryBtn: document.getElementById("paymentExpiredRetryBtn"),
    cancelPaymentBtn: document.getElementById("cancelPaymentBtn"),
    copyZecAmountBtn: document.getElementById("copyZecAmountBtn"),
    copyAddressBtn: document.getElementById("copyAddressBtn"),
    orderExpiredBanner: document.getElementById("orderExpiredBanner"),
    orderExpiredRetryBtn: document.getElementById("orderExpiredRetryBtn")
  };

  const previewModal = new bootstrap.Modal(document.getElementById("previewModal"));

  let state = {
    currency: "NGN",
    rates: null,        // last successful PB_LIVE_RATE_SERVICE.getRates() result, or null
    ratesUnavailable: false, // true once every provider has failed
    lastResult: null,   // last PB_CONVERTER.convertFiatToZec() output
    currentOrderId: null,      // the order tied to the current confirmed review, if any
    orderCountdownInterval: null // setInterval handle for the live countdown display
  };

  els.feePct.textContent = PB_CONFIG.serviceFeePct;

  /* ---------------------------------------------------------------
     Formatting helpers (display-only — no calculation happens here)
  --------------------------------------------------------------- */
  function formatFiat(value, code) {
    return new Intl.NumberFormat("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + " " + code;
  }

  function formatZec(value) {
    return value.toFixed(8);
  }

  function currentFxRate() {
    if (!state.rates) return null;
    return state.currency === "NGN" ? state.rates.usdToNgn : state.rates.usdToGhs;
  }

  /* ---------------------------------------------------------------
     Currency switching
  --------------------------------------------------------------- */
  function setCurrency(code) {
    state.currency = code;
    const meta = PB_CONFIG.currencies[code];
    els.fiatFlag.textContent = meta.flag;
    els.fiatCode.textContent = meta.code;
    els.fiatMinNote.textContent = `Minimum ${meta.symbol}${meta.minAmount.toLocaleString()}`;
    renderRateTicker();
    recompute();
  }

  els.currencyItems.forEach((item) => {
    item.addEventListener("click", () => setCurrency(item.dataset.currency));
  });

  /* ---------------------------------------------------------------
     Rate fetching (delegated entirely to PB_LIVE_RATE_SERVICE).
     A rejection here means every configured provider failed — there
     is no numeric fallback to fall back to, so this is treated as a
     real "unavailable" state rather than swallowed.
  --------------------------------------------------------------- */
  async function loadRates({ silent = false } = {}) {
    if (!silent) {
      els.refreshBtn.classList.add("spinning");
      els.rateText.textContent = "Fetching live rate…";
    }
    try {
      const rates = await PB_LIVE_RATE_SERVICE.getRates();
      state.rates = rates;
      state.ratesUnavailable = false;
    } catch (err) {
      state.rates = null;
      state.ratesUnavailable = true;
      console.error("Private Bill: exchange rates unavailable —", err);
    } finally {
      els.refreshBtn.classList.remove("spinning");
      renderRateTicker();
      recompute();
    }
  }

  function renderRateTicker() {
    if (state.ratesUnavailable) {
      els.rateDot.className = "pb-rate-dot error";
      els.rateText.textContent = "Exchange rate unavailable";
      els.rateUnavailableBanner.classList.remove("d-none");
      return;
    }

    els.rateUnavailableBanner.classList.add("d-none");

    if (!state.rates) return; // still loading, before the first result

    const { zecUsd, fetchedAt } = state.rates;
    const fxRate = currentFxRate();
    const zecInFiat = zecUsd * fxRate;
    const timeStr = fetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    els.rateDot.className = "pb-rate-dot live";
    els.rateText.textContent = `1 ZEC ≈ ${formatFiat(zecInFiat, state.currency)} · updated ${timeStr}`;
  }

  els.refreshBtn.addEventListener("click", () => loadRates());
  els.rateRetryBtn.addEventListener("click", () => loadRates());

  /* ---------------------------------------------------------------
     Core "recompute" — validates via PB_CONVERTER, converts via
     PB_CONVERTER, and renders whatever it returns. No arithmetic
     lives in this function, and it never computes anything while
     rates are unavailable.
  --------------------------------------------------------------- */
  function recompute() {
    const raw = els.fiatAmount.value.trim();
    const meta = PB_CONFIG.currencies[state.currency];
    clearError();

    const validationError = PB_CONVERTER.validateFiatAmount(raw, meta);
    if (validationError) {
      showError(validationError);
      resetOutputs();
      return;
    }

    if (!raw) {
      resetOutputs();
      return;
    }

    if (state.ratesUnavailable) {
      els.zecAmount.value = "";
      els.zecAmount.placeholder = "Rate unavailable";
      els.zecUsdNote.innerHTML = "&nbsp;";
      els.breakdown.hidden = true;
      els.continueBtn.disabled = true;
      state.lastResult = null;
      return;
    }

    if (!state.rates) {
      els.continueBtn.disabled = true;
      return; // still loading the first rate
    }

    const amount = Number(raw);
    const result = PB_CONVERTER.convertFiatToZec({
      fiatAmount: amount,
      currencyCode: state.currency,
      zecUsd: state.rates.zecUsd,
      fxRate: currentFxRate(),
      feePct: PB_CONFIG.serviceFeePct
    });

    state.lastResult = result;

    els.zecAmount.value = formatZec(result.totalZec);
    els.zecUsdNote.textContent = `≈ $${result.usdAmount.toFixed(2)} USD`;

    els.breakdown.hidden = false;
    els.feeRow.textContent = formatZec(result.feeZec) + " ZEC";
    els.totalRow.textContent = formatZec(result.totalZec) + " ZEC";

    els.continueBtn.disabled = false;
  }

  function resetOutputs() {
    els.zecAmount.value = "";
    els.zecAmount.placeholder = "0.00000000";
    els.zecUsdNote.innerHTML = "&nbsp;";
    els.breakdown.hidden = true;
    els.continueBtn.disabled = true;
    state.lastResult = null;
  }

  /* ---------------------------------------------------------------
     Input handling — digits and a single decimal point only
  --------------------------------------------------------------- */
  els.fiatAmount.addEventListener("input", () => {
    els.fiatAmount.value = els.fiatAmount.value
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1");
    recompute();
  });

  /* ---------------------------------------------------------------
     Field-level validation errors (separate from the rate-unavailable
     banner, which persists regardless of what's typed)
  --------------------------------------------------------------- */
  function showError(message) {
    els.errorBanner.textContent = message;
    els.errorBanner.classList.remove("d-none");
  }

  function clearError() {
    els.errorBanner.classList.add("d-none");
    els.errorBanner.textContent = "";
  }

  /* ---------------------------------------------------------------
     Continue — opens the preview modal with the last converted result
  --------------------------------------------------------------- */
  els.continueBtn.addEventListener("click", () => {
    if (!state.lastResult) return;
    const { fiatAmount, currencyCode, feeZec, totalZec, effectiveRate } = state.lastResult;

    els.modalFiat.textContent = formatFiat(fiatAmount, currencyCode);
    els.modalZec.textContent = formatZec(totalZec) + " ZEC";
    els.modalRate.textContent = `1 ZEC ≈ ${formatFiat(effectiveRate, currencyCode)}`;
    els.modalFeePct.textContent = PB_CONFIG.serviceFeePct;
    els.modalFee.textContent = formatZec(feeZec) + " ZEC";

    previewModal.show();
  });

  /* =================================================================
     STEP 2 — recipient bank details
     No conversion math lives here either: form values go straight to
     PB_BANK_VALIDATOR for validation and PB_TRANSACTION for storage.
     This function's only job is DOM state (which step shows, which
     fields show as invalid, what the confirmation card displays).
  ================================================================= */

  els.continueToBankDetailsBtn.addEventListener("click", () => {
    if (!state.lastResult) return;

    // Capture the confirmed exchange into the shared transaction
    // state — this is what makes it "available to the next stage"
    // rather than trapped in this file's local `state` variable.
    PB_TRANSACTION.setExchange({
      fiatAmount: state.lastResult.fiatAmount,
      currencyCode: state.lastResult.currencyCode,
      baseZec: state.lastResult.baseZec,
      totalZec: state.lastResult.totalZec,
      feeZec: state.lastResult.feeZec,
      effectiveRate: state.lastResult.effectiveRate
    });

    showBankDetailsStep();
  });

  function showBankDetailsStep() {
    const exchange = PB_TRANSACTION.getExchange();
    if (!exchange) return;

    els.recapFiat.textContent = formatFiat(exchange.fiatAmount, exchange.currencyCode);
    els.recapZec.textContent = formatZec(exchange.totalZec) + " ZEC";

    const country = pbGetCountryForCurrency(exchange.currencyCode);
    els.recipientCountryChip.textContent = `${country} (${exchange.currencyCode})`;

    populateBankOptions(exchange.currencyCode);

    const existingRecipient = PB_TRANSACTION.getRecipient();
    if (existingRecipient && existingRecipient.country === country) {
      // Same currency/country as when it was saved — show it rather
      // than wiping it, so going back to adjust the amount and
      // returning here doesn't lose previously entered bank details.
      showSavedRecipient();
    } else {
      if (existingRecipient) {
        // Currency changed to a different country since a recipient
        // was saved — that recipient was for the old country's bank
        // list and no longer applies.
        PB_TRANSACTION.clearRecipient();
      }
      resetBankDetailsForm();
    }

    els.stepExchange.classList.add("d-none");
    els.stepBankDetails.classList.remove("d-none");
    els.stepReview.classList.add("d-none");
    els.stepPayment.classList.add("d-none");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  /** Shows exactly one of the four steps, hiding the other three. */
  function showStep(step) {
    els.stepExchange.classList.toggle("d-none", step !== "exchange");
    els.stepBankDetails.classList.toggle("d-none", step !== "bankDetails");
    els.stepReview.classList.toggle("d-none", step !== "review");
    els.stepPayment.classList.toggle("d-none", step !== "payment");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function showExchangeStep() {
    showStep("exchange");
  }

  els.editAmountBtn.addEventListener("click", showExchangeStep);

  function populateBankOptions(currencyCode) {
    const banks = pbGetBanksForCurrency(currencyCode);
    els.bankNameSelect.innerHTML = '<option value="" selected disabled>Select a bank…</option>' +
      banks.map((b) => `<option value="${b.name}">${b.name}</option>`).join("");
  }

  function resetBankDetailsForm() {
    els.bankDetailsForm.reset();
    els.bankFormCard.classList.remove("d-none");
    els.recipientSavedCard.classList.add("d-none");
    clearBankFormErrors();
  }

  function clearBankFormErrors() {
    [els.bankNameSelect, els.accountNumberInput, els.accountNameInput].forEach((el) =>
      el.classList.remove("is-invalid")
    );
    [els.bankNameError, els.accountNumberError, els.accountNameError].forEach((el) => {
      el.textContent = "";
    });
    els.bankFormErrorBanner.classList.add("d-none");
    els.bankFormErrorBanner.textContent = "";
  }

  // Clear a field's invalid state as soon as the user changes it,
  // rather than making them re-submit to see the error clear.
  [els.bankNameSelect, els.accountNumberInput, els.accountNameInput].forEach((el) => {
    el.addEventListener("input", () => el.classList.remove("is-invalid"));
    el.addEventListener("change", () => el.classList.remove("is-invalid"));
  });

  els.bankDetailsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearBankFormErrors();

    const exchange = PB_TRANSACTION.getExchange();
    if (!exchange) return;

    const formValues = {
      bankName: els.bankNameSelect.value,
      accountNumber: els.accountNumberInput.value.trim(),
      accountName: els.accountNameInput.value.trim(),
      currencyCode: exchange.currencyCode
    };

    const { valid, errors } = PB_BANK_VALIDATOR.validateBankDetails(formValues);

    if (!valid) {
      if (errors.bankName) {
        els.bankNameSelect.classList.add("is-invalid");
        els.bankNameError.textContent = errors.bankName;
      }
      if (errors.accountNumber) {
        els.accountNumberInput.classList.add("is-invalid");
        els.accountNumberError.textContent = errors.accountNumber;
      }
      if (errors.accountName) {
        els.accountNameInput.classList.add("is-invalid");
        els.accountNameError.textContent = errors.accountName;
      }
      els.bankFormErrorBanner.textContent = "Fix the highlighted field(s) before continuing.";
      els.bankFormErrorBanner.classList.remove("d-none");
      return;
    }

    // Note: formValues (including the raw account number) is never
    // logged — only handed to PB_TRANSACTION, which stores it
    // in-memory for this session and exposes a masked version for
    // anything rendered back to the screen.
    PB_TRANSACTION.setRecipient({
      country: pbGetCountryForCurrency(exchange.currencyCode),
      bankName: formValues.bankName,
      accountNumber: formValues.accountNumber,
      accountName: formValues.accountName
    });

    showSavedRecipient();
  });

  function showSavedRecipient() {
    const summary = PB_TRANSACTION.getMaskedSummary();
    if (!summary) return;

    els.savedBankName.textContent = summary.recipient.bankName;
    els.savedAccountNumber.textContent = summary.recipient.accountNumber;
    els.savedAccountName.textContent = summary.recipient.accountName;
    els.savedCountry.textContent = summary.recipient.country;

    els.bankFormCard.classList.add("d-none");
    els.recipientSavedCard.classList.remove("d-none");
  }

  els.editRecipientBtn.addEventListener("click", () => {
    const recipient = PB_TRANSACTION.getRecipient();
    if (recipient) {
      els.bankNameSelect.value = recipient.bankName;
      els.accountNumberInput.value = recipient.accountNumber;
      els.accountNameInput.value = recipient.accountName;
    }
    els.recipientSavedCard.classList.add("d-none");
    els.bankFormCard.classList.remove("d-none");
  });

  /* =================================================================
     STEP 3 — transaction review
     Purely a read-only recap of PB_TRANSACTION's current contents,
     plus navigation back to Step 1 / Step 2 and the confirm action.
     No new data is collected here and nothing is validated — by the
     time a user reaches this step, both earlier steps have already
     validated everything being displayed.
  ================================================================= */

  els.reviewTransactionBtn.addEventListener("click", showReviewStep);

  function showReviewStep() {
    const exchange = PB_TRANSACTION.getExchange();
    const summary = PB_TRANSACTION.getMaskedSummary();
    if (!exchange || !summary) return;

    els.reviewCurrency.textContent = exchange.currencyCode;
    els.reviewFiatAmount.textContent = formatFiat(exchange.fiatAmount, exchange.currencyCode);
    els.reviewZecAmount.textContent = formatZec(exchange.totalZec) + " ZEC";
    els.reviewRate.textContent = `1 ZEC ≈ ${formatFiat(exchange.effectiveRate, exchange.currencyCode)}`;
    els.reviewFee.textContent =
      `${PB_CONFIG.serviceFeePct}% · ${formatZec(exchange.feeZec)} ZEC`;

    els.reviewBankName.textContent = summary.recipient.bankName;
    els.reviewAccountNumber.textContent = summary.recipient.accountNumber; // already masked
    els.reviewAccountName.textContent = summary.recipient.accountName;
    els.reviewCountry.textContent = summary.recipient.country;

    renderReviewConfirmState();

    els.stepBankDetails.classList.add("d-none");
    els.stepExchange.classList.add("d-none");
    els.stepReview.classList.remove("d-none");
    els.stepPayment.classList.add("d-none");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  /**
   * Shows either the confirm checkbox+button, or the active order —
   * driven by whether state.currentOrderId points at a real,
   * non-terminal order in PB_ORDER_STORE, not just a local flag. This
   * way returning to Step 3 (e.g. Step 2 → Review again, without
   * touching Edit) always reflects whatever's actually true.
   */
  function renderReviewConfirmState() {
    const order = state.currentOrderId ? PB_ORDER_STORE.getMaskedOrder(state.currentOrderId) : null;

    if (order && !PB_ORDER_STORE.isTerminalStatus(order.status)) {
      renderOrder(order);
      els.reviewConfirmSection.classList.add("d-none");
      els.reviewConfirmedCard.classList.remove("d-none");
      els.orderExpiredBanner.classList.add("d-none");
      els.paymentCard.classList.remove("d-none");
      els.paymentExpiredBanner.classList.add("d-none");
      startOrderCountdown();
    } else {
      stopOrderCountdown();
      els.reviewAckCheckbox.checked = false;
      els.confirmReviewBtn.disabled = true;
      els.reviewConfirmSection.classList.remove("d-none");
      els.reviewConfirmedCard.classList.add("d-none");
    }
  }

  function renderOrder(order) {
    els.orderIdText.textContent = order.id;
    els.orderStatusBadge.textContent = order.status;
    els.orderStatusBadge.className = "pb-order-status-badge status-" + order.status.toLowerCase();
    els.orderCreatedAt.textContent = order.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    els.orderExpiresAt.textContent = order.expiresAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Step 4 (Send ZEC) reads from this exact same order object, never
    // a separately fetched copy — this is what guarantees the payment
    // screen's amount, address, and ID always correspond to the same
    // transaction as the order summary above it.
    els.paymentOrderId.textContent = order.id;
    els.paymentStatusBadge.textContent = order.status;
    els.paymentStatusBadge.className = "pb-order-status-badge status-" + order.status.toLowerCase();
    els.paymentZecAmount.textContent = formatZec(order.zecAmount) + " ZEC";
    els.paymentAddress.textContent = order.depositAddress;
    els.instructionsOrderId.textContent = order.id;
  }

  function startOrderCountdown() {
    stopOrderCountdown();
    updateOrderCountdown();
    state.orderCountdownInterval = setInterval(updateOrderCountdown, 1000);
  }

  function stopOrderCountdown() {
    if (state.orderCountdownInterval) {
      clearInterval(state.orderCountdownInterval);
      state.orderCountdownInterval = null;
    }
  }

  /**
   * Ticks the visible countdown and — importantly — actually checks
   * expiry against PB_ORDER_STORE on every tick, so an order that
   * expires while the user is just sitting on this screen transitions
   * to EXPIRED for real, not just cosmetically.
   */
  function updateOrderCountdown() {
    if (!state.currentOrderId) return;
    const order = PB_ORDER_STORE.expireIfDue(state.currentOrderId);
    if (!order) return;

    if (PB_ORDER_STORE.isTerminalStatus(order.status)) {
      stopOrderCountdown();
      els.reviewConfirmedCard.classList.add("d-none");
      els.orderExpiredBanner.classList.remove("d-none");
      els.paymentCard.classList.add("d-none");
      els.paymentExpiredBanner.classList.remove("d-none");
      return;
    }

    const remainingMs = order.expiresAt.getTime() - Date.now();
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    const display = `${minutes}:${String(seconds).padStart(2, "0")}`;
    els.orderCountdown.textContent = display;
    els.paymentCountdown.textContent = display;
  }

  els.reviewAckCheckbox.addEventListener("change", () => {
    els.confirmReviewBtn.disabled = !els.reviewAckCheckbox.checked;
  });

  els.confirmReviewBtn.addEventListener("click", () => {
    if (!PB_TRANSACTION.confirmReview()) return;

    // This is the one moment an order is created: confirming the
    // review is what turns a still-editable draft into a distinct,
    // trackable record with its own id and status.
    const order = PB_ORDER_STORE.createOrder(PB_TRANSACTION.getPayload());
    if (!order) return; // shouldn't happen — confirmReview() already checked completeness

    state.currentOrderId = order.id;
    renderReviewConfirmState();
  });

  function cancelCurrentOrderIfAny() {
    if (state.currentOrderId) {
      PB_ORDER_STORE.updateStatus(state.currentOrderId, PB_ORDER_STATUS.CANCELLED);
      state.currentOrderId = null;
    }
    stopOrderCountdown();
  }

  els.unconfirmReviewBtn.addEventListener("click", () => {
    // Explicit label says "cancels this order" — this is that action,
    // not a soft "come back later" toggle. A fresh confirm click
    // after this creates a brand new order, never resurrects the old one.
    cancelCurrentOrderIfAny();
    returnToUnconfirmedReview();
  });

  els.orderExpiredRetryBtn.addEventListener("click", () => {
    cancelCurrentOrderIfAny();
    els.orderExpiredBanner.classList.add("d-none");
    PB_TRANSACTION.reset();
    els.fiatAmount.value = "";
    setCurrency("NGN");
    showExchangeStep();
  });

  /* =================================================================
     STEP 4 — send ZEC
     Purely a read-only display of the same order object Step 3
     already rendered (see renderOrder above) — no separate fetch, no
     separate formatting, so the two screens can never disagree about
     which transaction they're describing.
  ================================================================= */

  els.proceedToPaymentBtn.addEventListener("click", () => {
    if (!state.currentOrderId) return;
    showStep("payment");
  });

  function returnToUnconfirmedReview() {
    els.reviewConfirmedCard.classList.add("d-none");
    els.reviewConfirmSection.classList.remove("d-none");
    els.reviewAckCheckbox.checked = false;
    els.confirmReviewBtn.disabled = true;
  }

  els.cancelPaymentBtn.addEventListener("click", () => {
    cancelCurrentOrderIfAny();
    showStep("review");
    returnToUnconfirmedReview();
  });

  els.paymentExpiredRetryBtn.addEventListener("click", () => {
    cancelCurrentOrderIfAny();
    els.paymentExpiredBanner.classList.add("d-none");
    els.orderExpiredBanner.classList.add("d-none");
    PB_TRANSACTION.reset();
    els.fiatAmount.value = "";
    setCurrency("NGN");
    showExchangeStep();
  });

  /**
   * Generic copy-to-clipboard handler shared by both Copy buttons.
   * Tries the modern Clipboard API first; falls back to a hidden,
   * off-screen textarea + execCommand for browsers/contexts (e.g. a
   * non-HTTPS origin) where navigator.clipboard is unavailable.
   */
  async function copyElementText(button) {
    const targetId = button.dataset.copyTarget;
    const text = document.getElementById(targetId).textContent;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand("copy"); } catch (fallbackErr) { /* give up silently */ }
      document.body.removeChild(textarea);
    }

    const originalLabel = button.textContent;
    button.textContent = "Copied!";
    button.classList.add("copied");
    setTimeout(() => {
      button.textContent = originalLabel;
      button.classList.remove("copied");
    }, 1500);
  }

  els.copyZecAmountBtn.addEventListener("click", () => copyElementText(els.copyZecAmountBtn));
  els.copyAddressBtn.addEventListener("click", () => copyElementText(els.copyAddressBtn));

  els.reviewEditAmountBtn.addEventListener("click", () => {
    cancelCurrentOrderIfAny();
    els.stepReview.classList.add("d-none");
    showExchangeStep();
  });

  els.reviewEditRecipientBtn.addEventListener("click", () => {
    cancelCurrentOrderIfAny();
    const recipient = PB_TRANSACTION.getRecipient();
    if (recipient) {
      els.bankNameSelect.value = recipient.bankName;
      els.accountNumberInput.value = recipient.accountNumber;
      els.accountNameInput.value = recipient.accountName;
    }
    els.stepReview.classList.add("d-none");
    els.stepBankDetails.classList.remove("d-none");
    els.stepPayment.classList.add("d-none");
    els.recipientSavedCard.classList.add("d-none");
    els.bankFormCard.classList.remove("d-none");
    window.scrollTo({ top: 0, behavior: "instant" });
  });

  /* ---------------------------------------------------------------
     Init — retries automatically in the background on an interval,
     so a temporary outage clears itself without the user having to
     act, while the retry button covers the impatient case.
  --------------------------------------------------------------- */
  setCurrency("NGN");
  loadRates();
  setInterval(() => loadRates({ silent: true }), PB_CONFIG.refreshIntervalMs);


  /* ------------------------------------------
      Dropdown Hover
  ------------------------------------------- */
  const dropDownBtn = document.querySelector(".dropdown-toggle");
  const menuList = document.getElementById("drop-hover");
  const dropdownItems = document.querySelectorAll(".dropdown-item");

  dropDownBtn.addEventListener("click", () => {
    menuList.classList.remove("dropdown-menu");
    menuList.style.position = "absolute";
    menuList.style.zIndex = "100";
  });

  dropdownItems.forEach((dropdownItem) => {
    dropdownItem.addEventListener("click", () => {
      if (!menuList.classList.contains("dropdown-menu")) {
        menuList.classList.add("dropdown-menu");
        console.log("hey");
      }
    });
  });
})();
