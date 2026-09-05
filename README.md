# Interactive Zcash Architecture and Address Guide

A single-page, beginner-friendly web app that explains how the Zcash
ecosystem fits together: where the technology came from, how a payment
physically moves through the network, how the two current full-node
implementations compare, and how to recognize a Zcash address on sight.

Built with plain HTML, CSS, and JavaScript — no framework, no build step,
no dependencies. Open `index.html` in a browser and it runs.

## Files

```
zcash-guide/
├── index.html              structure and content for all five sections
├── styles.css               visual design (dark theme, layout, responsiveness)
├── script.js                 tab switching, timeline/diagram/comparison data,
│                            the address classifier, and the resource list
├── screenshots/             six screenshots of the running app (see below)
└── README.md                 this file
```

Everything is separated by concern: no inline styles or scripts in the
HTML, no markup generation left implicit — `script.js` builds the
timeline markers, the node-comparison columns, the address legend, and
the resource list from small data objects at the top of the file, so
updating content doesn't mean hand-editing HTML in three places.

## How to run it

No server or install required:

1. Download the `zcash-guide` folder.
2. Open `index.html` directly in any modern desktop or mobile browser.

If you'd rather serve it (e.g. to test on a phone on the same network),
any static file server works — for example `python3 -m http.server`
from inside the folder.

---

## The architecture this app represents

Zcash payments pass through three layers, each doing one job:

**1. Full nodes** (`Zebra`, `Zakura`) download and independently validate
every block and transaction against Zcash's consensus rules, hold the
canonical copy of the ledger, and relay data across the peer-to-peer
network. This is the trust-nobody layer — it's what makes the ledger a
shared source of truth rather than something you take on faith from a
company or a website.

**2. Light-client / indexing services** (`lightwalletd`, the newer
`Zaino`) sit between full nodes and applications. They don't re-validate
consensus — they repackage the full node's data into a lightweight,
bandwidth-efficient stream (compact blocks) that a phone or web wallet
can consume without downloading and storing the entire blockchain.

**3. Wallets and applications** (`Zashi`, `Ywallet`, exchanges, block
explorers) pull that compact-block stream from an indexer and use the
user's own keys — locally, on-device — to work out which incoming
transactions belong to them. When sending funds, the wallet builds and
signs the transaction itself, then hands it back through the indexer to
a full node for validation and broadcast.

Data flows both ways along the same chain: **full node → indexer →
wallet** for chain data and balances, and **wallet → indexer → full
node** for outgoing transactions. Splitting the job this way means a
slowdown or bug in the indexing layer can never put the ledger's
integrity at risk — that's the full node's job alone.

On top of that architecture, the app also covers:

- **Two current full-node implementations** — Zebra (the Zcash
  Foundation's from-scratch, memory-safe Rust node, now the primary
  actively maintained validator since `zcashd`'s 2026 retirement) and
  Zakura (an independent fork of Zebra built for much higher
  throughput, with native pruning and downloadable snapshots for a
  fast bootstrap).
- **Four address formats** — transparent (`t1…`/`t3…`), Sprout shielded
  (`zc…`, legacy), Sapling shielded (`zs1…`), and Unified Addresses
  (`u1…`) — with a short, plain-language note on what each one does and
  doesn't reveal on-chain.

## The address identifier tool, and its limits

The tool matches a pasted address against known prefixes and does a
rough length/character-set sanity check. It is **not** a full
cryptographic validator — it doesn't verify bech32 or Base58Check
checksums — and the UI says so whenever a match looks off. It only ever
reads the text typed into the field: it never asks for, stores, or
transmits a private key, seed phrase, or spending key, and there is no
functionality in the code that could collect one.

## Screenshots

All captured from the running app.

| # | File | Shows |
|---|------|-------|
| 1 | `screenshots/01-origins-timeline.png` | Origins timeline, with the 2016 mainnet launch expanded |
| 2 | `screenshots/02-network-architecture.png` | Network architecture diagram, indexer layer selected |
| 3 | `screenshots/03-full-node-comparison.png` | Zebra vs. Zakura comparison |
| 4 | `screenshots/04-address-identifier-transparent.png` | Address identifier detecting a transparent address |
| 5 | `screenshots/05-address-identifier-unified.png` | Address identifier detecting a Unified Address |
| 6 | `screenshots/06-learning-resources.png` | Learning resources list |

## Sources used to verify technical information

- Zcash Foundation, *Zebra README and documentation* — node purpose,
  requirements, and benefits — https://github.com/ZcashFoundation/zebra and https://zebra.zfnd.org/
- *zebrad crate documentation* (docs.rs) — Zebra's advantages over `zcashd` — https://docs.rs/zebrad/latest/zebrad/
- `zcash/zcash` GitHub repository — confirms `zcashd`'s deprecation and its successors, Zebra and Zakura — https://github.com/zcash/zcash
- *zcashd Book* — `zcashd` end-of-support timeline (July 2026) — https://zcash.github.io/zcash/
- Zakura documentation (`docs.rs/crate/zakura-chain`) — Zakura's purpose, pruning/snapshot storage model, and performance claims — https://docs.rs/crate/zakura-chain/latest
- CoinDesk, *"Inside Zcash's new node that targets Visa-scale privacy"* (July 2026) — Zakura's role in Project Tachyon and the NU6.3 ("Ironwood") upgrade — https://www.coindesk.com/tech/2026/07/16/inside-zcash-s-new-node-that-targets-visa-scale-privacy-at-50-000-transactions-per-second
- Zcash Documentation, *"Addresses and Value Pools in Zcash"* — transparent/Sprout/Sapling address prefixes and behavior — https://zcash.readthedocs.io/en/master/rtd_pages/addresses.html
- `zcash/zips` Issue #470 and the Unified Address specification context (ZIP-316) — Unified Address design — https://github.com/zcash/zips/issues/470
- `zingolabs/zaino` GitHub repository — the role of Zaino as a modern indexer replacing/unifying `lightwalletd` and `zcashd` RPC service — https://github.com/zingolabs/zaino
- `zcash/lightwallet-protocol` and `zcash/lightwalletd` GitHub repositories — the light-client protocol and which wallets consume it — https://github.com/zcash/lightwallet-protocol and https://github.com/zcash/lightwalletd
- ZecHub Substack, *"Zcashd to Zebra & Zakura: How Zcash Nodes Evolved"* — node history and Zakura's relationship to Zebra — https://zechub.substack.com/p/zcashd-to-zebra-and-zakura-how-zcash
- Original research: Miers, Garman, Green, Rubin, *"Zerocoin: Anonymous Distributed E-Cash from Bitcoin"* (2013) and Ben-Sasson, Chiesa, Garman, Green, Miers, Tromer, Virza, *"Zerocash: Decentralized Anonymous Payments from Bitcoin"* (2014) — historical basis for the timeline section.
- Zcash Protocol Specification, ZecHub, and the Zcash Foundation Community Forum were used to select and describe the Learning Resources section — https://zips.z.cash/protocol/protocol.pdf, https://zechub.wiki/, https://forum.zcashcommunity.com/

---

## What I learned

- **The address format story is really a protocol-upgrade story.**
  Each address prefix (`zc` → `zs` → `u1`) marks a specific network
  upgrade that changed what shielded transactions could do — Sprout's
  original trusted-setup pool, Sapling's practical-on-mobile proving
  times, and Orchard's move to a trusted-setup-free proving system
  (Halo 2) bundled behind Unified Addresses. Explaining the addresses
  well meant explaining the upgrades first.
- **The full-node landscape changed while researching this.** Going in,
  I expected to compare `zcashd` against a second implementation.
  Current sources show `zcashd` itself reached end-of-life in 2026, with
  Zebra and the newer Zakura fork as its practical successors — a good
  reminder that infrastructure details in a fast-moving ecosystem need
  checking against current sources rather than reputation or memory.
- **Splitting full-node and indexing responsibilities is a deliberate
  security boundary, not just a performance optimization.** Because a
  light-client indexer never participates in consensus, its bugs or
  downtime can't corrupt the ledger — only inconvenience users trying
  to read it. That distinction was worth making explicit in the app
  rather than leaving it implied by the diagram alone.

## Difficulties / challenges encountered

- **Verifying a fast-moving fact set.** Zcash's node ecosystem changed
  materially in mid-2026 (`zcashd`'s retirement, Zakura's launch, the
  NU6.3/Ironwood upgrade), so several claims that would have been
  accurate a year earlier needed re-checking against current sources
  rather than general knowledge.
- **Keeping address "validation" honest.** A real bech32/Base58Check
  validator is more code than a beginner tool like this needs, but a
  prefix-only check risks looking more authoritative than it is. The
  balance struck here — prefix plus a loose length/character check,
  with an explicit "this isn't full validation" note when a match looks
  off — took a couple of iterations to phrase clearly without
  undermining trust in the tool.
- **Rendering icons consistently.** An early version of the
  architecture diagram used emoji characters (⛓, ⇄, ◈) as layer icons.
  Screenshotting the app in a headless browser surfaced that one emoji
  didn't render at all in that environment, which would have looked
  broken for some users too. Replacing all three with hand-drawn inline
  SVG icons fixed it and made the diagram's visual style more
  consistent with the rest of the app besides.
- **Keeping the timeline and comparison sections genuinely
  beginner-friendly.** It's easy for a "history of a cryptographic
  protocol" section to drift into jargon. Each timeline entry and node
  comparison field went through a pass specifically to cut unexplained
  acronyms and terms that assume prior blockchain knowledge.