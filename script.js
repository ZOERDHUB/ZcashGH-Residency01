/* =====================================================================
   Tab navigation
===================================================================== */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

/* =====================================================================
   1. Timeline data
===================================================================== */
const timelineEvents = [
  {
    year: "2013",
    title: "Zerocoin research paper",
    date: "May 2013",
    body: "Miers, Garman, Green, and Rubin publish Zerocoin, a proposal to bolt privacy onto Bitcoin using cryptographic accumulators. Users could \u201cmint\u201d a coin and later redeem it anonymously, breaking the on-chain link between sender and receiver. It didn't hide the payment amount and needed separate mint/spend transactions \u2014 but it proved the idea was possible.",
  },
  {
    year: "2014",
    title: "Zerocash research paper",
    date: "May 2014",
    body: "Ben-Sasson, Chiesa, Garman, Green, Miers, Tromer, and Virza go further with Zerocash: a full decentralized payment scheme built on zk-SNARKs, hiding the sender, recipient, and amount in a single transaction while remaining publicly verifiable. This design became the direct technical blueprint for Zcash.",
  },
  {
    year: "2016",
    title: "Zcash mainnet launches",
    date: "28 October 2016",
    body: "The network goes live, implementing a variant of the Zerocash protocol on a Bitcoin-derived codebase (zcashd). Its first shielded pool, Sprout, is secured by a multi-party trusted-setup ceremony that generates the cryptographic parameters shielded transactions rely on.",
  },
  {
    year: "2018",
    title: "Sapling upgrade",
    date: "October 2018",
    body: "Shielded transactions get dramatically cheaper to create \u2014 proving time and memory drop from minutes and gigabytes to seconds and megabytes. This is what makes private transactions practical on a phone, and it introduces the Sapling shielded address format (zs\u2026).",
  },
  {
    year: "2020",
    title: "Canopy upgrade",
    date: "November 2020",
    body: "Ahead of the second halving, Canopy adjusts how the block subsidy is allocated, establishing an ongoing development fund to support continued protocol work.",
  },
  {
    year: "2022",
    title: "NU5: Orchard &amp; Unified Addresses",
    date: "May 2022",
    body: "Network Upgrade 5 adds the Orchard shielded pool, built on the Halo 2 proving system \u2014 removing the need for any trusted setup at all. It also introduces Unified Addresses (ZIP-316), which bundle transparent, Sapling, and Orchard receivers into a single address starting with u1.",
  },
  {
    year: "2026",
    title: "zcashd retires; new node ecosystem",
    date: "2026",
    body: "The original zcashd node reaches end of life, and the network shifts to Zebra (the Zcash Foundation's Rust implementation) and Zallet for wallet functionality, alongside independently maintained projects like Zakura pursuing much higher throughput. Network Upgrade 6.3 (\u201cIronwood\u201d) activates the same year, adding a turnstile mechanism to cap withdrawals from the Orchard pool.",
  },
];

const track = document.getElementById("timelineTrack");
const detail = document.getElementById("timelineDetail");

timelineEvents.forEach((ev, i) => {
  const btn = document.createElement("button");
  btn.className = "timeline-marker";
  btn.innerHTML = `
    <span class="marker-year">${ev.year}</span>
    <span class="marker-dot"></span>
    <span class="marker-title">${ev.title}</span>
  `;
  btn.addEventListener("click", () => showTimelineEvent(i));
  track.appendChild(btn);
});

function showTimelineEvent(index) {
  const ev = timelineEvents[index];
  document.querySelectorAll(".timeline-marker").forEach((m, i) => {
    m.classList.toggle("active", i === index);
  });
  detail.innerHTML = `
    <h3>${ev.title}</h3>
    <span class="detail-date">${ev.date}</span>
    <p>${ev.body}</p>
  `;
}

showTimelineEvent(0);

/* =====================================================================
   2. Architecture diagram detail
===================================================================== */
const archDetails = {
  fullnode:
    "A full node (Zebra or Zakura) downloads and independently checks every block and transaction against Zcash's consensus rules, then relays them to other nodes. It holds the canonical, trust-nobody copy of the ledger.",
  indexer:
    "An indexer such as lightwalletd or the newer Zaino sits between full nodes and applications. It doesn't re-validate consensus \u2014 it repackages chain data into a lightweight stream (compact blocks) that a phone or browser can download quickly.",
  wallet:
    "A wallet like Zashi or Ywallet pulls that compact-block stream from an indexer and uses its own keys, entirely on-device, to work out which incoming payments belong to it. It builds and signs outgoing transactions locally before sending them back through the indexer.",
};

document.querySelectorAll(".arch-node").forEach((node) => {
  node.addEventListener("click", () => {
    document
      .querySelectorAll(".arch-node")
      .forEach((n) => n.classList.remove("active"));
    node.classList.add("active");
    document.getElementById("archDetail").innerHTML =
      `<p><strong>${node.querySelector("h3").textContent}:</strong> ${archDetails[node.dataset.node]}</p>`;
  });
});

/* =====================================================================
   3. Node comparison
===================================================================== */
const nodeData = [
  {
    name: "Zebra",
    tag: "Rust · Zcash Foundation",
    fields: [
      [
        "Purpose",
        "The Zcash Foundation's independent, from-scratch consensus node. Since zcashd's retirement, it's the primary actively-maintained validator for the network.",
      ],
      [
        "Basic requirements",
        "A modern multi-core CPU and a broadband connection; ships as a Docker image or can be built from source. Check the Zebra Book for current system requirements.",
      ],
      [
        "Storage options",
        "Syncs and keeps the full chain history by default \u2014 no built-in pruning, so plan disk space for the complete, growing state.",
      ],
      [
        "Benefits of running one",
        "Written in a memory-safe language, so it's less exposed to memory-safety bugs; validates asynchronously in parallel for strong performance; and being a second independent implementation makes the whole network more resilient.",
      ],
    ],
  },
  {
    name: "Zakura",
    tag: "Rust · fork of Zebra",
    fields: [
      [
        "Purpose",
        "An independently maintained fork of Zebra built for much higher throughput, part of a broader push (alongside Project Tachyon) toward payments at a global, Visa-like scale.",
      ],
      [
        "Basic requirements",
        "A similar baseline to Zebra since it shares its foundation, tuned for faster sync; also offers a zcashd-compatible RPC mode for legacy wallets and integrations.",
      ],
      [
        "Storage options",
        "Supports native block pruning and publishes ready-made pruned snapshots, letting a new node bootstrap in minutes with a much smaller disk footprint than a full historical sync.",
      ],
      [
        "Benefits of running one",
        "Substantially faster initial sync and block processing, lower storage requirements via pruning, and drop-in compatibility with tooling built for the older zcashd interface.",
      ],
    ],
  },
];

const compareEl = document.getElementById("nodeCompare");
nodeData.forEach((n) => {
  const col = document.createElement("div");
  col.className = "node-col";
  col.innerHTML = `
    <h3>${n.name}</h3>
    <span class="node-tag">${n.tag}</span>
    ${n.fields
      .map(
        ([label, value]) => `
      <div class="node-field">
        <span class="node-field-label">${label}</span>
        <p class="node-field-value">${value}</p>
      </div>
    `,
      )
      .join("")}
  `;
  compareEl.appendChild(col);
});

/* =====================================================================
   4. Address identifier
===================================================================== */
const addressTypes = {
  transparent: {
    label: "Transparent address",
    badgeClass: "type-transparent",
    prefixes: "t1\u2026 or t3\u2026",
    privacy: 1,
    privacyWord: "low",
    explain:
      "Works like a Bitcoin address. The sender, recipient, and amount of every transaction involving this address are permanently visible to anyone looking at the blockchain.",
  },
  sprout: {
    label: "Sprout shielded address (legacy)",
    badgeClass: "type-sprout",
    prefixes: "zc\u2026",
    privacy: 2,
    privacyWord: "mid",
    explain:
      "The original Zcash shielded pool, launched in 2016 and superseded by Sapling in 2018. It still hides sender, recipient, and amount using zk-SNARKs, but it's legacy technology \u2014 modern wallets steer users toward Sapling or Unified Addresses instead.",
  },
  sapling: {
    label: "Sapling shielded address",
    badgeClass: "type-sapling",
    prefixes: "zs1\u2026",
    privacy: 3,
    privacyWord: "high",
    explain:
      "A fully shielded address introduced in the 2018 Sapling upgrade. Transactions between shielded addresses hide the sender, recipient, and amount using zero-knowledge proofs, while remaining publicly verifiable as valid.",
  },
  unified: {
    label: "Unified Address",
    badgeClass: "type-unified",
    prefixes: "u1\u2026",
    privacy: 3,
    privacyWord: "high",
    explain:
      "Zcash's current recommended format (ZIP-316). It bundles several receiver types \u2014 transparent, Sapling, Orchard \u2014 into one string, and the sender's wallet automatically picks the most private option both wallets support. Its actual privacy depends on which receiver ends up being used.",
  },
};

const legendOrder = ["transparent", "sprout", "sapling", "unified"];
const legendGrid = document.getElementById("legendGrid");
legendOrder.forEach((key) => {
  const t = addressTypes[key];
  const card = document.createElement("div");
  card.className = "legend-card";
  card.innerHTML = `
    <span class="legend-prefix result-badge ${t.badgeClass}">${t.prefixes}</span>
    <p class="legend-name" style="margin-top:8px;">${t.label}</p>
    <p class="legend-desc">${t.explain}</p>
  `;
  legendGrid.appendChild(card);
});

// Lightweight format detection: prefix + rough length/charset sanity check.
// This is NOT full checksum/bech32 validation \u2014 it's a beginner-friendly
// classifier, and it never inspects anything but the pasted public address.
const base58Body = /^[a-km-zA-HJ-NP-Z1-9]+$/;
const bech32Body = /^[a-z0-9]+$/;

function classifyAddress(raw) {
  const addr = raw.trim();
  if (!addr) return null;

  if (/^t[13]/.test(addr)) {
    const body = addr.slice(2);
    if (addr.length >= 34 && addr.length <= 36 && base58Body.test(body)) {
      return { type: "transparent", confident: true };
    }
    return { type: "transparent", confident: false };
  }

  if (/^zc/i.test(addr) && addr.length > 60) {
    return {
      type: "sprout",
      confident: bech32Body.test(addr.toLowerCase()) || base58Body.test(addr),
    };
  }

  if (/^zs1/i.test(addr)) {
    const rest = addr.slice(3).toLowerCase();
    return {
      type: "sapling",
      confident:
        addr.length >= 70 && addr.length <= 80 && bech32Body.test(rest),
    };
  }

  if (/^u1/i.test(addr)) {
    const rest = addr.slice(2).toLowerCase();
    return {
      type: "unified",
      confident: addr.length >= 60 && bech32Body.test(rest),
    };
  }

  return { type: "unknown" };
}

function privacyBar(level) {
  const bars = [1, 2, 3];
  return `<div class="privacy-bar">${bars
    .map((b) => {
      const filled = b <= level;
      const cls = level === 1 ? "low" : level === 2 ? "mid" : "";
      return `<span class="${filled ? "filled " + cls : ""}"></span>`;
    })
    .join("")}</div>`;
}

const input = document.getElementById("addressInput");
const resultEl = document.getElementById("addressResult");

input.addEventListener("input", () => {
  const value = input.value;
  if (!value.trim()) {
    resultEl.innerHTML = `<p class="result-placeholder">Start typing \u2014 the format is detected as you go.</p>`;
    return;
  }

  const result = classifyAddress(value);

  if (!result || result.type === "unknown") {
    resultEl.innerHTML = `
      <div class="result-head">
        <span class="result-badge type-unknown">unrecognized</span>
        <span class="result-title">Unknown or unsupported address</span>
      </div>
      <div class="result-body">
        <p>This doesn't match a transparent (t1\u2026/t3\u2026), Sapling (zs1\u2026), Sprout (zc\u2026), or Unified (u1\u2026) address format. Double-check for typos, extra spaces, or a copy-paste error \u2014 and remember this tool never needs, and will never ask for, a private key or seed phrase.</p>
      </div>
    `;
    return;
  }

  const t = addressTypes[result.type];
  const confidenceNote =
    result.confident === false
      ? `<p style="color: var(--text-faint); font-size: 0.82rem;">The prefix matches ${t.label.toLowerCase()}, but the length or characters look unusual for this format \u2014 this is a lightweight check, not full cryptographic validation.</p>`
      : "";

  resultEl.innerHTML = `
    <div class="result-head">
      <span class="result-badge ${t.badgeClass}">${t.prefixes}</span>
      <span class="result-title">${t.label}</span>
    </div>
    <div class="result-body">
      <p>${t.explain}</p>
      ${privacyBar(t.privacy)}
      <p style="color: var(--text-faint); font-size: 0.8rem;">On-chain visibility: ${t.privacyWord}</p>
      ${confidenceNote}
    </div>
  `;
});

/* =====================================================================
   5. Resources
===================================================================== */
const resources = [
  {
    name: "ZecHub",
    desc: "Community-run wiki and education hub covering Zcash concepts, wallets, and how-tos.",
    url: "https://zechub.wiki/",
  },
  {
    name: "Zcash Protocol Specification",
    desc: "The formal protocol document \u2014 the definitive technical reference.",
    url: "https://zips.z.cash/protocol/protocol.pdf",
  },
  {
    name: "Zcash Improvement Proposals (ZIPs)",
    desc: "The public repository where every protocol change is proposed, discussed, and specified.",
    url: "https://github.com/zcash/zips",
  },
  {
    name: "Zcash Documentation",
    desc: "Official reference docs covering addresses, transactions, and node operation.",
    url: "https://zcash.readthedocs.io/",
  },
  {
    name: "Zcash Community Forum",
    desc: "Hosted by the Zcash Foundation \u2014 discussion, support, and links to the community Discord.",
    url: "https://forum.zcashcommunity.com/",
  },
];

const resGrid = document.getElementById("resourcesGrid");
resources.forEach((r) => {
  const a = document.createElement("a");
  a.className = "resource-link";
  a.href = r.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.innerHTML = `
    <span>
      <span class="resource-name">${r.name}</span>
      <span class="resource-desc">${r.desc}</span>
    </span>
    <span class="resource-arrow">↗</span>
  `;
  resGrid.appendChild(a);
});

const arrow = document.querySelector(".arrow");
const autor = document.querySelector(".autor");
const abs = document.querySelector(".abs");
const autorText = document.querySelector(".autorText");
arrow.addEventListener("click", () => {
  autor.style.display = autor.style.display === "block" ? "none" : "block";
  arrow.style.display = "none";
});

abs.addEventListener("click", () => {
  autor.style.display = "none";
  arrow.style.display = "block";
  autorText.style.display = "inline";
});
