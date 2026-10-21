# Private Bill — Quest 01: Exchange Interface

A polished frontend prototype for the Zcash Privacy Developers Residency **Private Bill** project.

## What this quest implements

The interface lets a user:

- Select a recipient currency: **NGN** or **GHS**.
- Enter the amount the recipient should receive.
- See the current ZEC/USD market price.
- See live USD → NGN / USD → GHS FX rates.
- Calculate the approximate ZEC required for the recipient amount.
- Review the quote before moving to the next step.
- See a clear fallback state if a public market endpoint is unavailable.

Quest 01 is intentionally frontend-only. It does **not** connect a wallet, create transactions, collect bank details, or move funds.

## Market data

The prototype uses public market endpoints directly from the browser:

- ZEC/USD: CoinGecko simple price API.
- USD/NGN and USD/GHS: ExchangeRate-API open endpoint.

The quote is calculated as:

`ZEC required = recipient amount / (ZEC/USD × USD/local currency)`

Rates refresh automatically every 60 seconds and can also be refreshed manually.

If a request fails, the UI switches to a clearly labelled fallback reference quote instead of pretending that the data is live.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Production build

```bash
npm run build
```

## Tech

- React
- TypeScript
- Vite
- CSS
- Browser Fetch API

## Quest scope

This implementation follows the initial exchange-interface requirement: local currency selection, recipient amount, and the ZEC required to fund the transaction. Later quests can build on the review state with recipient bank details, payment orders, tracking, conversion and payout logic.

## Safety

No private keys, seed phrases, wallet credentials or real funds are used.

## Notes

Market prices and FX rates move continuously. A production system should use a backend quote service, authenticated/validated market feeds, execution-time slippage handling, provider health checks, and explicit fee/settlement rules before accepting real funds.
