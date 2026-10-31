# Private Bill — Quest 02: Implement ZEC Conversion

Quest 02 extends the Private Bill exchange interface with a modular, runtime ZEC conversion layer for Nigerian Naira (NGN) and Ghanaian Cedi (GHS).

## What this quest implements

- Retrieves the live ZEC/USD market price at runtime.
- Retrieves live USD → NGN and USD → GHS rates.
- Calculates the ZEC amount required for the recipient's selected fiat amount.
- Clearly displays the ZEC amount, fiat-per-ZEC rate, USD equivalent and update time.
- Supports both NGN and GHS without changing the exchange interface.
- Refreshes rates automatically every 60 seconds and supports manual refresh.
- Handles provider failures without silently using a stale or hard-coded production exchange rate.
- Keeps conversion logic separate from UI code so the market-rate source can be replaced later.

## Conversion formula

```text
USD value = fiat amount / USD-to-local rate
Fiat per ZEC = ZEC/USD price × USD-to-local rate
ZEC required = fiat amount / Fiat per ZEC
```

For example, the implementation never embeds a fixed ZEC/NGN or ZEC/GHS rate in the conversion function. It consumes the current `ConversionRates` object supplied by the market-data layer.

## Architecture

```text
React UI
   │
   ├── src/market.ts
   │      └── fetches ZEC/USD + USD/NGN + USD/GHS
   │
   └── src/conversion.ts
          └── pure fiat → ZEC conversion logic

React UI ← conversion result ← rates
```

The interface and conversion calculation are deliberately separated. A future backend, oracle, exchange aggregator or authenticated market-data service can replace `src/market.ts` without rewriting the conversion function or UI.

## Rate sources

- ZEC/USD: CoinGecko public simple-price endpoint.
- USD/NGN and USD/GHS: ExchangeRate-API open endpoint.

These are public development data sources. A production payment system should move market-data retrieval behind a controlled backend/provider layer with validation, rate limits, freshness checks, provider redundancy and execution-time pricing rules.

## Error handling

If either market-data provider fails or returns invalid values, the UI:

- marks the market quote as unavailable;
- does not invent a ZEC amount;
- disables Continue until a valid live conversion is available; and
- lets the user manually retry.

## Run locally

```bash
npm install
npm run dev
```

Production build:

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

Quest 01's exchange interface is preserved. Quest 02 adds the conversion functionality required to determine how much ZEC funds the selected NGN/GHS recipient amount. It does not create transactions, connect wallets, collect bank credentials or move funds.

## Security

No private keys, seed phrases, wallet credentials or real funds are used.
