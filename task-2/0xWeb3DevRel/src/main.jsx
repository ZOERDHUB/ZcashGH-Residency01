import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const timeline = [
  {
    year: "2013",
    title: "Zerocoin research paper",
    tag: "Origin",
    text: "Zerocoin proposed a cryptographic extension to Bitcoin designed to break the link between individual transactions, improving privacy without adding a trusted third party."
  },
  {
    year: "2014",
    title: "Zerocash research paper",
    tag: "Breakthrough",
    text: "Zerocash extended the idea into a full-fledged ledger-based digital currency with stronger privacy. It used zero-knowledge proofs to hide payment origin, destination, and amount."
  },
  {
    year: "2016",
    title: "Zcash launches",
    tag: "Mainnet",
    text: "Zcash launched on October 28, 2016. The initial shielded protocol was Sprout, built from the Zerocash design."
  },
  {
    year: "2018",
    title: "Sapling",
    tag: "Shielded UX",
    text: "The Sapling upgrade brought major efficiency improvements and made shielded transactions much more practical for wallets and users."
  },
  {
    year: "2022",
    title: "Orchard + NU5",
    tag: "Modern privacy",
    text: "Network Upgrade 5 introduced Orchard, a new shielded protocol using Halo 2 and a design intended to improve scalability and remove the need for a trusted setup for Orchard proofs."
  },
  {
    year: "Today",
    title: "Unified Addresses",
    tag: "Usability",
    text: "Unified Addresses package receivers for multiple address types into one user-facing address, simplifying payments while allowing wallets to prefer stronger shielded receiver types."
  }
];

const resources = [
  ["Zcash Documentation", "Core protocol, wallets, light clients and developer documentation.", "https://zcash.readthedocs.io/"],
  ["Zcash Protocol Specification", "Normative details for the Zcash protocol and address encodings.", "https://zips.z.cash/protocol/protocol.pdf"],
  ["ZIPs", "Zcash Improvement Proposals covering protocol and ecosystem changes.", "https://zips.z.cash/"],
  ["ZIP 316", "Unified Addresses and Unified Viewing Keys.", "https://zips.z.cash/zip-0316"],
  ["Zcash Foundation", "Zcash ecosystem and open-source infrastructure.", "https://zfnd.org/"],
  ["ZecHub", "Community-created Zcash educational resources.", "https://zechub.wiki/"],
  ["Zcash Discord", "Community discussion and developer collaboration.", "https://discord.com/invite/zcash"]
];

function checksumOk(data, expectedConstant) {
  const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const map = Object.fromEntries([...CHARSET].map((c, i) => [c, i]));
  const values = [...data].map(c => map[c]).filter(v => v !== undefined);
  if (values.length !== data.length) return false;

  const polymod = (vals) => {
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (const value of vals) {
      const top = chk >>> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ value;
      for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
    }
    return chk >>> 0;
  };

  return polymod(values) === expectedConstant;
}

function identifyAddress(input) {
  const value = input.trim();

  if (!value) {
    return { type: "empty", title: "Enter a Zcash address", message: "Nothing has been entered yet." };
  }

  // Transparent legacy addresses use Base58Check. We deliberately validate
  // the prefix and expected length here without contacting a network.
  if (/^t[13][1-9A-HJ-NP-Za-km-z]+$/.test(value)) {
    const validLength = value.length === 35;
    return validLength
      ? {
          type: "transparent",
          title: "Transparent address",
          message: "This is a mainnet transparent address format. Transaction details associated with transparent activity are publicly visible on-chain."
        }
      : {
          type: "unknown",
          title: "Unknown / unsupported",
          message: "The string resembles a transparent address, but its length is not consistent with the expected mainnet t1/t3 format."
        };
  }

  // Sapling payment addresses are Bech32 with a "zs1" mainnet prefix.
  if (value.startsWith("zs1")) {
    const lower = value.toLowerCase();
    const hasValidChars = /^[a-z0-9]+$/.test(lower);
    const validLength = value.length === 78;
    const validChecksum = hasValidChars && checksumOk(lower.slice(3), 1);
    return validLength && validChecksum
      ? {
          type: "sapling",
          title: "Sapling shielded address",
          message: "This is a Sapling shielded payment address format. Sapling shielded transactions can protect sender, recipient and amount using zero-knowledge proofs."
        }
      : {
          type: "unknown",
          title: "Unknown / unsupported",
          message: "The string starts like a Sapling address, but its basic Bech32 structure/checksum or expected length is invalid."
        };
  }

  // Unified Addresses use Bech32m and the u1 human-readable prefix.
  if (value.startsWith("u1")) {
    const lower = value.toLowerCase();
    const hasValidChars = /^[a-z0-9]+$/.test(lower);
    const validLength = value.length >= 40;
    const validChecksum = hasValidChars && checksumOk(lower.slice(2), 0x2bc830a3);
    return validLength && validChecksum
      ? {
          type: "unified",
          title: "Unified Address",
          message: "This is a Unified Address format. A UA can bundle receivers such as Orchard, Sapling and a transparent receiver, with at least one shielded receiver required."
        }
      : {
          type: "unknown",
          title: "Unknown / unsupported",
          message: "The string starts like a Unified Address, but its basic Bech32m structure/checksum is invalid."
        };
  }

  return {
    type: "unknown",
    title: "Unknown / unsupported",
    message: "This input does not match the supported mainnet formats checked by this demo: transparent, Sapling, or Unified Address."
  };
}

function SectionTitle({ eyebrow, title, children }) {
  return (
    <div className="section-title">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

function Timeline() {
  const [active, setActive] = useState(0);
  const item = timeline[active];

  return (
    <section id="timeline" className="section">
      <SectionTitle eyebrow="01 / ORIGINS" title="From Zerocoin to modern shielded protocols">
        Zcash grew from research into practical cryptographic financial privacy. Explore the milestones.
      </SectionTitle>

      <div className="timeline-layout">
        <div className="timeline-list">
          {timeline.map((entry, index) => (
            <button
              className={`timeline-item ${index === active ? "active" : ""}`}
              key={entry.title}
              onClick={() => setActive(index)}
            >
              <span className="timeline-year">{entry.year}</span>
              <span>
                <strong>{entry.title}</strong>
                <small>{entry.tag}</small>
              </span>
            </button>
          ))}
        </div>

        <article className="timeline-detail">
          <span className="detail-year">{item.year}</span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
          <div className="insight">
            <span>↳</span>
            <span>Privacy technology evolved from unlinking transactions to hiding transaction details with zero-knowledge proofs.</span>
          </div>
        </article>
      </div>
    </section>
  );
}

function Architecture() {
  return (
    <section id="architecture" className="section dark-section">
      <SectionTitle eyebrow="02 / ARCHITECTURE" title="How the pieces fit together">
        A beginner-friendly view of how blockchain data can travel from consensus infrastructure to a wallet or application.
      </SectionTitle>

      <div className="architecture">
        <div className="arch-node">
          <div className="arch-icon">◆</div>
          <span className="arch-label">01</span>
          <h3>Full nodes</h3>
          <p>Validate and maintain the Zcash blockchain according to consensus rules.</p>
          <div className="arch-badges"><span>Zebra</span><span>Zakura*</span></div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="arch-node">
          <div className="arch-icon">◈</div>
          <span className="arch-label">02</span>
          <h3>Light-client services</h3>
          <p>Provide wallet-friendly blockchain information without requiring every wallet to download the full chain.</p>
          <div className="arch-badges"><span>lightwalletd</span><span>Indexing</span></div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="arch-node">
          <div className="arch-icon">◇</div>
          <span className="arch-label">03</span>
          <h3>Wallets & apps</h3>
          <p>Use the available data to show balances, detect payments and construct transactions.</p>
          <div className="arch-badges"><span>Wallet</span><span>DApp</span></div>
        </div>
      </div>

      <div className="architecture-note">
        <strong>Why the middle layer?</strong>
        <span>Light-client infrastructure such as lightwalletd can serve compact blockchain information to wallets. This reduces what a lightweight application needs to download and process compared with running a full node.</span>
      </div>

      <div className="naming-note">
        <strong>* About “Sakura” in the task brief:</strong>
        <span>The current official Zcash ecosystem documentation identifies <b>Zakura</b> as a consensus-compatible Zcash full node. The app uses “Zakura” to avoid presenting an unverified “Sakura” implementation as official.</span>
      </div>
    </section>
  );
}

function NodeComparison() {
  return (
    <section id="nodes" className="section">
      <SectionTitle eyebrow="03 / FULL NODES" title="Zebra vs. Zakura">
        Both are Rust-based Zcash full-node implementations. Running a full node means participating in validation rather than trusting a third party for consensus.
      </SectionTitle>

      <div className="node-grid">
        <article className="node-card">
          <div className="node-head">
            <div>
              <span className="node-kicker">ZCASH FOUNDATION</span>
              <h3>Zebra</h3>
            </div>
            <span className="rust">RUST</span>
          </div>
          <p>Zebra is a Zcash full node written in Rust. It validates the Zcash blockchain and can serve as infrastructure for services such as lightwalletd.</p>
          <ul>
            <li><b>Purpose:</b> consensus validation + network participation</li>
            <li><b>Requirements:</b> Rust/build tooling when compiling from source; Docker is also available</li>
            <li><b>Storage:</b> persistent local chain state; SSD recommended for practical operation</li>
            <li><b>Benefit:</b> independently verify the chain and contribute node infrastructure</li>
          </ul>
          <a href="https://github.com/ZcashFoundation/zebra" target="_blank" rel="noreferrer">View Zebra ↗</a>
        </article>

        <article className="node-card featured">
          <div className="node-head">
            <div>
              <span className="node-kicker">CURRENT SCALING IMPLEMENTATION</span>
              <h3>Zakura</h3>
            </div>
            <span className="rust">RUST</span>
          </div>
          <p>Zakura is a consensus-compatible Zcash full node built for scale and forked from Zebra. It adds performance, pruning/snapshots and compatibility features.</p>
          <ul>
            <li><b>Purpose:</b> consensus-compatible full node optimized for scale</li>
            <li><b>Requirements:</b> Rust toolchain for source builds; prebuilt options may be available</li>
            <li><b>Storage:</b> configurable pruning can reduce retained chain state</li>
            <li><b>Benefit:</b> faster synchronization and lower storage requirements when pruning is used</li>
          </ul>
          <a href="https://github.com/zakura-core/zakura" target="_blank" rel="noreferrer">View Zakura ↗</a>
        </article>
      </div>

      <div className="node-principle">
        <span>FULL NODE PRINCIPLE</span>
        <h3>Don’t just ask the network what is valid. <em>Verify it.</em></h3>
      </div>
    </section>
  );
}

function AddressIdentifier() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);

  const submit = (event) => {
    event.preventDefault();
    setResult(identifyAddress(input));
  };

  return (
    <section id="addresses" className="section address-section">
      <SectionTitle eyebrow="04 / ADDRESS IDENTIFIER" title="What kind of Zcash address is this?">
        Paste an address to identify its general format. This tool performs local format checks only — it never connects to a wallet or network.
      </SectionTitle>

      <div className="identifier">
        <form onSubmit={submit}>
          <label htmlFor="address">Zcash address</label>
          <div className="input-row">
            <input
              id="address"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setResult(null);
              }}
              placeholder="e.g. t1... / zs1... / u1..."
              autoComplete="off"
              spellCheck="false"
            />
            <button type="submit">Identify</button>
          </div>
        </form>

        <div className={`result ${result ? result.type : "empty"}`}>
          {!result ? (
            <div className="result-placeholder">
              <span>◌</span>
              <div><strong>Waiting for an address</strong><p>Your input stays in this browser. Nothing is uploaded or stored.</p></div>
            </div>
          ) : (
            <div className="result-content">
              <span className="result-mark">{result.type === "unknown" ? "!" : "✓"}</span>
              <div>
                <span className="result-type">{result.title}</span>
                <p>{result.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="address-cards">
        <article><span className="dot transparent"></span><h4>Transparent</h4><code>t1… / t3…</code><p>Public transaction information. Similar to Bitcoin’s transparent model.</p></article>
        <article><span className="dot sapling"></span><h4>Sapling</h4><code>zs1…</code><p>Shielded payment address. Designed for privacy using zero-knowledge proofs.</p></article>
        <article><span className="dot unified"></span><h4>Unified</h4><code>u1…</code><p>One address encoding that can contain multiple receiver types, including shielded receivers.</p></article>
        <article><span className="dot unknown"></span><h4>Unknown</h4><code>?</code><p>Does not match the supported formats or basic checks in this demo.</p></article>
      </div>

      <div className="security-banner">
        <span>🛡</span>
        <div><strong>Privacy & security rule</strong><p>Never enter a seed phrase, private key, spending key, password, or wallet credentials. This application only identifies an address format.</p></div>
      </div>
    </section>
  );
}

function Resources() {
  return (
    <section id="resources" className="section resources-section">
      <SectionTitle eyebrow="05 / KEEP LEARNING" title="Go deeper">
        Primary documentation and reliable community resources used to build this guide.
      </SectionTitle>

      <div className="resource-grid">
        {resources.map(([title, description, url]) => (
          <a className="resource" href={url} target="_blank" rel="noreferrer" key={title}>
            <span className="resource-arrow">↗</span>
            <strong>{title}</strong>
            <p>{description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function App() {
  return (
    <>
      <header className="header">
        <a className="brand" href="#"><span>🦓</span> ZCASH<span className="brand-muted">/EXPLORER</span></a>
        <nav>
          <a href="#timeline">Origins</a>
          <a href="#architecture">Architecture</a>
          <a href="#nodes">Nodes</a>
          <a href="#addresses">Addresses</a>
          <a href="#resources">Resources</a>
        </nav>
        <span className="status"><i></i> Educational demo</span>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">ZDR-002 · PRIVACY DEVELOPER RESIDENCY</span>
            <h1>Understand the network.<br /><em>Then build on it.</em></h1>
            <p>An interactive guide to Zcash origins, architecture, full nodes, shielded addresses and the technology behind financial privacy.</p>
            <div className="hero-actions">
              <a className="primary-btn" href="#addresses">Try the address identifier ↓</a>
              <a className="text-btn" href="#architecture">Explore architecture →</a>
            </div>
          </div>
          <div className="hero-art">
            <div className="orb"></div>
            <div className="hero-card card-one"><span>PRIVACY</span><strong>BY DESIGN</strong></div>
            <div className="hero-card card-two"><span>SHIELDED</span><strong>PAYMENTS</strong></div>
            <div className="hero-grid"></div>
          </div>
        </section>

        <div className="quick-stats">
          <div><span>2013</span><small>Zerocoin research</small></div>
          <div><span>2014</span><small>Zerocash research</small></div>
          <div><span>2016</span><small>Zcash launch</small></div>
          <div><span>2022</span><small>Orchard / NU5</small></div>
        </div>

        <Timeline />
        <Architecture />
        <NodeComparison />
        <AddressIdentifier />
        <Resources />

        <section className="learned">
          <span className="eyebrow">RESIDENCY TASK 02</span>
          <h2>From protocol concepts to a usable interface.</h2>
          <p>Built as a client-side educational demo for the Zcash Privacy Developers Residency. No wallet connection. No backend. No sensitive data collection.</p>
        </section>
      </main>

      <footer>
        <span>© 2026 Zcash Explorer · ZDR-002</span>
        <span>Built for learning, not for handling funds.</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
