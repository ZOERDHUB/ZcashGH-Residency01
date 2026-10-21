"""
ZDR-001: Blockchain Fundamentals
Zcash Privacy Developers Residency - Task 01

A minimal blockchain demonstrating how blocks are linked with SHA-256 hashes,
and why changing data inside an existing block breaks that chain.

All hashes are computed programmatically. Nothing is hard-coded.
"""

import hashlib
import json
import time


class Block:
    """A single block in the chain."""

    def __init__(self, index, data, previous_hash, timestamp=None):
        self.index = index
        self.timestamp = timestamp if timestamp is not None else time.time()
        self.data = data
        self.previous_hash = previous_hash
        self.hash = self.compute_hash()

    def compute_hash(self):
        """SHA-256 over the block's contents (excluding the stored hash itself)."""
        payload = json.dumps(
            {
                "index": self.index,
                "timestamp": self.timestamp,
                "data": self.data,
                "previous_hash": self.previous_hash,
            },
            sort_keys=True,
        ).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def __str__(self):
        return (
            f"  Index         : {self.index}\n"
            f"  Timestamp     : {self.timestamp} "
            f"({time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime(self.timestamp))})\n"
            f"  Data          : {self.data}\n"
            f"  Previous Hash : {self.previous_hash}\n"
            f"  Current Hash  : {self.hash}"
        )


class Blockchain:
    """An ordered list of blocks, each committing to the one before it."""

    def __init__(self):
        self.chain = [self.create_genesis_block()]

    def create_genesis_block(self):
        """The first block. It has no parent, so its previous hash is all zeroes."""
        return Block(index=0, data="Genesis Block", previous_hash="0" * 64)

    @property
    def last_block(self):
        return self.chain[-1]

    def add_block(self, data):
        """Append a new block that links to the current tip via its hash."""
        block = Block(
            index=self.last_block.index + 1,
            data=data,
            previous_hash=self.last_block.hash,
        )
        self.chain.append(block)
        return block

    def is_valid(self):
        """
        A chain is valid when, for every block:
          1. the stored hash still matches a fresh hash of its contents, and
          2. its previous_hash still matches the parent's actual hash.
        """
        for i, block in enumerate(self.chain):
            if block.hash != block.compute_hash():
                return False, f"Block {i} data was tampered with (hash mismatch)."
            if i > 0 and block.previous_hash != self.chain[i - 1].hash:
                return False, f"Block {i} is no longer linked to block {i - 1}."
        return True, "Chain is valid."

    def display(self, title):
        print(f"\n{title}")
        print("=" * 78)
        for block in self.chain:
            print(f"\nBlock {block.index}")
            print("-" * 78)
            print(block)
        valid, reason = self.is_valid()
        print("\n" + "-" * 78)
        print(f"Chain valid? {valid}  ->  {reason}")
        print("=" * 78)


def main():
    print("=" * 78)
    print("ZDR-001: BLOCKCHAIN FUNDAMENTALS".center(78))
    print("Zcash Privacy Developers Residency".center(78))
    print("=" * 78)

    # 1. Build a chain of three blocks, starting with the Genesis Block.
    blockchain = Blockchain()
    blockchain.add_block({"sender": "Alice", "receiver": "Bob", "amount": 10})
    blockchain.add_block({"sender": "Bob", "receiver": "Carol", "amount": 4})

    blockchain.display("STEP 1 - ORIGINAL BLOCKCHAIN")

    # 2. Record the original hashes so we can compare them after tampering.
    original_hashes = [block.hash for block in blockchain.chain]

    # 3. Tamper with the data inside Block 1, then recompute its hash.
    print("\nSTEP 2 - TAMPERING WITH BLOCK 1")
    print("=" * 78)
    target = blockchain.chain[1]
    print(f"Original data : {target.data}")
    target.data = {"sender": "Alice", "receiver": "Mallory", "amount": 10_000}
    print(f"Modified data : {target.data}")
    target.hash = target.compute_hash()

    print("\nHASH COMPARISON FOR BLOCK 1")
    print("-" * 78)
    print(f"  Original hash : {original_hashes[1]}")
    print(f"  Modified hash : {target.hash}")
    print(f"  Changed?      : {original_hashes[1] != target.hash}")

    # 4. Show the damage across the whole chain.
    blockchain.display("STEP 3 - BLOCKCHAIN AFTER TAMPERING")

    print("\nSTEP 4 - WHY THIS PROVES IMMUTABILITY")
    print("=" * 78)
    for i, block in enumerate(blockchain.chain):
        status = "unchanged" if original_hashes[i] == block.hash else "CHANGED"
        print(f"  Block {i}: {status}")
        print(f"    before : {original_hashes[i]}")
        print(f"    after  : {block.hash}")
    print(
        "\nBlock 2 still stores the OLD hash of Block 1 as its previous_hash, so the\n"
        "link is broken and the chain no longer validates. To hide the edit, an\n"
        "attacker would have to recompute every block after it - and on a real\n"
        "network, out-race the honest majority while doing so.\n"
    )


if __name__ == "__main__":
    main()
