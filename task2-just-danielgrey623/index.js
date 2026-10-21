/* ---------- TAB NAVIGATION ---------- */
const buttons = document.querySelectorAll('nav button');
const sections = document.querySelectorAll('main section');
buttons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    buttons.forEach(b=>b.classList.remove('active'));
    sections.forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

/*-------Nav animation------*/
$(".toggle_button").hover(()=>{
  toggleAnimation();
  $(".buttons").slideToggle();
});

/* ---------- 1. TIMELINE ---------- */
const timelineData = [
  {
    year: "2013",
    title: "Zerocoin research paper",
    body: "Miers, Garman, Green & Rubin publish 'Zerocoin: Anonymous Distributed E-Cash from Bitcoin', proposing a cryptographic scheme to break the link between coin sender and receiver on a Bitcoin-like ledger. This laid early groundwork for privacy-preserving digital cash."
  },
  {
    year: "2014",
    title: "Zerocash research paper",
    body: "Ben-Sasson, Chiesa, Garman, Green, Miers, Tromer & Virza publish 'Zerocash: Decentralized Anonymous Payments from Bitcoin', introducing zk-SNARKs to hide sender, receiver, AND amount — a major leap beyond Zerocoin. Zerocash became the direct technical basis for Zcash."
  },
  {
    year: "2016",
    title: "Launch of Zcash",
    body: "Zcash mainnet launches on October 28, 2016, implementing the Zerocash protocol in a Bitcoin-derived codebase (zcashd). It introduces shielded transactions using zk-SNARKs alongside transparent, Bitcoin-like transactions."
  },
  {
    year: "2018",
    title: "Sapling upgrade",
    body: "The Sapling network upgrade dramatically reduces the time and memory needed to create shielded transactions, making shielded payments practical on mobile devices and introducing the 'Sapling' shielded address format (zs1...)."
  },
  {
    year: "2022",
    title: "Orchard & Unified Addresses (NU5)",
    body: "Network Upgrade 5 introduces the Orchard shielded protocol (built on Halo 2, removing the need for a trusted setup) and Unified Addresses (u1...), which can bundle multiple receiver types into a single shareable address."
  },
  {
    year: "2026",
    title: "Scaling the shielded pool",
    body: "Ongoing work such as Project Tachyon and new node implementations (e.g. Zakura) focus on scaling Zcash's privacy technology toward much higher transaction throughput while preserving strong shielded guarantees."
  }
];

const timelineEl = document.getElementById('timelineList');
timelineData.forEach((item, i)=>{
  const div = document.createElement('div');
  div.className = 't-item';
  div.innerHTML = `
    <div class="t-year">${item.year}</div>
    <div class="t-title">${item.title}</div>
    <div class="t-body"><p>${item.body}</p></div>
  `;
  div.addEventListener('click', ()=>div.classList.toggle('open'));
  timelineEl.appendChild(div);
});
timelineEl.firstElementChild.classList.add('open');

/* ---------- 2. ARCHITECTURE ---------- */
const archData = [
  {
    name: "Full Node",
    tag: "e.g. Zebra, Zakura",
    detail: "<b>Full nodes</b> download and independently verify the entire Zcash blockchain, enforcing every consensus rule (block validity, shielded proof checks, supply limits). They are the ultimate source of truth on the network and relay blocks/transactions to peers."
  },
  {
    name: "Light-Client / Indexing Service",
    tag: "e.g. lightwalletd",
    detail: "Most people can't run a full node on a phone. A <b>light-client server</b> (like lightwalletd) sits in front of a full node, indexes the chain, and serves a compact, efficient data feed — compressed block data and note commitments — that mobile and lightweight wallets can scan quickly without downloading the whole chain."
  },
  {
    name: "Wallet / Application",
    tag: "e.g. Zashi, Zingo!, your app",
    detail: "The <b>wallet or application</b> connects to a light-client service (not directly to a full node, usually) to scan for incoming transactions, manage keys, and build/broadcast new transactions. It relies on the light-client server for chain data and on the full-node network to actually confirm transactions."
  }
];
const archFlow = document.getElementById('archFlow');
const archDetail = document.getElementById('archDetail');
archData.forEach((node, i)=>{
  const el = document.createElement('div');
  el.className = 'arch-node';
  el.innerHTML = `<h3>${node.name}</h3><p>${node.tag}</p>`;
  el.addEventListener('click', ()=>{ archDetail.innerHTML = node.detail; });
  archFlow.appendChild(el);
  if(i < archData.length-1){
    const arrow = document.createElement('div');
    arrow.className = 'arch-arrow';
    arrow.textContent = '→';
    archFlow.appendChild(arrow);
  }
});

/* ---------- 3. NODE COMPARISON ---------- */
const nodeRows = [
  ["Purpose", "General-purpose, security-focused reference full node maintained by the Zcash ecosystem (originally the Zcash Foundation's Rust rewrite of zcashd).", "Performance-focused full node forked from Zebra, aimed at much higher transaction throughput as part of scaling efforts like Project Tachyon."],
  ["Basic requirements", "Modern multi-core CPU, several GB RAM, stable broadband connection, and enough disk for the full chain state.", "Similar baseline hardware to Zebra, since it shares Zebra's codebase; benefits further from fast storage due to its emphasis on rapid sync."],
  ["Storage options", "Full archival sync by default, downloading and validating the complete chain from genesis over the P2P network.", "Supports pruning with configurable retention (keeping less historical data) and offers downloadable pruned/archive snapshots to bootstrap a node far faster than syncing block-by-block."],
  ["Benefits of running one", "Directly supports network decentralization and security; lets you validate the chain yourself without trusting a third party; good default choice for most operators.", "Useful where fast setup and lower disk usage matter (e.g. spinning up new infrastructure quickly), while still enforcing the same consensus rules as other full nodes."]
];
const table = document.getElementById('nodeTable');
table.innerHTML = `
  <tr><th></th><th>Zebra</th><th>Zakura</th></tr>
  ${nodeRows.map(r=>`<tr><td class="label">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
`;

/* ---------- 4. ADDRESS IDENTIFIER ---------- */
// Format-only detection: prefix + rough length/charset checks.
// This is NOT a checksum/cryptographic validator — just a beginner-friendly classifier.
function classifyAddress(raw){
  const addr = raw.trim();
  if(!addr) return null;

  const base58Charset = /^[1-9A-HJ-NP-Za-km-z]+$/;      // Base58 (no 0,O,I,l)
  const bech32Charset  = /^[a-z0-9]+$/;                  // lowercase bech32-style body

  // Transparent: starts with t1 (P2PKH) or t3 (P2SH), base58, ~35 chars
  if(/^t[13]/.test(addr)){
    const body = addr;
    if(base58Charset.test(body) && body.length >= 30 && body.length <= 40){
      return {
        type: "Transparent Address",
        badge: "badge-t",
        format: "Base58Check, starts with 't1' (P2PKH) or 't3' (P2SH)",
        privacy: "No shielding — sender, receiver and amount are all publicly visible on-chain, similar to a Bitcoin address. Best avoided when privacy matters."
      };
    }
    return { type:"Transparent-looking, but malformed", badge:"badge-unknown", format:"Starts with t1/t3 but has an unexpected length or characters.", privacy:"—" };
  }

  // Sapling shielded: starts with zs1 (mainnet) or ztestsapling for testnet, bech32, ~78 chars
  if(/^zs1/.test(addr) || /^ztestsapling/.test(addr)){
    const body = addr.slice(addr.indexOf('1')+1);
    if(bech32Charset.test(body) && addr.length >= 60 && addr.length <= 90){
      return {
        type: "Sapling Shielded Address",
        badge: "badge-z",
        format: "Bech32, starts with 'zs1' (mainnet) or 'ztestsapling' (testnet)",
        privacy: "Sender, receiver and amount are all encrypted using zk-SNARKs (Sapling shielded pool). Strong privacy for both value and participants."
      };
    }
    return { type:"Sapling-looking, but malformed", badge:"badge-unknown", format:"Starts with zs1 but has an unexpected length or characters.", privacy:"—" };
  }

  // Unified Address: starts with u1 (mainnet) or utest (testnet), can bundle multiple receivers, longer & variable length
  if(/^u1/.test(addr) || /^utest/.test(addr)){
    if(bech32Charset.test(addr.slice(1)) && addr.length >= 40){
      return {
        type: "Unified Address (UA)",
        badge: "badge-u",
        format: "Bech32m-derived, starts with 'u1' (mainnet) or 'utest' (testnet). Length varies because it can bundle several receiver types (e.g. Orchard, Sapling, transparent).",
        privacy: "Privacy depends on which receiver a sender actually uses: if the sending wallet picks the shielded (Orchard/Sapling) receiver inside the UA, the payment is shielded; if it falls back to the transparent receiver, that payment is public."
      };
    }
    return { type:"Unified-looking, but malformed", badge:"badge-unknown", format:"Starts with u1 but has an unexpected structure.", privacy:"—" };
  }

  return {
    type: "Unknown / Unsupported Address",
    badge: "badge-unknown",
    format: "Doesn't match the recognised Zcash prefixes (t1, t3, zs1, u1) or looks like it may belong to a different network entirely.",
    privacy: "Cannot be determined — do not assume this address is safe to send funds to without independently verifying it."
  };
}

const examplesEl = document.getElementById('examples');
const exampleAddrs = [
  { label:"Transparent example", value:"t1KregBz29StV9YapVaYsbwqNvGKrLzsg9Z" },
  { label:"Sapling example", value:"zs1z7rejlpsa98s2rrrfkwmaxu53e4ue0ulcrw0h4x5g8jl04tak0d3mm47vdtahatqrlkngh9sly" },
  { label:"Unified example", value:"u1cy2q0al6uxwta08rn3n3z6uc78lg2sq9qwqhs2c6pnj0qehz7zjr9lgc0dyx88kzt3rf4pt6ttntm0y5vjr3vqjqxvhv3vk6cw3s5f3" },
  { label:"Unknown example", value:"1BoatSLRHtKNngkdXEeobR76b53LETtpyT" }
];
exampleAddrs.forEach(ex=>{
  const chip = document.createElement('button');
  chip.className = 'example-chip';
  chip.textContent = ex.label;
  chip.addEventListener('click', ()=>{
    document.getElementById('addrInput').value = ex.value;
    runCheck();
  });
  examplesEl.appendChild(chip);
});

const addrInput = document.getElementById('addrInput');
const addrError = document.getElementById('addrError');
const addrResult = document.getElementById('addrResult');

function runCheck(){
  const val = addrInput.value;
  if(!val.trim()){
    addrError.classList.add('show');
    addrResult.classList.remove('show');
    return;
  }
  addrError.classList.remove('show');
  const res = classifyAddress(val);
  addrResult.innerHTML = `
    <span class="result-badge ${res.badge}">${res.type}</span>
    <p><b>Format:</b> ${res.format}</p>
    <p><b>Privacy characteristics:</b> ${res.privacy}</p>
  `;
  addrResult.classList.add('show');
}
document.getElementById('checkBtn').addEventListener('click', runCheck);
addrInput.addEventListener('keydown', e=>{ if(e.key === 'Enter') runCheck(); });

/* ---------- 5. RESOURCES ---------- */
const resources = [
  { name:"ZecHub", url:"https://zechub.wiki/", desc:"Community-run Zcash knowledge base & tutorials" },
  { name:"Zcash Protocol Specification", url:"https://zips.z.cash/protocol/protocol.pdf", desc:"The full technical protocol spec" },
  { name:"Zcash Improvement Proposals (ZIPs)", url:"https://zips.z.cash/", desc:"Formal proposals for protocol changes" },
  { name:"Zcash Foundation", url:"https://www.zfnd.org/", desc:"Nonprofit supporting Zcash protocol & ecosystem" },
  { name:"z.cash (official site)", url:"https://z.cash/", desc:"General overview & ecosystem directory" },
  { name:"Zebra documentation", url:"https://zebra.zfnd.org/", desc:"Docs for the Zebra full node implementation" }
];
const resList = document.getElementById('resList');
resources.forEach(r=>{
  const el = document.createElement('div');
  el.className = 'res-item';
  el.innerHTML = `<div><a href="${r.url}" target="_blank" rel="noopener">${r.name}</a><br><span>${r.desc}</span></div>`;
  resList.appendChild(el);
});

            function toggleAnimation(){
                const line1 = document.getElementById("line1"); 
                const line2 = document.getElementById("line2");
                const line3 = document.getElementById("line3");
                if(line1.classList.contains("line1") && line2.classList.contains("line2") && line3.classList.contains("line3") ){
                    $("#line3").removeClass("line3");
                    $("#line3").removeClass("clear");
                    $("#line3").addClass("line_rev3");
                    $("#line1").removeClass("line1");
                    $("#line1").addClass("line_rev1");
                    $("#line2").removeClass("line2");
                    $("#line2").addClass("line_rev2");
                    // console.log("Element Has class");
                }else{
                    $("#line3").removeClass("line_rev3");
                    $("#line3").addClass("line3");
                    $("#line3").addClass("clear");
                    $("#line1").removeClass("line_rev1");
                    $("#line1").addClass("line1");
                    $("#line2").removeClass("line_rev2");
                    $("#line2").addClass("line2");
                    // console.log("Element Does not have class but has been added");
                }
            }; 