# ZDR-001: Blockchain Fundamentals

**Zcash Privacy Developers Residency — Task 01**
Author: [@hybridthegamer](https://github.com/hybridthegamer)
Language: Python 3 (standard library only)

A minimal blockchain that shows how blocks are chained together with SHA-256, and
why editing data inside an already-committed block is immediately detectable.

---

## 1. What is a blockchain?

A blockchain is an append-only ledger made of **blocks**, where each block holds some
data and a cryptographic fingerprint (a hash) of the block before it. Because every
block commits to its parent, the blocks form a chain running back to the very first
block — the **Genesis Block**.

Copies of that ledger are held by many independent participants, who agree on which
chain is the valid one through a consensus rule (proof-of-work in Bitcoin and Zcash).
The result is a shared history that nobody has to trust a single party to maintain:
anyone can recompute the hashes and verify the whole thing for themselves.

## 2. Why does each block contain the previous block's hash?

The previous hash is what turns a list of blocks into a *chain*.

A hash is a fixed-length fingerprint of the data that produced it. If even one bit of
that data changes, the hash changes completely. So when Block 2 stores the hash of
Block 1, Block 2 is effectively signing a statement: *"this is exactly the Block 1 I
was built on top of."*

That gives two properties:

- **Ordering** — the links define an unambiguous sequence of history.
- **Tamper-evidence** — you cannot alter an old block without invalidating every block
  that came after it.

## 3. What happens when data inside an existing block changes?

Its hash changes, and the chain breaks.

That is exactly what `blockchain.py` demonstrates. The program builds a valid
three-block chain, then rewrites Block 1's transaction from `Alice -> Bob, 10` to
`Alice -> Mallory, 10000` and recomputes the hash:

```
Original hash : b13e58cea77b79e4...
Modified hash : 40ab0abc04da564e...
Changed?      : True
```

Block 2, however, still stores the **old** hash of Block 1 in its `previous_hash`
field. The validator now reports:

```
Chain valid? False  ->  Block 2 is no longer linked to block 1.
```

To hide the edit, the attacker would have to recompute Block 2, then Block 3, and so
on to the tip of the chain. On a live proof-of-work network each of those blocks costs
real energy to re-mine, and the attacker would have to do it faster than the rest of
the network is extending the honest chain. That economic cost — not the hashing alone —
is what makes the ledger practically immutable.

> Note: the hashes above are from one sample run. Each block includes a timestamp, so
> the exact values differ every time you run the program. What stays constant is the
> behaviour: the modified block's hash changes, and the chain fails validation.

## 4. Centralized vs. decentralized networks

| | Centralized | Decentralized |
|---|---|---|
| **Control** | One organisation owns the ledger and the rules | Rules are enforced by many independent nodes |
| **Source of truth** | Whatever the operator's database says | Whatever the network's consensus rule accepts |
| **Failure mode** | Single point of failure — outage, seizure, or insider edit takes it down | No single point to seize; the network keeps running if nodes drop out |
| **Trust model** | You trust the operator to be honest and available | You verify for yourself; trust is minimised |
| **Censorship** | The operator can freeze or reverse your transaction | Censoring requires out-running the whole network |
| **Example** | A bank's internal ledger, PayPal | Bitcoin, Zcash |

The trade-off is real: centralized systems are faster and cheaper to run, while
decentralized ones spend performance to buy censorship-resistance and verifiability.

## 5. One major difference between Bitcoin and Zcash

**Privacy of transaction contents.**

Every Bitcoin transaction is fully transparent — sender address, receiver address, and
amount are permanently public, so anyone can trace the flow of funds through the chain.

Zcash adds **shielded transactions**, built on zero-knowledge proofs (zk-SNARKs). When
value moves between shielded addresses, the sender, receiver, and amount are encrypted
on-chain. The network still verifies the transaction is valid — that no coins were
created out of thin air and nothing was double-spent — using the zero-knowledge proof
alone, *without learning any of the details it is proving things about*.

In short: Bitcoin gives you a public ledger with pseudonymous addresses; Zcash gives
you a public ledger where the details of shielded payments stay private, while
remaining fully verifiable.

## 6. What is a UTXO?

**UTXO** stands for **Unspent Transaction Output**.

Instead of tracking account balances, Bitcoin-style chains track discrete chunks of
value. Every transaction consumes one or more existing outputs as **inputs** and creates
new **outputs**. An output that has not yet been used as an input is a UTXO — a coin
sitting there, spendable by whoever can satisfy its locking condition.

Your "balance" is not a number stored anywhere; it is the sum of all UTXOs you can
spend.

UTXOs are spent whole, so change comes back to you as a new output:

> You hold one UTXO worth 10 ZEC and want to send 4. The transaction consumes the whole
> 10 ZEC UTXO and creates two new ones: 4 ZEC to the recipient, and ~6 ZEC back to you
> as change (minus the fee).

This model makes double-spending easy to check — an output is either unspent or it is
not — and it parallelises validation well. Zcash uses a UTXO model for its transparent
pool, and a conceptually similar note-and-nullifier scheme for its shielded pool, where
a spent note is retired by publishing a **nullifier** rather than by revealing which
note was spent.

## 7. How to run the program

**Requirements:** Python 3.6 or newer. No third-party packages — `hashlib`, `json`, and
`time` are all from the standard library.

```bash
git clone https://github.com/ZOERDHUB/ZcashGH-Residency01.git
cd ZcashGH-Residency01/task1/hybridthegamer
python blockchain.py
```

On some systems use `python3 blockchain.py`.

### What you will see

1. **Step 1** — the original three-block chain (Genesis + 2), each block printing its
   index, timestamp, data, previous hash, and current hash. Validation passes.
2. **Step 2** — Block 1's data is modified and its hash recomputed. The original and
   modified hashes are printed side by side.
3. **Step 3** — the full chain reprinted. Validation now **fails**, because Block 2's
   `previous_hash` no longer matches Block 1.
4. **Step 4** — a per-block before/after hash comparison showing that only the tampered
   block's hash changed, which is precisely what breaks the link.

---

## Project structure

```
task1/hybridthegamer/
├── blockchain.py    # Block + Blockchain classes and the demonstration
└── README.md        # This file
```

## Implementation notes

- Hashes are computed with `hashlib.sha256` at runtime. **No hash is hard-coded.**
- Block contents are serialised with `json.dumps(..., sort_keys=True)` before hashing,
  so the digest is deterministic and independent of dictionary ordering.
- `compute_hash()` deliberately excludes the block's own `hash` field — a block cannot
  commit to its own fingerprint.
- `Blockchain.is_valid()` checks both invariants: each block's stored hash still matches
  its contents, and each block's `previous_hash` still matches its parent's hash.
