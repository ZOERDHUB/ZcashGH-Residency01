/**
 * Private Bill — rate provider contract
 * ----------------------------------------
 * Every provider in js/rateProviders/ implements a subset of this
 * shape. rateService.js only ever calls methods by name — it never
 * imports a specific provider by name for its logic — so adding or
 * replacing a rate source means adding a new file here and listing it
 * in rateService.js's provider chains. Nothing in converter.js or
 * app.js needs to change.
 *
 * A CRYPTO PRICE PROVIDER implements:
 *   async getZecUsd() -> number
 *     Resolves to the current ZEC price in USD, or throws/rejects if
 *     it can't be determined.
 *
 * An FX RATE PROVIDER implements:
 *   async getFxRates() -> { NGN: number, GHS: number, ... }
 *     Resolves to an object of "units of currency per 1 USD" for
 *     whichever currencies it supports. rateService only reads the
 *     keys it needs (NGN, GHS today); a provider can return more.
 *
 * A provider MAY implement both if a single source covers both (none
 * currently does — see the README for why CoinGecko and the FX API
 * are kept as separate providers).
 *
 * This file exports nothing executable; it's documentation the other
 * provider files are written against.
 */
