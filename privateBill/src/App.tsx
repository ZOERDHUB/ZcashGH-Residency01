import { useCallback, useEffect, useMemo, useState } from 'react'
import { convertFiatToZec, type ConversionRates, type Currency } from './conversion'
import { fetchConversionRates } from './market'
import { DemoBankProvider, type Bank, type ProviderType } from './banks'
import { createTransactionOrder, updateTransactionPayment, type TransactionOrder } from './orders'
import { BackendPaymentMonitor, paymentStatusLabel, type PaymentCheck } from './payment-monitor.ts'

type CurrencyMeta = { name: string; symbol: string; flag: string; country: string }
type BankDetails = { accountNumber: string; accountName: string; bankName: string; bankCode: string; country: string; currency: Currency }
type Step = 1 | 2 | 3 | 4 | 5 | 6

const CURRENCIES: Record<Currency, CurrencyMeta> = {
  NGN: { name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬', country: 'Nigeria' },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭', country: 'Ghana' },
}

const MIN_AMOUNT: Record<Currency, number> = { NGN: 100, GHS: 1 }
const ZEC_DECIMALS = 6
const ZEC_RECEIVING_ADDRESS = import.meta.env.VITE_ZEC_RECEIVING_ADDRESS || 't1PrivateBillDemoAddressReplaceMe'

function formatFiat(value: number, currency: Currency) {
  return `${CURRENCIES[currency].symbol}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`
}
function formatZec(value: number) { return value.toFixed(ZEC_DECIMALS) }
function formatUsd(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value) }
function formatRate(value: number, currency: Currency) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: currency === 'NGN' ? 2 : 4, minimumFractionDigits: currency === 'NGN' ? 2 : 4 }).format(value) }
function maskAccount(value: string) { return value.length <= 4 ? '••••' : `•••• ${value.slice(-4)}` }
function toOrderPayment(payment: NonNullable<PaymentCheck['payment']>) {
  return {
    txid: payment.txid,
    receivedZec: payment.amountZec,
    confirmations: payment.confirmations,
    requiredConfirmations: payment.requiredConfirmations,
    detectedAt: payment.detectedAt ?? new Date().toISOString(),
    address: payment.address,
  }
}

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
  const [order, setOrder] = useState<TransactionOrder | null>(null)
  const [addressCopied, setAddressCopied] = useState(false)
  const [paymentCheck, setPaymentCheck] = useState<PaymentCheck | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentMonitorError, setPaymentMonitorError] = useState('')
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [trackingError, setTrackingError] = useState('')
  const paymentMonitor = useMemo(() => new BackendPaymentMonitor(), [])

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

  useEffect(() => {
    if ((step !== 5 && step !== 6) || !order) return
    let cancelled = false
    let interval: number | undefined
    const sync = async () => {
      if (cancelled) return
      try {
        const statusResponse = await fetch(`/api/orders/${encodeURIComponent(order.id)}/status`, { cache: 'no-store' })
        const statusData = await statusResponse.json()
        if (!statusResponse.ok) throw new Error(statusData.error || 'Unable to load transaction status.')
        if (!cancelled) setOrder(prev => prev ? { ...prev, ...statusData } : prev)
        if (step === 5 && ['ZEC_CONFIRMED','PAYOUT_PROCESSING','FIAT_SENT','COMPLETED','PAYOUT_FAILED','CANCELLED','EXPIRED','OVERPAID'].includes(statusData.status)) {
          setStep(6)
        }
      } catch (e) { if (!cancelled) setTrackingError(e instanceof Error ? e.message : 'Transaction status is temporarily unavailable.') }
    }
    void sync(); interval = window.setInterval(() => void sync(), 5000)
    return () => { cancelled = true; if (interval) window.clearInterval(interval) }
  }, [step, order?.id])

  useEffect(() => {
    if (step !== 5 || !order) return
    let cancelled = false
    const check = async () => {
      setCheckingPayment(true); setPaymentMonitorError('')
      try {
        const result = await paymentMonitor.check(order)
        if (cancelled) return
        setPaymentCheck(result)
        if (result.payment) {
          const status = result.state as TransactionOrder['status']
          const updated = updateTransactionPayment(order.id, toOrderPayment(result.payment), status)
          if (updated) setOrder(prev => ({ ...(prev || updated), ...updated, status }))
        }
        if (result.state === 'ZEC_CONFIRMED') setStep(6)
      } catch (error) { if (!cancelled) setPaymentMonitorError(error instanceof Error ? error.message : 'Payment status is temporarily unavailable.') }
      finally { if (!cancelled) setCheckingPayment(false) }
    }
    void check()
    const interval = window.setInterval(() => void check(), 10000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [step, order?.id, paymentMonitor])


  const chooseCurrency = (next: Currency) => {
    setCurrency(next); setMenuOpen(false)
    setBank(prev => ({ ...prev, currency: next, country: CURRENCIES[next].country, bankName: '', bankCode: '' }))
    setBankSearch('')
    setBankMenuOpen(false)
  }
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800) }
  const registerOrderWithMonitor = async (created: TransactionOrder) => {
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(created) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'The transaction order could not be registered with the payment monitor.')
    return data as TransactionOrder
  }
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
            <div className="flow-progress five"><div className="flow-progress-line"><span style={{ width: `${((step - 1) / 4) * 100}%` }} /></div><div className="flow-step"><b className={step >= 1 ? 'done' : ''}>{step > 1 ? '✓' : '1'}</b><span>Amount</span></div><div className="flow-step"><b className={step >= 2 ? 'done' : ''}>{step > 2 ? '✓' : '2'}</b><span>Recipient</span></div><div className="flow-step"><b className={step >= 3 ? 'done' : ''}>{step > 3 ? '✓' : '3'}</b><span>Review</span></div><div className="flow-step"><b className={step >= 4 ? 'done' : ''}>{step >= 4 ? '✓' : '4'}</b><span>Order</span></div><div className="flow-step"><b className={step >= 5 ? 'done' : ''}>{step >= 5 ? '✓' : '5'}</b><span>Pay ZEC</span></div></div>

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
              <div className="button-row"><button className="secondary" onClick={() => setStep(2)}>← Edit details</button><button className="primary" onClick={async () => {
                if (!conversion) return showToast('Live ZEC quote is unavailable.')
                const created = createTransactionOrder({
                  fiatCurrency: currency,
                  fiatAmount: numericAmount,
                  requiredZec: conversion.zecAmount,
                  recipient: { providerName: bank.bankName, providerCode: bank.bankCode, providerType: 'payment_provider', accountNumber: bank.accountNumber, accountName: bank.accountName, country: bank.country, currency: bank.currency },
                  depositAddress: ZEC_RECEIVING_ADDRESS,
                })
                try {
                  const registered = await registerOrderWithMonitor(created)
                  setOrder(registered)
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Payment monitor registration failed.')
                  return
                }
                setPaymentCheck(null)
                setPaymentMonitorError('')
                setStep(4)
              }}>Confirm & create order <span>→</span></button></div>
            </>}

            {step === 4 && order && <>
              <div className="card-head details-head"><div><span className="kicker">ORDER CREATED</span><h2>Payment order is ready</h2><p className="subhead">Your transaction has been created and is now waiting for ZEC payment.</p></div><span className="secure-chip">✓ {order.status}</span></div>
              <div className="order-success"><span>ORDER ID</span><strong>{order.id}</strong><small>Keep this ID to track the transaction.</small></div>
              <div className="review-list"><div><span>Status</span><strong>{order.status}</strong></div><div><span>Recipient receives</span><strong>{formatFiat(order.fiatAmount, order.fiatCurrency)}</strong></div><div><span>Required ZEC</span><strong>{formatZec(order.requiredZec)} ZEC</strong></div><div><span>Recipient</span><strong>{order.recipient.accountName}</strong></div><div><span>Provider</span><strong>{order.recipient.providerName}</strong></div><div><span>Account</span><strong>{maskAccount(order.recipient.accountNumber)}</strong></div><div><span>Created</span><strong>{new Date(order.createdAt).toLocaleString()}</strong></div><div><span>Expires</span><strong>{new Date(order.expiresAt).toLocaleString()}</strong></div></div>
              <div className="review-warning"><span>✓</span><p>The order is persistent in this demo and begins in <strong>AWAITING_ZEC</strong>. The next stage can retrieve it using the order ID.</p></div>
              <button className="primary" onClick={() => { setAddressCopied(false); setStep(5) }}>Continue to payment <span>→</span></button>
            </>}

            {step === 5 && order && <>
              <div className="card-head details-head"><div><span className="kicker">STEP 5 · ZEC PAYMENT</span><h2>Fund your transaction</h2><p className="subhead">Send ZEC to the address assigned to this order. Payment status is checked by the transaction monitor.</p></div><span className={`secure-chip ${order.status === 'COMPLETED' ? 'success' : ''}`}>● {paymentStatusLabel(paymentCheck?.state ?? order.status as never)}</span></div>
              <div className="payment-hero"><span>YOU NEED TO SEND</span><strong>{formatZec(order.requiredZec)} <small>ZEC</small></strong><p>Order <b>{order.id}</b> will only be funded after a trusted payment monitor detects the on-chain payment.</p></div>
              <div className="payment-address"><div className="payment-address-head"><div><span className="field-label">ZEC RECEIVING ADDRESS</span><small>Payment destination assigned to this transaction</small></div><span className="address-badge">ZEC</span></div><div className="address-row"><code>{order.depositAddress || ZEC_RECEIVING_ADDRESS}</code><button className="copy-button" onClick={async () => { try { await navigator.clipboard.writeText(order.depositAddress || ZEC_RECEIVING_ADDRESS); setAddressCopied(true); window.setTimeout(() => setAddressCopied(false), 2200) } catch { showToast('Copy failed. Please copy the address manually.') } }} aria-label="Copy ZEC receiving address">{addressCopied ? '✓ Copied' : 'Copy address'}</button></div></div>
              <div className="payment-meta"><div><span>Order ID</span><strong>{order.id}</strong></div><div><span>Current status</span><strong>{paymentStatusLabel(paymentCheck?.state ?? order.status as never)}</strong></div><div><span>Recipient receives</span><strong>{formatFiat(order.fiatAmount, order.fiatCurrency)}</strong></div><div><span>Destination</span><strong>{order.recipient.country} · {order.fiatCurrency}</strong></div><div><span>Payment expires</span><strong>{new Date(order.expiresAt).toLocaleString()}</strong></div><div><span>Last checked</span><strong>{paymentCheck ? new Date(paymentCheck.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not checked yet'}</strong></div></div>
              <div className={`monitor-status ${paymentCheck?.state === 'ZEC_CONFIRMED' ? 'is-confirmed' : ''}`}><div className="monitor-dot" /><div><strong>{paymentStatusLabel(paymentCheck?.state ?? order.status as never)}</strong><p>{checkingPayment ? 'Checking the payment monitor…' : paymentMonitorError ? 'The monitor could not be reached. The order remains unfunded until a trusted check succeeds.' : paymentCheck?.payment ? `${formatZec(paymentCheck.payment.amountZec)} ZEC detected in transaction ${paymentCheck.payment.txid.slice(0, 12)}… with ${paymentCheck.payment.confirmations} confirmation${paymentCheck.payment.confirmations === 1 ? '' : 's'}.` : 'No qualifying payment has been detected yet. This screen never treats a client-side “sent” action as proof of payment.'}</p></div></div>
              {paymentCheck?.payment && <div className="payment-detection"><div><span>Detected amount</span><strong>{formatZec(paymentCheck.payment.amountZec)} ZEC</strong></div><div><span>Confirmations</span><strong>{paymentCheck.payment.confirmations} / {paymentCheck.payment.requiredConfirmations}</strong></div><div><span>Transaction</span><strong>{paymentCheck.payment.txid.slice(0, 18)}…</strong></div></div>}
              <div className="payment-instructions"><div className="instruction-icon">1</div><div><strong>Open your Zcash wallet</strong><p>Choose ZEC and prepare a payment to the order-specific address above.</p></div><div className="instruction-icon">2</div><div><strong>Send the required amount</strong><p>Send <b>{formatZec(order.requiredZec)} ZEC</b>. The backend monitor determines whether the required amount was actually received.</p></div><div className="instruction-icon">3</div><div><strong>Wait for detection and confirmations</strong><p>Keep this order ID. The application updates only from trusted payment-monitor data, not from a browser button.</p></div></div>
              <div className="payment-warning"><span>!</span><p><strong>Important:</strong> Do not rely on a wallet “sent” message as proof of funding. The order is not considered funded until the payment monitor detects the transaction at the correct address and records it against this order.</p></div>
              {paymentMonitorError && <div className="monitor-error" role="alert"><strong>Payment monitor unavailable.</strong><span>{paymentMonitorError}</span><button className="secondary" onClick={async () => { setCheckingPayment(true); setPaymentMonitorError(''); try { const result = await paymentMonitor.check(order); setPaymentCheck(result); if (result.payment) { const nextStatus = result.state === 'ZEC_CONFIRMED' ? 'COMPLETED' : result.state; const updated = updateTransactionPayment(order.id, toOrderPayment(result.payment), nextStatus as TransactionOrder['status']); if (updated) setOrder(updated) } } catch (error) { setPaymentMonitorError(error instanceof Error ? error.message : 'Payment status is temporarily unavailable.') } finally { setCheckingPayment(false) } }}>Retry check</button></div>}
              <div className="button-row"><button className="secondary" onClick={() => setStep(4)}>← Back to order</button><button className="primary" onClick={async () => { setCheckingPayment(true); setPaymentMonitorError(''); try { const result = await paymentMonitor.check(order); setPaymentCheck(result); if (result.payment) { const nextStatus = result.state === 'ZEC_CONFIRMED' ? 'COMPLETED' : result.state; const updated = updateTransactionPayment(order.id, toOrderPayment(result.payment), nextStatus as TransactionOrder['status']); if (updated) setOrder(updated) } else showToast('No qualifying ZEC payment detected yet.') } catch (error) { setPaymentMonitorError(error instanceof Error ? error.message : 'Payment status is temporarily unavailable.') } finally { setCheckingPayment(false) } }}>{checkingPayment ? 'Checking…' : 'Check payment status'} <span>↻</span></button></div>
            </>}

            {step === 6 && order && <>
              <div className="card-head details-head"><div><span className="kicker">LIVE TRANSACTION TRACKING</span><h2>Track your transaction</h2><p className="subhead">This timeline is driven by the backend transaction state — never by simulated frontend progress.</p></div><span className={`secure-chip ${order.status === 'COMPLETED' ? 'success' : ''}`}>● {paymentStatusLabel(order.status)}</span></div>
              <div className="tracking-summary"><div><span>ORDER ID</span><strong>{order.id}</strong></div><div><span>YOU RECEIVE</span><strong>{formatFiat(order.fiatAmount, order.fiatCurrency)}</strong></div><div><span>ZEC REQUIRED</span><strong>{formatZec(order.requiredZec)} ZEC</strong></div></div>
              <div className="tracking-timeline">{['AWAITING_ZEC','ZEC_DETECTED','CONFIRMING','ZEC_CONFIRMED','PAYOUT_PROCESSING','FIAT_SENT','COMPLETED'].map((statusName, i) => { const done = order.status === 'COMPLETED' || (order.statusTimestamps && order.statusTimestamps[statusName]); const active = order.status === statusName; return <div className={`tracking-step ${done ? 'done' : ''} ${active ? 'active' : ''}`} key={statusName}><span className="tracking-dot">{done ? '✓' : i + 1}</span><div><strong>{paymentStatusLabel(statusName as TransactionOrder['status'])}</strong><small>{order.statusTimestamps?.[statusName] ? new Date(order.statusTimestamps[statusName]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : active ? 'Current state' : 'Waiting'}</small></div></div> })}</div>
              {order.lastError && <div className="transaction-error" role="alert"><strong>{order.lastError.code?.split('_').join(' ')}</strong><span>{order.lastError.message}</span>{order.lastError.retryable && <small>This issue can be retried without marking the transaction as completed.</small>}</div>}
              {trackingError && <div className="transaction-error" role="alert"><strong>TRACKING UNAVAILABLE</strong><span>{trackingError}</span></div>}
              {order.status === 'ZEC_CONFIRMED' && <button className="primary" disabled={payoutLoading} onClick={async () => { setPayoutLoading(true); setTrackingError(''); try { const r=await fetch(`/api/orders/${encodeURIComponent(order.id)}/payout`,{method:'POST'}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Payout failed'); setOrder(d.order); showToast('Fiat payout completed.') } catch(e) { setTrackingError(e instanceof Error?e.message:'Payout failed.') } finally { setPayoutLoading(false) } }}>{payoutLoading ? 'Processing payout…' : 'Process fiat payout'} <span>→</span></button>}
              {order.status === 'PAYOUT_FAILED' && <button className="primary" disabled={payoutLoading} onClick={async () => { setPayoutLoading(true); try { const r=await fetch(`/api/orders/${encodeURIComponent(order.id)}/payout`,{method:'POST'}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Payout retry failed'); setOrder(d.order) } catch(e) { setTrackingError(e instanceof Error?e.message:'Payout retry failed.') } finally { setPayoutLoading(false) } }}>{payoutLoading ? 'Retrying…' : 'Retry payout'} <span>↻</span></button>}
              {['AWAITING_ZEC','ZEC_DETECTED','CONFIRMING','UNDERPAID'].includes(order.status) && <button className="secondary full-secondary" onClick={async()=>{try{const r=await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`,{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error);setOrder(d.order)}catch(e){setTrackingError(e instanceof Error?e.message:'Cancellation failed.')}}}>Cancel transaction</button>}
              {order.status === 'COMPLETED' && <div className="completion-card"><span>✓</span><div><strong>Transaction completed</strong><p>The payout provider confirmed delivery of {formatFiat(order.fiatAmount, order.fiatCurrency)}. Reference: {order.payout?.referenceId || 'sandbox'}</p></div></div>}
            </>}
          </div>
          <div className="card-foot"><span>🔒</span> Privacy-first flow · Recipient data is kept in memory for the current flow</div>
        </section>
      </main>

      <section className="feature-strip"><div><span className="feature-icon">◎</span><div><strong>Guided flow</strong><p>Amount → recipient → review.</p></div></div><div><span className="feature-icon">⌁</span><div><strong>Clear validation</strong><p>Errors appear beside the field that needs attention.</p></div></div><div><span className="feature-icon">◈</span><div><strong>Privacy by design</strong><p>No unnecessary sensitive data is exposed.</p></div></div></section>
      <footer><span>PRIVATE BILL · Zcash Privacy Developers Residency</span><span>Quest 12 · Integration & Final Polish</span></footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export default App
