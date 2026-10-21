import { useCallback, useEffect, useMemo, useState } from 'react'

type Currency = 'NGN' | 'GHS'

type MarketState = {
  zecUsd: number
  usdToNgn: number
  usdToGhs: number
  updatedAt: Date | null
  live: boolean
  source: string
}

const FALLBACK_MARKET: MarketState = {
  zecUsd: 1172.41,
  usdToNgn: 1318.35,
  usdToGhs: 11.395,
  updatedAt: new Date(),
  live: false,
  source: 'Fallback quote',
}

const CURRENCIES: Record<Currency, { name: string; symbol: string; flag: string; code: Currency }> = {
  NGN: { name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬', code: 'NGN' },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭', code: 'GHS' },
}

const MIN_AMOUNT: Record<Currency, number> = { NGN: 100, GHS: 1 }
const ZEC_DECIMALS = 6

function formatFiat(value: number, currency: Currency) {
  const symbol = CURRENCIES[currency].symbol
  return `${symbol}${new Intl.NumberFormat('en-US', {
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
  const decimals = currency === 'NGN' ? 2 : 4
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)
}

async function fetchMarket(): Promise<MarketState> {
  const [zecResponse, fxResponse] = await Promise.all([
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd&include_last_updated_at=true', {
      headers: { accept: 'application/json' },
    }),
    fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { accept: 'application/json' },
    }),
  ])

  if (!zecResponse.ok || !fxResponse.ok) throw new Error('Market data unavailable')

  const zecData = await zecResponse.json()
  const fxData = await fxResponse.json()
  const zecUsd = Number(zecData?.zcash?.usd)
  const usdToNgn = Number(fxData?.rates?.NGN)
  const usdToGhs = Number(fxData?.rates?.GHS)

  if (!zecUsd || !usdToNgn || !usdToGhs) throw new Error('Incomplete market data')

  return {
    zecUsd,
    usdToNgn,
    usdToGhs,
    updatedAt: new Date(),
    live: true,
    source: 'Live market quote',
  }
}

function App() {
  const [currency, setCurrency] = useState<Currency>('NGN')
  const [amount, setAmount] = useState('100000')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [toast, setToast] = useState('')
  const [market, setMarket] = useState<MarketState>(FALLBACK_MARKET)
  const [loadingMarket, setLoadingMarket] = useState(true)
  const [marketError, setMarketError] = useState(false)

  const loadMarket = useCallback(async () => {
    setLoadingMarket(true)
    setMarketError(false)
    try {
      setMarket(await fetchMarket())
    } catch {
      setMarket(FALLBACK_MARKET)
      setMarketError(true)
    } finally {
      setLoadingMarket(false)
    }
  }, [])

  useEffect(() => {
    void loadMarket()
    const interval = window.setInterval(() => void loadMarket(), 60_000)
    return () => window.clearInterval(interval)
  }, [loadMarket])

  const selected = CURRENCIES[currency]
  const numericAmount = Number(amount.replace(/,/g, '')) || 0
  const usdToLocal = currency === 'NGN' ? market.usdToNgn : market.usdToGhs
  const zecToLocal = market.zecUsd * usdToLocal
  const requiredZec = numericAmount / zecToLocal
  const amountUsd = numericAmount / usdToLocal

  const status = useMemo(() => {
    if (numericAmount === 0) return 'Enter an amount to continue'
    if (numericAmount < MIN_AMOUNT[currency]) {
      return `Minimum is ${formatFiat(MIN_AMOUNT[currency], currency)}`
    }
    return 'Quote ready to review'
  }, [numericAmount, currency])

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
    setShowDetails(true)
  }

  const lastUpdated = market.updatedAt
    ? market.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Private Bill home">
          <span className="brand-mark">Z</span>
          <span>
            <strong>PRIVATE BILL</strong>
            <small>Powered by Zcash</small>
          </span>
        </a>

        <div className={`network-pill ${market.live ? 'is-live' : ''}`}>
          <span className="pulse" />
          {market.live ? 'Live market rates' : 'Rate fallback'}
        </div>
      </header>

      <main id="top" className="main-grid">
        <section className="intro">
          <div className="eyebrow"><span className="shield">◈</span> PRIVATE PAYMENTS FOR AFRICA</div>
          <h1>Send local currency.<br /><em>Keep privacy.</em></h1>
          <p className="lead">
            Private Bill is a Zcash-powered payment experience designed to let a recipient receive Nigerian Naira or Ghanaian Cedi while ZEC funds the transaction.
          </p>

          <div className="market-card">
            <div>
              <span className="market-label">ZEC / USD</span>
              <strong>{formatUsd(market.zecUsd)}</strong>
              <small>{market.live ? 'Live market price' : 'Fallback reference price'}</small>
            </div>
            <button className="refresh" onClick={() => void loadMarket()} disabled={loadingMarket} aria-label="Refresh market rates">
              <span className={loadingMarket ? 'spin' : ''}>↻</span>
            </button>
          </div>

          <div className="trust-row">
            <div><span>01</span><p>Choose your currency</p></div>
            <div><span>02</span><p>Set the recipient amount</p></div>
            <div><span>03</span><p>Review the live ZEC quote</p></div>
          </div>
        </section>

        <section className="card-wrap" aria-label="Private Bill exchange form">
          <div className="exchange-card">
            <div className="card-head">
              <div>
                <span className="kicker">NEW PAYMENT</span>
                <h2>Recipient gets</h2>
              </div>
              <button className="more-button" aria-label="Show rate information" onClick={() => setShowDetails(!showDetails)}>•••</button>
            </div>

            <div className="field-label">LOCAL CURRENCY</div>
            <div className="amount-box">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                aria-label="Recipient amount"
                placeholder="0"
              />
              <div className="currency-picker">
                <button className="currency-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
                  <span className="flag">{selected.flag}</span>
                  <span>{currency}</span>
                  <span className="chevron">⌄</span>
                </button>
                {menuOpen && (
                  <div className="currency-menu">
                    {(Object.keys(CURRENCIES) as Currency[]).map((code) => (
                      <button key={code} onClick={() => chooseCurrency(code)}>
                        <span>{CURRENCIES[code].flag}</span>
                        <span>{code}</span>
                        <small>{CURRENCIES[code].name}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rate-line">
              <span>{loadingMarket ? 'Updating rate…' : 'Live estimated rate'}</span>
              <span>1 ZEC ≈ {selected.symbol}{formatRate(zecToLocal, currency)}</span>
            </div>

            <div className="connector"><span>↓</span></div>

            <div className="field-label">YOU PAY</div>
            <div className="zec-box">
              <div>
                <strong>{formatZec(requiredZec)}</strong>
                <span>ZEC</span>
              </div>
              <span className="zec-badge">Z</span>
            </div>

            <div className="quote-grid">
              <div><span>Recipient receives</span><strong>{formatFiat(numericAmount, currency)}</strong></div>
              <div><span>Approx. value</span><strong>{formatUsd(amountUsd)}</strong></div>
              <div><span>ZEC market price</span><strong>{formatUsd(market.zecUsd)}</strong></div>
              <div><span>Rate updated</span><strong>{lastUpdated}</strong></div>
            </div>

            <div className="notice">
              <span className="notice-icon">i</span>
              <p>
                {marketError
                  ? 'Live market data could not be refreshed. A clearly labelled fallback quote is being used. Try refresh again before submitting.'
                  : 'Quote uses live ZEC/USD and USD/local-currency market data. Final settlement may differ when execution occurs.'}
              </p>
            </div>

            <button className="primary" onClick={continueFlow}>
              Continue <span>→</span>
            </button>
            <p className="status-text">{status}</p>

            {showDetails && (
              <div className="next-panel">
                <div className="next-icon">✓</div>
                <div>
                  <strong>Exchange review ready</strong>
                  <p>Next step: collect recipient bank details and confirm the payment order. Quest 01 does not move funds.</p>
                </div>
              </div>
            )}
          </div>
          <div className="card-foot"><span>🔒</span> Privacy-first flow · No wallet connection required in Quest 01</div>
        </section>
      </main>

      <section className="feature-strip">
        <div><span className="feature-icon">◎</span><div><strong>Privacy by design</strong><p>Zcash is the settlement layer.</p></div></div>
        <div><span className="feature-icon">↔</span><div><strong>Local currencies</strong><p>NGN and GHS, built for regional payments.</p></div></div>
        <div><span className="feature-icon">⚡</span><div><strong>Live quoting</strong><p>ZEC and FX rates refresh automatically.</p></div></div>
      </section>

      <footer>
        <span>PRIVATE BILL · Zcash Privacy Developers Residency</span>
        <span>Quest 01 · Exchange Interface · {market.live ? 'Live quote' : 'Fallback quote'}</span>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
