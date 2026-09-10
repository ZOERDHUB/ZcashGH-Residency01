import { useCallback, useEffect, useMemo, useState } from 'react'
import { convertFiatToZec, type ConversionRates, type Currency } from './conversion'
import { fetchConversionRates } from './market'

type CurrencyMeta = { name: string; symbol: string; flag: string }

const CURRENCIES: Record<Currency, CurrencyMeta> = {
  NGN: { name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭' },
}

const MIN_AMOUNT: Record<Currency, number> = { NGN: 100, GHS: 1 }
const ZEC_DECIMALS = 6

function formatFiat(value: number, currency: Currency) {
  return `${CURRENCIES[currency].symbol}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`
}

function formatZec(value: number) {
  return value.toFixed(ZEC_DECIMALS)
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatRate(value: number, currency: Currency) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: currency === 'NGN' ? 2 : 4,
    minimumFractionDigits: currency === 'NGN' ? 2 : 4,
  }).format(value)
}

function App() {
  const [currency, setCurrency] = useState<Currency>('NGN')
  const [amount, setAmount] = useState('100000')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [toast, setToast] = useState('')
  const [rates, setRates] = useState<ConversionRates | null>(null)
  const [loadingRates, setLoadingRates] = useState(true)
  const [rateError, setRateError] = useState('')
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<number | null>(null)

  const loadRates = useCallback(async () => {
    setLoadingRates(true)
    setRateError('')
    try {
      const nextRates = await fetchConversionRates()
      setRates(nextRates)
      setLastSuccessfulUpdate(nextRates.fetchedAt)
    } catch (error) {
      setRateError(error instanceof Error ? error.message : 'Live exchange rates are unavailable.')
    } finally {
      setLoadingRates(false)
    }
  }, [])

  useEffect(() => {
    void loadRates()
    const interval = window.setInterval(() => void loadRates(), 60_000)
    return () => window.clearInterval(interval)
  }, [loadRates])

  const selected = CURRENCIES[currency]
  const numericAmount = Number(amount.replace(/,/g, '')) || 0

  const conversion = useMemo(() => {
    if (!rates || numericAmount <= 0) return null
    try {
      return convertFiatToZec(numericAmount, currency, rates)
    } catch {
      return null
    }
  }, [rates, numericAmount, currency])

  const status = useMemo(() => {
    if (numericAmount === 0) return 'Enter an amount to continue'
    if (numericAmount < MIN_AMOUNT[currency]) {
      return `Minimum is ${formatFiat(MIN_AMOUNT[currency], currency)}`
    }
    if (loadingRates) return 'Fetching live exchange rates…'
    if (rateError || !conversion) return 'Live conversion unavailable'
    return 'Live ZEC quote ready to review'
  }, [numericAmount, currency, loadingRates, rateError, conversion])

  const chooseCurrency = (next: Currency) => {
    setCurrency(next)
    setMenuOpen(false)
    setShowDetails(false)
  }

  const continueFlow = () => {
    if (numericAmount < MIN_AMOUNT[currency]) {
      setToast(status)
      window.setTimeout(() => setToast(''), 2500)
      return
    }
    if (!conversion) {
      setToast('Wait for a live ZEC conversion quote before continuing.')
      window.setTimeout(() => setToast(''), 3000)
      return
    }
    setShowDetails(true)
  }

  const lastUpdated = lastSuccessfulUpdate
    ? new Date(lastSuccessfulUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--'

  const marketStatus = loadingRates ? 'Updating rates' : rateError ? 'Rate unavailable' : 'Live market rates'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Private Bill home">
          <span className="brand-mark">Z</span>
          <span><strong>PRIVATE BILL</strong><small>Powered by Zcash</small></span>
        </a>
        <div className={`network-pill ${rates && !rateError ? 'is-live' : ''}`}>
          <span className="pulse" />{marketStatus}
        </div>
      </header>

      <main id="top" className="main-grid">
        <section className="intro">
          <div className="eyebrow"><span className="shield">◈</span> PRIVATE PAYMENTS FOR AFRICA</div>
          <h1>Send local currency.<br /><em>Keep privacy.</em></h1>
          <p className="lead">Private Bill is a Zcash-powered payment experience designed to let a recipient receive Nigerian Naira or Ghanaian Cedi while ZEC funds the transaction.</p>

          <div className="market-card">
            <div>
              <span className="market-label">ZEC / USD</span>
              <strong>{rates ? formatUsd(rates.zecUsd) : '—'}</strong>
              <small>{rates ? `Live · ${rates.source}` : rateError || 'Waiting for market data'}</small>
            </div>
            <button className="refresh" onClick={() => void loadRates()} disabled={loadingRates} aria-label="Refresh market rates">
              <span className={loadingRates ? 'spin' : ''}>↻</span>
            </button>
          </div>

          <div className="trust-row">
            <div><span>01</span><p>Choose your currency</p></div>
            <div><span>02</span><p>Set the recipient amount</p></div>
            <div><span>03</span><p>Convert using live rates</p></div>
          </div>
        </section>

        <section className="card-wrap" aria-label="Private Bill exchange form">
          <div className="exchange-card">
            <div className="card-head">
              <div><span className="kicker">NEW PAYMENT</span><h2>Recipient gets</h2></div>
              <button className="more-button" aria-label="Show rate information" onClick={() => setShowDetails(!showDetails)}>•••</button>
            </div>

            <div className="field-label">LOCAL CURRENCY</div>
            <div className="amount-box">
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} aria-label="Recipient amount" placeholder="0" />
              <div className="currency-picker">
                <button className="currency-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
                  <span className="flag">{selected.flag}</span><span>{currency}</span><span className="chevron">⌄</span>
                </button>
                {menuOpen && <div className="currency-menu">{(Object.keys(CURRENCIES) as Currency[]).map((code) => (
                  <button key={code} onClick={() => chooseCurrency(code)}><span>{CURRENCIES[code].flag}</span><span>{code}</span><small>{CURRENCIES[code].name}</small></button>
                ))}</div>}
              </div>
            </div>

            <div className="rate-line">
              <span>{loadingRates ? 'Fetching live rate…' : rateError ? 'Rate unavailable' : 'Live conversion rate'}</span>
              <span>{conversion ? `1 ZEC ≈ ${selected.symbol}${formatRate(conversion.fiatPerZec, currency)}` : '—'}</span>
            </div>

            <div className="connector"><span>↓</span></div>
            <div className="field-label">YOU PAY</div>
            <div className={`zec-box ${!conversion ? 'is-unavailable' : ''}`}>
              <div><strong>{conversion ? formatZec(conversion.zecAmount) : '—'}</strong><span>ZEC</span></div>
              <span className="zec-badge">Z</span>
            </div>

            <div className="quote-grid">
              <div><span>Recipient receives</span><strong>{formatFiat(numericAmount, currency)}</strong></div>
              <div><span>Approx. value</span><strong>{conversion ? formatUsd(conversion.usdValue) : '—'}</strong></div>
              <div><span>ZEC market price</span><strong>{rates ? formatUsd(rates.zecUsd) : '—'}</strong></div>
              <div><span>Rate updated</span><strong>{lastUpdated}</strong></div>
            </div>

            <div className={`notice ${rateError ? 'notice-error' : ''}`}>
              <span className="notice-icon">i</span>
              <p>{rateError ? `${rateError} No hard-coded exchange rate is used. Refresh and try again when providers recover.` : 'ZEC/USD and USD/local-currency rates are fetched at runtime. The conversion module is independent from the interface, so the rate provider can be replaced later.'}</p>
            </div>

            <button className="primary" onClick={continueFlow} disabled={loadingRates || !conversion}>Continue <span>→</span></button>
            <p className="status-text">{status}</p>

            {showDetails && conversion && (
              <div className="next-panel">
                <div className="next-icon">✓</div>
                <div><strong>Conversion confirmed</strong><p>{formatFiat(numericAmount, currency)} requires approximately {formatZec(conversion.zecAmount)} ZEC at the current market quote. Next step: recipient details.</p></div>
              </div>
            )}
          </div>
          <div className="card-foot"><span>🔒</span> Privacy-first flow · Quest 02 adds live fiat → ZEC conversion</div>
        </section>
      </main>

      <section className="feature-strip">
        <div><span className="feature-icon">◎</span><div><strong>Modular conversion</strong><p>Rate logic lives outside the UI.</p></div></div>
        <div><span className="feature-icon">↔</span><div><strong>NGN + GHS</strong><p>Local-currency conversion for both markets.</p></div></div>
        <div><span className="feature-icon">⚡</span><div><strong>Live rates</strong><p>Refresh automatically or on demand.</p></div></div>
      </section>

      <footer><span>PRIVATE BILL · Zcash Privacy Developers Residency</span><span>Quest 02 · ZEC Conversion · {rates && !rateError ? 'Live quote' : 'Unavailable'}</span></footer>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
