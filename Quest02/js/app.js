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
  };

  const previewModal = new bootstrap.Modal(
    document.getElementById("previewModal"),
  );

  let state = {
    currency: "NGN",
    rates: null, // last successful PB_LIVE_RATE_SERVICE.getRates() result, or null
    ratesUnavailable: false, // true once every provider has failed
    lastResult: null, // last PB_CONVERTER.convertFiatToZec() output
  };

  els.feePct.textContent = PB_CONFIG.serviceFeePct;

  /* ---------------------------------------------------------------
     Formatting helpers (display-only — no calculation happens here)
  --------------------------------------------------------------- */
  function formatFiat(value, code) {
    return (
      new Intl.NumberFormat("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value) +
      " " +
      code
    );
  }

  function formatZec(value) {
    return value.toFixed(8);
  }

  function currentFxRate() {
    if (!state.rates) return null;
    return state.currency === "NGN"
      ? state.rates.usdToNgn
      : state.rates.usdToGhs;
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
    const timeStr = fetchedAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

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
      feePct: PB_CONFIG.serviceFeePct,
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
    const { fiatAmount, currencyCode, feeZec, totalZec, effectiveRate } =
      state.lastResult;

    els.modalFiat.textContent = formatFiat(fiatAmount, currencyCode);
    els.modalZec.textContent = formatZec(totalZec) + " ZEC";
    els.modalRate.textContent = `1 ZEC ≈ ${formatFiat(effectiveRate, currencyCode)}`;
    els.modalFeePct.textContent = PB_CONFIG.serviceFeePct;
    els.modalFee.textContent = formatZec(feeZec) + " ZEC";

    previewModal.show();
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
