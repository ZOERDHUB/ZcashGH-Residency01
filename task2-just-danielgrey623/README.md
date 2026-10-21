# Zcash Architecture & Address Guide — Task 02 Submission

**Developer:** Danny (Akwenuke Elohona Daniel)
**Program:** Zcash Privacy Developers Residency Programme (Maiden Edition)
**Task:** Task 02 — Build an Interactive Zcash Architecture and Address Guide

## Project Summary

A single-page, framework-free web app that helps a total beginner understand how
Zcash works. It's organised into five tabs:

1. **Origins Timeline** — Zerocoin paper (2013) → Zerocash paper (2014) → Zcash
   launch (2016) → Sapling (2018) → Orchard/Unified Addresses (2022) → 2026
   scaling efforts (Zakura/Project Tachyon).
2. **Network Architecture** — an interactive diagram showing how data flows:
   **Full Node → Light-Client/Indexing Service (e.g. lightwalletd) → Wallet/App**.
3. **Full-Node Comparison** — Zebra vs. Zakura, covering purpose, basic
   requirements, storage options, and the benefits of running a full node.
4. **Address Identifier** — paste any string and the app classifies it as a
   Transparent, Sapling shielded, or Unified Address (or "unknown"), and
   explains that address type's privacy characteristics. Detection is
   **format-only** (prefix + rough length/character-set checks) — it does not
   validate checksums and never asks for private keys, seed phrases, or
   spending keys.
5. **Learning Resources** — links to ZecHub, the Zcash protocol spec, ZIPs,
   and the Zcash Foundation.

## Technologies Used

- Plain **HTML, CSS, and vanilla JavaScript** — no build step, no backend,
  no external dependencies. Chosen so the app is trivial to run, review, and
  audit for the security requirements (nothing is transmitted anywhere).

## Features Completed

- [x] Interactive, expandable Zcash origins timeline
- [x] Clickable network architecture diagram (full node → light client → wallet)
- [x] Zebra vs. Zakura full-node comparison table
- [x] Zcash address format identifier with example addresses and basic
      input validation / error messaging
- [x] Learning resources section with external links
- [x] Responsive layout (desktop + mobile)
- [x] No backend, no live wallet connection, no collection of sensitive data

## How to Run the Project

No build tools or installation required.

1. Download/clone this folder.
2. Open `index.html` directly in any modern browser (double-click it, or
   right-click → Open With → your browser).

Optionally, serve it locally instead of opening the file directly:

```bash
cd task-2/daniel
python3 -m http.server 8080
# then visit http://localhost:8080 in your browser
```

## Zcash Architecture Represented (Short Explanation)

The app illustrates the standard three-layer path data takes in the Zcash
ecosystem:

- **Full nodes** (e.g. Zebra, Zakura) independently download and validate the
  entire blockchain against consensus rules — they are the network's source
  of truth.
- Because most wallets (especially mobile ones) can't realistically store and
  validate the whole chain themselves, a **light-client/indexing service**
  such as `lightwalletd` sits between full nodes and wallets. It indexes
  chain data and serves a lightweight, wallet-friendly feed.
- **Wallets and applications** talk to the light-client service to scan for
  incoming transactions and to build/broadcast new ones, relying on the full
  node network underneath to actually confirm those transactions on-chain.

For the address side, the app distinguishes:

- **Transparent addresses** (`t1...`/`t3...`) — public, Bitcoin-style, no
  shielding.
- **Sapling shielded addresses** (`zs1...`) — sender, receiver, and amount
  are hidden using zk-SNARKs.
- **Unified Addresses** (`u1...`) — a single address that can bundle multiple
  receiver types (transparent, Sapling, Orchard); actual privacy depends on
  which receiver the sending wallet chooses to use.

## Sources Consulted

- Zcash Protocol Specification — https://zips.z.cash/protocol/protocol.pdf
- Zcash Improvement Proposals (ZIPs) — https://zips.z.cash/
- ZecHub — https://zechub.wiki/
- Zcash Foundation — https://www.zfnd.org/
- Zebra documentation — https://zebra.zfnd.org/
- z.cash official site — https://z.cash/
- Zakura full-node announcement/documentation (Valar Group / Project
  Tachyon, released July 2026) — used to confirm the correct project name;
  the task brief's "Sakura" appears to be a mishearing/typo of "Zakura."

## What I Learned

- How the three-tier architecture (full node → light client → wallet) lets
  Zcash support lightweight, mobile-friendly wallets without sacrificing the
  ability to independently verify the chain at the full-node layer.
- The practical difference between address types isn't just cosmetic —
  Transparent, Sapling, and Unified Addresses carry genuinely different
  privacy guarantees, and Unified Addresses in particular have privacy that
  depends on sender behavior, not just the address format itself.
- Why format-only address classification (prefix/length/charset) is enough
  for a beginner-education tool, and why it's important to be explicit that
  this is *not* full checksum/cryptographic validation.

## Difficulties / Challenges Encountered

- Confirming the correct name and details of the newer full-node
  implementation referenced in the task brief ("Sakura"), which required
  cross-checking multiple sources to identify it as **Zakura**.
- Keeping the address identifier honest about its limits — it would have
  been easy to imply full validation; instead the UI and README are explicit
  that this is format detection only.
- Balancing "beginner-friendly" against "technically accurate" — especially
  explaining Unified Address privacy, which is more nuanced than a one-line
  answer.

## Screenshots

*(Add at least 3 screenshots here before submitting — e.g. the Timeline tab,
the Architecture diagram, and the Address Identifier showing a result.)*

1. `screenshots/01-timeline.png`
2. `screenshots/02-architecture.png`
3. `screenshots/03-address-identifier.png`

## Security Notes

- This application does **not** request, collect, or store private keys,
  seed phrases, spending keys, or any other wallet credentials.
- It does **not** connect to any live wallet, node, or network — all data
  used (timeline facts, node comparisons, example addresses) is static and
  embedded in the code for educational purposes.
- The address identifier only inspects the string format the user typed in;
  it performs no lookups and sends no data anywhere.
