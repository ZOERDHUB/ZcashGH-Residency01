import { useCallback, useEffect, useMemo, useState } from 'react'
import { convertFiatToZec, type ConversionRates, type Currency } from './conversion'
import { fetchConversionRates } from './market'
import { DemoBankProvider, type Bank, type ProviderType } from './banks'

type CurrencyMeta = { name: string; symbol: string; flag: string; country: string }
type BankDetails = { accountNumber: string; accountName: string; bankName: string; bankCode: string; country: string; currency: Currency }
type Step = 1 | 2 | 3

const CURRENCIES: Record<Currency, CurrencyMeta> = {
  NGN: { name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬', country: 'Nigeria' },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭', country: 'Ghana' },
}

const MIN_AMOUNT: Record<Currency, number> = { NGN: 100, GHS: 1 }
const ZEC_DECIMALS = 6

function formatFiat(value: number, currency: Currency) {
  return `${CURRENCIES[currency].symbol}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`
}
function formatZec(value: number) { return value.toFixed(ZEC_DECIMALS) }
function formatUsd(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value) }
function formatRate(value: number, currency: Currency) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: currency === 'NGN' ? 2 : 4, minimumFractionDigits: currency === 'NGN' ? 2 : 4 }).format(value) }
function maskAccount(value: string) { return value.length <= 4 ? '••••' : `•••• ${value.slice(-4)}` }

function App() {
  const [currency, setCurrency] = useState<Currency>('NGN')
  const [amount, setAmount] = useState('100000')
  const [menuOpen, setMenuOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [toast, setToast] = useState('')
  const [rates, setRates] = useState<ConversionRates | null>(null)
  const [loadingRates, setLoadingRates] = useState(true)
  const [rateError, setRateError] = useState('')
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<number | null>(null)
  const [bank, setBank] = useState<BankDetails>({ accountNumber: '', accountName: '', bankName: '', bankCode: '', country: 'Nigeria', currency: 'NGN' })
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankSearch, setBankSearch] = useState('')
  const [bankMenuOpen, setBankMenuOpen] = useState(false)
  const [loadingBanks, setLoadingBanks] = useState(false)
  const [bankLoadError, setBankLoadError] = useState('')
  const bankProvider = useMemo(() => new DemoBankProvider(), [])
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const loadRates = useCallback(async () => {
    setLoadingRates(true); setRateError('')
    try {
      const nextRates = await fetchConversionRates()
      setRates(nextRates); setLastSuccessfulUpdate(nextRates.fetchedAt)
    } catch (error) {
      setRateError(error instanceof Error ? error.message : 'Live exchange rates are unavailable.')
    } finally { setLoadingRates(false) }
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
    try { return convertFiatToZec(numericAmount, currency, rates) } catch { return null }
  }, [rates, numericAmount, currency])

  const amountError = numericAmount > 0 && numericAmount < MIN_AMOUNT[currency] ? `Minimum is ${formatFiat(MIN_AMOUNT[currency], currency)}` : ''
  useEffect(() => {
    if (step !== 2) return
    let cancelled = false
    setLoadingBanks(true); setBankLoadError('')
    bankProvider.listBanks(currency === 'NGN' ? 'NG' : 'GH').then(list => {
      if (!cancelled) setBanks(list)
    }).catch(error => {
      if (!cancelled) setBankLoadError(error instanceof Error ? error.message : 'Unable to load banks.')
    }).finally(() => { if (!cancelled) setLoadingBanks(false) })
    return () => { cancelled = true }
  }, [step, currency, bankProvider])

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase()
    return q ? banks.filter(item => `${item.name} ${item.type}`.toLowerCase().includes(q)) : banks
  }, [banks, bankSearch])

  const providerLabel = (type: ProviderType) => type === 'bank' ? 'Bank' : type === 'fintech' ? 'Fintech' : 'Mobile money'
  const providerGroups = useMemo(() => [
    { type: 'bank' as ProviderType, label: 'Banks' },
    { type: 'fintech' as ProviderType, label: 'Fintech & digital banks' },
    { type: 'mobile_money' as ProviderType, label: 'Mobile money & wallets' },
  ], [])

  const bankErrors = {
    accountNumber: !bank.accountNumber.trim() ? 'Account number is required.' : !/^[A-Za-z0-9\- ]{6,20}$/.test(bank.accountNumber.trim()) ? 'Enter a valid account number.' : '',
    accountName: !bank.accountName.trim() ? 'Account name is required.' : bank.accountName.trim().length < 2 ? 'Enter the account holder name.' : '',
    bankName: !bank.bankName.trim() ? 'Select a bank.' : '',
  }
  const bankValid = !bankErrors.accountNumber && !bankErrors.accountName && !bankErrors.bankName

  const status = numericAmount === 0 ? 'Enter an amount to continue' : amountError ? amountError : loadingRates ? 'Fetching live exchange rates…' : rateError || !conversion ? 'Live conversion unavailable' : 'Live ZEC quote ready'
  const lastUpdated = lastSuccessfulUpdate ? new Date(lastSuccessfulUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'
  const marketStatus = loadingRates ? 'Updating rates' : rateError ? 'Rate unavailable' : 'Live market rates'

  const chooseCurrency = (next: Currency) => {
    setCurrency(next); setMenuOpen(false)
    setBank(prev => ({ ...prev, currency: next, country: CURRENCIES[next].country, bankName: '', bankCode: '' }))
    setBankSearch('')
    setBankMenuOpen(false)
  }
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800) }
  const continueToDetails = () => {
    if (numericAmount < MIN_AMOUNT[currency]) return showToast(amountError || 'Enter a valid amount.')
    if (!conversion) return showToast('Wait for a live ZEC quote before continuing.')
    setStep(2)
  }
  const submitDetails = () => {
    setTouched({ accountNumber: true, accountName: true, bankName: true })
    if (!bankValid) return
    setStep(3)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Private Bill home"><span className="brand-mark">Z</span><span><strong>PRIVATE BILL</strong><small>Powered by Zcash</small></span></a>
        <div className={`network-pill ${rates && !rateError ? 'is-live' : ''}`}><span className="pulse" />{marketStatus}</div>
      </header>

      <main id="top" className="main-grid">
        <section className="intro">
          <div className="eyebrow"><span className="shield">◈</span> PRIVATE PAYMENTS FOR AFRICA</div>
          <h1>Send local currency.<br /><em>Keep privacy.</em></h1>
          <p className="lead">A simple Zcash-powered payment flow for sending NGN or GHS. Set the recipient amount, add their bank details, and review everything before the next transaction stage.</p>

          <div className="market-card"><div><span className="market-label">ZEC / USD</span><strong>{rates ? formatUsd(rates.zecUsd) : '—'}</strong><small>{rates ? `Live · ${rates.source}` : rateError || 'Waiting for market data'}</small></div><button className="refresh" onClick={() => void loadRates()} disabled={loadingRates} aria-label="Refresh market rates"><span className={loadingRates ? 'spin' : ''}>↻</span></button></div>

          <div className="trust-row">
            <div className={step >= 1 ? 'active' : ''}><span>01</span><p>Set amount</p></div>
            <div className={step >= 2 ? 'active' : ''}><span>02</span><p>Recipient details</p></div>
            <div className={step >= 3 ? 'active' : ''}><span>03</span><p>Review</p></div>
          </div>
        </section>

        <section className="card-wrap" aria-label="Private Bill payment flow">
          <div className="exchange-card">
            <div className="flow-progress"><div className="flow-progress-line"><span style={{ width: `${((step - 1) / 2) * 100}%` }} /></div><div className="flow-step"><b className={step >= 1 ? 'done' : ''}>{step > 1 ? '✓' : '1'}</b><span>Amount</span></div><div className="flow-step"><b className={step >= 2 ? 'done' : ''}>{step > 2 ? '✓' : '2'}</b><span>Recipient</span></div><div className="flow-step"><b className={step >= 3 ? 'done' : ''}>{step >= 3 ? '✓' : '3'}</b><span>Review</span></div></div>

            {step === 1 && <>
              <div className="card-head"><div><span className="kicker">STEP 1 OF 3</span><h2>Recipient gets</h2></div></div>
              <div className="field-label">LOCAL CURRENCY</div>
              <div className={`amount-box ${amountError ? 'has-error' : ''}`}>
                <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Recipient amount" placeholder="0" />
                <div className="currency-picker"><button className="currency-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}><span className="flag">{selected.flag}</span><span>{currency}</span><span className="chevron">⌄</span></button>{menuOpen && <div className="currency-menu">{(Object.keys(CURRENCIES) as Currency[]).map(code => <button key={code} onClick={() => chooseCurrency(code)}><span>{CURRENCIES[code].flag}</span><span>{code}</span><small>{CURRENCIES[code].name}</small></button>)}</div>}</div>
              </div>
              {amountError && <p className="field-error">{amountError}</p>}
              <div className="rate-line"><span>{loadingRates ? 'Fetching live rate…' : rateError ? 'Rate unavailable' : 'Live conversion rate'}</span><span>{conversion ? `1 ZEC ≈ ${selected.symbol}${formatRate(conversion.fiatPerZec, currency)}` : '—'}</span></div>
              <div className="connector"><span>↓</span></div>
              <div className="field-label">YOU PAY</div>
              <div className={`zec-box ${!conversion ? 'is-unavailable' : ''}`}><div><strong>{conversion ? formatZec(conversion.zecAmount) : '—'}</strong><span>ZEC</span></div><span className="zec-badge">Z</span></div>
              <div className="quote-grid"><div><span>Recipient receives</span><strong>{formatFiat(numericAmount, currency)}</strong></div><div><span>Approx. value</span><strong>{conversion ? formatUsd(conversion.usdValue) : '—'}</strong></div><div><span>ZEC market price</span><strong>{rates ? formatUsd(rates.zecUsd) : '—'}</strong></div><div><span>Rate updated</span><strong>{lastUpdated}</strong></div></div>
              <div className={`notice ${rateError ? 'notice-error' : ''}`}><span className="notice-icon">i</span><p>{rateError ? `${rateError} No hard-coded exchange rate is used. Refresh and try again.` : 'Live market data is used for the quote. Your recipient details are collected only in the next step.'}</p></div>
              <button className="primary" onClick={continueToDetails} disabled={loadingRates || !conversion}>Continue to recipient <span>→</span></button>
              <p className="status-text">{status}</p>
            </>}

            {step === 2 && <>
              <div className="card-head details-head"><div><span className="kicker">STEP 2 OF 3</span><h2>Where should it go?</h2><p className="subhead">Enter the recipient's bank details. Nothing is sent yet.</p></div><span className="secure-chip">🔒 Private</span></div>
              <div className="amount-summary"><div><span>Recipient receives</span><strong>{formatFiat(numericAmount, currency)}</strong></div><div><span>You pay</span><strong>{conversion ? `${formatZec(conversion.zecAmount)} ZEC` : '—'}</strong></div></div>
              <div className="details-form">
                <div className="form-field full"><label htmlFor="country">Country & currency</label><div className="locked-select"><span>{selected.flag}</span><div><strong>{selected.country}</strong><small>{currency} · {selected.name}</small></div><span className="lock">✓</span></div><p className="helper">Matched automatically to the currency selected above.</p></div>
                <div className="form-field full"><label>Recipient bank</label><div className={`bank-combobox ${touched.bankName && bankErrors.bankName ? 'invalid' : ''}`}><button type="button" className="bank-trigger" onClick={() => setBankMenuOpen(!bankMenuOpen)} aria-expanded={bankMenuOpen}><span className="bank-avatar">{bank.bankName ? bank.bankName.charAt(0) : '⌕'}</span><span className={bank.bankName ? 'selected-bank-name' : 'placeholder'}>{bank.bankName || 'Search a bank, fintech or wallet'}</span><span className="chevron">⌄</span></button>{bankMenuOpen && <div className="bank-menu"><div className="bank-search-wrap"><span>⌕</span><input autoFocus value={bankSearch} onChange={e => setBankSearch(e.target.value)} placeholder="Search banks…" aria-label="Search banks" /></div><div className="bank-results">{loadingBanks ? <div className="bank-empty">Loading financial providers…</div> : bankLoadError ? <div className="bank-empty bank-error-state">{bankLoadError}<button type="button" onClick={() => setBankMenuOpen(false)}>Close and retry</button></div> : filteredBanks.length ? providerGroups.map(group => { const items = filteredBanks.filter(item => item.type === group.type); return items.length ? <div className="bank-group" key={group.type}><div className="bank-group-label">{group.label}</div>{items.map(item => <button type="button" className="bank-option" key={item.id} onClick={() => { setBank({ ...bank, bankName: item.name, bankCode: item.code || '' }); setBankMenuOpen(false); setBankSearch(''); setTouched({ ...touched, bankName: true }) }}><span className="bank-avatar">{item.name.charAt(0)}</span><span><strong>{item.name}</strong><small>{providerLabel(item.type)} · {item.code ? `code ${item.code}` : 'account / wallet number'}</small></span>{bank.bankName === item.name && <b>✓</b>}</button>)}</div> : null }) : <div className="bank-empty">No financial providers match “{bankSearch}”.</div>}</div></div>}</div>{touched.bankName && bankErrors.bankName && <p className="field-error">{bankErrors.bankName}</p>}<p className="helper">Choose a traditional bank, fintech/digital bank, or supported wallet. The provider type and code are retained for the next transaction stage.</p></div>
                <div className="form-field"><label htmlFor="accountNumber">Account number</label><input id="accountNumber" inputMode="numeric" autoComplete="off" value={bank.accountNumber} onChange={e => setBank({ ...bank, accountNumber: e.target.value.replace(/[^A-Za-z0-9\- ]/g, '') })} onBlur={() => setTouched({ ...touched, accountNumber: true })} placeholder="Enter account number" className={touched.accountNumber && bankErrors.accountNumber ? 'invalid' : ''} />{touched.accountNumber && bankErrors.accountNumber && <p className="field-error">{bankErrors.accountNumber}</p>}</div>
                <div className="form-field full"><label htmlFor="accountName">Account name</label><input id="accountName" autoComplete="name" value={bank.accountName} onChange={e => setBank({ ...bank, accountName: e.target.value })} onBlur={() => setTouched({ ...touched, accountName: true })} placeholder="Enter the name on the account" className={touched.accountName && bankErrors.accountName ? 'invalid' : ''} />{touched.accountName && bankErrors.accountName && <p className="field-error">{bankErrors.accountName}</p>}</div>
              </div>
              <div className="privacy-note"><span>◈</span><div><strong>We keep this step minimal.</strong><p>Bank details stay in the current transaction flow and are not written to logs by this interface.</p></div></div>
              <div className="button-row"><button className="secondary" onClick={() => setStep(1)}>← Back</button><button className="primary" onClick={submitDetails} disabled={!conversion}>Review details <span>→</span></button></div>
            </>}

            {step === 3 && <>
              <div className="card-head details-head"><div><span className="kicker">STEP 3 OF 3</span><h2>Review before sending</h2><p className="subhead">Check the details below. The next stage can use this transaction data.</p></div><span className="secure-chip">✓ Ready</span></div>
              <div className="review-amount"><span>Recipient receives</span><strong>{formatFiat(numericAmount, currency)}</strong><small>{selected.flag} {selected.name}</small></div>
              <div className="review-zec"><div><span>Required ZEC</span><strong>{conversion ? `${formatZec(conversion.zecAmount)} ZEC` : '—'}</strong></div><span>Live quote · updated {lastUpdated}</span></div>
              <div className="review-list"><div><span>Recipient gets</span><strong>{formatFiat(numericAmount, currency)}</strong></div><div><span>Exchange rate</span><strong>{conversion ? `1 ZEC ≈ ${selected.symbol}${formatRate(conversion.fiatPerZec, currency)}` : '—'}</strong></div><div><span>ZEC / USD</span><strong>{rates ? formatUsd(rates.zecUsd) : '—'}</strong></div><div><span>Bank / provider</span><strong>{bank.bankName}</strong></div><div><span>Account name</span><strong>{bank.accountName}</strong></div><div><span>Account number</span><strong>{maskAccount(bank.accountNumber)}</strong></div><div><span>Destination</span><strong>{selected.country} · {currency}</strong></div><div><span>Fees</span><strong>Not added in this stage</strong></div></div>
              <div className="review-warning"><span>!</span><p>Review carefully before continuing. No order, bank transfer, or ZEC transaction is created or initiated by this screen.</p></div>
              <div className="button-row"><button className="secondary" onClick={() => setStep(2)}>← Edit details</button><button className="primary" onClick={() => showToast('Transaction reviewed — ready for order creation.')}>Confirm & continue <span>→</span></button></div>
            </>}
          </div>
          <div className="card-foot"><span>🔒</span> Privacy-first flow · Recipient data is kept in memory for the current flow</div>
        </section>
      </main>

      <section className="feature-strip"><div><span className="feature-icon">◎</span><div><strong>Guided flow</strong><p>Amount → recipient → review.</p></div></div><div><span className="feature-icon">⌁</span><div><strong>Clear validation</strong><p>Errors appear beside the field that needs attention.</p></div></div><div><span className="feature-icon">◈</span><div><strong>Privacy by design</strong><p>No unnecessary sensitive data is exposed.</p></div></div></section>
      <footer><span>PRIVATE BILL · Zcash Privacy Developers Residency</span><span>Quest 04 · Transaction Review</span></footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export default App
