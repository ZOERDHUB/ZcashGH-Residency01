# ZDR-002 — Interactive Zcash Architecture & Address Guide

A beginner-friendly, client-side web application built for the **Zcash Privacy Developers Residency — Task 02**.

The project explains Zcash's origins, network architecture, full-node implementations, address formats, privacy characteristics, and learning resources through an interactive interface.

## Features

### 1. Zcash Origins Timeline
Interactive milestones covering:

- Zerocoin research paper — 2013
- Zerocash research paper — 2014
- Zcash mainnet launch — October 28, 2016
- Sapling — 2018
- Orchard / Network Upgrade 5 — 2022
- Unified Addresses and modern wallet UX

### 2. Network Architecture

The application visualizes the conceptual flow:

`Full node → light-client/indexing service → wallet/application`

Full nodes independently validate and maintain blockchain state. Light-client infrastructure such as `lightwalletd` can provide compact blockchain information to wallets without requiring each lightweight client to download the complete chain.

### 3. Full-node Comparison

The application compares:

- Zebra
- Zakura

**Note about the task wording:** the task brief says "Sakura". Current official Zcash ecosystem sources identify **Zakura** as a consensus-compatible Zcash full-node implementation. This project therefore uses "Zakura" rather than presenting an unverified "Sakura" implementation as official.

### 4. Address Identifier

The address identifier checks only the address string supplied by the user.

Supported categories:

- Transparent: mainnet `t1...` / `t3...`
- Sapling: mainnet `zs1...`
- Unified Address: `u1...`
- Unknown / unsupported

The application performs local format checks and does not connect to a blockchain node, wallet, RPC service, or API.

It does **not** request or process:

- Private keys
- Seed phrases
- Spending keys
- Passwords
- Wallet credentials

No address input is intentionally persisted to a backend or local storage.

> This is an educational format identifier, not a complete production-grade Zcash address parser.

### 5. Learning Resources

The app links to official or reliable resources including:

- Zcash Documentation
- Zcash Protocol Specification
- Zcash Improvement Proposals (ZIPs)
- Zcash Foundation
- ZecHub
- Zcash Discord

## Technology

- React
- Vite
- JavaScript
- CSS
- No backend
- No wallet connection
- No external runtime API required

## Run locally

Requirements:

- Node.js 18+ recommended
- npm

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Address validation approach

The demo uses:

- Transparent-address prefix + Base58-like character checks + expected mainnet length
- Sapling `zs1` prefix + expected length + Bech32 checksum
- Unified `u1` prefix + Bech32m checksum
- Otherwise: unknown / unsupported

The identifier deliberately does not query the Zcash network. It only identifies the general format.

## Architecture represented

```text
┌───────────────────┐
│ Zcash Full Node   │
│ Zebra / Zakura    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Light-client /    │
│ indexing service  │
│ e.g. lightwalletd │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Wallets & Apps    │
└───────────────────┘
```

A full node fully enforces the rules of the blockchain. A light client can reference a trusted full node's copy of the blockchain rather than downloading and validating the entire chain itself. `lightwalletd` serves light clients with blockchain information.

## What I learned

This task helped connect Zcash's history to its current architecture:

1. Zcash's privacy work grew from the Zerocoin and Zerocash research.
2. Shielded protocols evolved from Sprout to Sapling and Orchard.
3. Unified Addresses improve usability by bundling receiver types.
4. Full nodes and light-client infrastructure serve different roles.
5. An address format can be identified locally without connecting to a wallet or handling private credentials.

## Challenges

The main challenge was designing address detection that is useful for beginners without pretending to be a complete wallet parser.

I also had to distinguish the address format from the validity or balance of an address. The application intentionally performs only local structural checks and never checks funds or transaction history.

Another documentation challenge was the task's reference to "Sakura". Current official Zcash ecosystem sources identify the relevant full-node implementation as **Zakura**, so the application explicitly documents that distinction.

## Sources consulted

1. Zcash Documentation — Project History  
   https://zcash.readthedocs.io/en/latest/rtd_pages/basics.html

2. Zcash Documentation — Light Client Development  
   https://zcash.readthedocs.io/en/latest/rtd_pages/lightclient_support.html

3. Zcash Protocol Specification  
   https://zips.z.cash/protocol/protocol.pdf

4. ZIP 316 — Unified Addresses and Unified Viewing Keys  
   https://zips.z.cash/zip-0316

5. ZIP 224 — Orchard Shielded Protocol  
   https://zips.z.cash/zip-0224

6. ZIPs — Zcash Improvement Proposals  
   https://zips.z.cash/

7. Zcash Foundation — Zebra  
   https://github.com/ZcashFoundation/zebra

8. Zakura — Zcash full node  
   https://github.com/zakura-core/zakura

9. ZecHub — Visualizing Zcash Addresses  
   https://zechub.wiki/guides/visualizing-zcash-addresses

## Screenshots

Add at least three screenshots before submission:

```text
screenshots/
├── home.png
├── architecture.png
└── address-identifier.png
```

Recommended captures:

1. Hero + Origins timeline
2. Architecture + full-node comparison
3. Address Identifier with a test/example address and the resulting classification

## Security

Before committing:

```bash
git status
```

Confirm that no `.env`, credentials, private keys, seed phrases, API keys, or wallet files are included.

This project intentionally has no secret configuration.

## Author

**Kodjo Labore Agbetsiassi**  
Zcash Privacy Developers Residency — Task 02
