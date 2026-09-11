/**
 * Private Bill — Quest 1 UI logic
 * ---------------------------------
 * Wires the exchange card up: currency selection, input handling,
 * pulling rates from PB_API, computing the ZEC amount, and rendering
 * every piece of derived state (rate ticker, fee breakdown, errors).
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
    rates: null, // { zecUsd, usdToNgn, usdToGhs, isLive, fetchedAt }
    lastResult: null, // { fiatAmount, currency, baseZec, feeZec, totalZec, fxRate }
  };

  els.feePct.textContent = PB_CONFIG.serviceFeePct;

  /* ---------------------------------------------------------------
     Formatting helpers
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

  function fiatToUsdRate() {
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
     Rate fetching + ticker rendering
  --------------------------------------------------------------- */
  async function loadRates({ silent = false } = {}) {
    if (!silent) {
      els.refreshBtn.classList.add("spinning");
      els.rateText.textContent = "Fetching live rate…";
    }
    try {
      state.rates = await PB_API.getRates();
    } finally {
      els.refreshBtn.classList.remove("spinning");
      renderRateTicker();
      recompute();
    }
  }

  function renderRateTicker() {
    if (!state.rates) return;
    const { zecUsd, isLive, fetchedAt } = state.rates;
    const fxRate = fiatToUsdRate();
    const zecInFiat = zecUsd * fxRate;
    const timeStr = fetchedAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    els.rateDot.className = "pb-rate-dot " + (isLive ? "live" : "fallback");
    els.rateText.textContent = isLive
      ? `1 ZEC ≈ ${formatFiat(zecInFiat, state.currency)} · updated ${timeStr}`
      : `1 ZEC ≈ ${formatFiat(zecInFiat, state.currency)} · fallback rate, live source unreachable`;
  }

  els.refreshBtn.addEventListener("click", () => loadRates());

  /* ---------------------------------------------------------------
     Core calculation
  --------------------------------------------------------------- */
  function recompute() {
    const raw = els.fiatAmount.value.trim();
    const meta = PB_CONFIG.currencies[state.currency];
    clearError();

    if (!raw) {
      els.zecAmount.value = "";
      els.zecUsdNote.innerHTML = "&nbsp;";
      els.breakdown.hidden = true;
      els.continueBtn.disabled = true;
      state.lastResult = null;
      return;
    }

    const amount = Number(raw);

    if (Number.isNaN(amount) || amount <= 0) {
      showError("Enter a valid amount greater than zero.");
      els.zecAmount.value = "";
      els.zecUsdNote.innerHTML = "&nbsp;";
      els.breakdown.hidden = true;
      els.continueBtn.disabled = true;
      state.lastResult = null;
      return;
    }

    if (amount < meta.minAmount) {
      showError(
        `Minimum amount is ${meta.symbol}${meta.minAmount.toLocaleString()}.`,
      );
      els.zecAmount.value = "";
      els.zecUsdNote.innerHTML = "&nbsp;";
      els.breakdown.hidden = true;
      els.continueBtn.disabled = true;
      state.lastResult = null;
      return;
    }

    if (!state.rates) {
      els.continueBtn.disabled = true;
      return; // rates still loading
    }

    const fxRate = fiatToUsdRate();
    const usdAmount = amount / fxRate;
    const baseZec = usdAmount / state.rates.zecUsd;
    const feeZec = baseZec * (PB_CONFIG.serviceFeePct / 100);
    const totalZec = baseZec + feeZec;

    state.lastResult = {
      fiatAmount: amount,
      currency: state.currency,
      baseZec,
      feeZec,
      totalZec,
      fxRate,
      zecUsd: state.rates.zecUsd,
    };

    els.zecAmount.value = formatZec(totalZec);
    els.zecUsdNote.textContent = `≈ $${usdAmount.toFixed(2)} USD`;

    els.breakdown.hidden = false;
    els.feeRow.textContent = formatZec(feeZec) + " ZEC";
    els.totalRow.textContent = formatZec(totalZec) + " ZEC";

    els.continueBtn.disabled = false;
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
     Errors
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
     Continue (Quest 1 scope ends here — no funds move)
  --------------------------------------------------------------- */
  els.continueBtn.addEventListener("click", () => {
    if (!state.lastResult) return;
    const { fiatAmount, currency, feeZec, totalZec, zecUsd, fxRate } =
      state.lastResult;

    els.modalFiat.textContent = formatFiat(fiatAmount, currency);
    els.modalZec.textContent = formatZec(totalZec) + " ZEC";
    els.modalRate.textContent = `1 ZEC ≈ ${formatFiat(zecUsd * fxRate, currency)}`;
    els.modalFeePct.textContent = PB_CONFIG.serviceFeePct;
    els.modalFee.textContent = formatZec(feeZec) + " ZEC";

    previewModal.show();
  });

  /* ---------------------------------------------------------------
     Init
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
