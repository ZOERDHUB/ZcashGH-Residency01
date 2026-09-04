/**
 * ZDR-001: Blockchain Fundamentals
 * A simple blockchain implementation demonstrating core blockchain concepts.
 *
 * This program demonstrates:
 * - Block structure (index, timestamp, data, previous_hash, hash)
 * - SHA-256 hashing for block integrity
 * - Hash linking between blocks (previous block hash)
 * - How modifying block data changes the hash (immutability/integrity)
 */

const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

/**
 * Represents a single block in the blockchain.
 *
 * A block contains:
 * - index:          The position of the block in the chain
 * - timestamp:      When the block was created (ISO-8601 string)
 * - data:           The payload/content of the block
 * - previous_hash:  The SHA-256 hash of the previous block
 * - hash:           The SHA-256 hash of this block's contents
 */
class Block {
  /**
   * @param {number} index        – position in the chain
   * @param {string} timestamp    – ISO-8601 time string
   * @param {string} data         – block payload
   * @param {string} previousHash – hash of the previous block
   */
  constructor(index, timestamp, data, previousHash) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  /**
   * Calculate the SHA-256 hash of this block's contents.
   *
   * The hash is computed from:
   * - index          (block position)
   * - timestamp      (when block was created)
   * - data           (block content)
   * - previousHash   (link to previous block)
   *
   * Any change to these fields produces a different hash, making
   * tampering immediately detectable.
   *
   * @returns {string} SHA-256 hash as a hexadecimal string
   */
  calculateHash() {
    const payload = JSON.stringify({
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      previousHash: this.previousHash,
    });
    return crypto.createHash("sha256").update(payload).digest("hex");
  }
}

// ---------------------------------------------------------------------------
// Blockchain
// ---------------------------------------------------------------------------

/**
 * A simple blockchain implementation.
 *
 * Manages a chain of blocks, ensuring:
 * - Blocks are properly linked via hashes
 * - The chain can be validated for integrity
 * - New blocks can be added to the chain
 */
class Blockchain {
  constructor() {
    /** @type {Block[]} */
    this.chain = [];
    this.createGenesisBlock();
  }

  /**
   * Create the genesis (first) block of the blockchain.
   *
   * The genesis block is special because:
   * - It has no previous block, so previousHash is 64 zeros
   * - It is the root of the entire chain
   * - In Bitcoin the genesis block famously contains the message:
   *   "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks"
   */
  createGenesisBlock() {
    const genesis = new Block(0, new Date().toISOString(), "Genesis Block - The first block in the chain", "0".repeat(64));
    this.chain.push(genesis);
  }

  /**
   * Get the most recent block in the chain.
   * @returns {Block}
   */
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Add a new block to the blockchain.
   *
   * The new block:
   * - Has the next index in sequence
   * - References the hash of the previous block
   * - Contains the provided data
   *
   * @param {string} data – data to store in the new block
   * @returns {Block} the newly created block
   */
  addBlock(data) {
    const latest = this.getLatestBlock();
    const newBlock = new Block(
      latest.index + 1,
      new Date().toISOString(),
      data,
      latest.hash
    );
    this.chain.push(newBlock);
    return newBlock;
  }

  /**
   * Validate the integrity of the blockchain.
   *
   * Checks:
   * 1. Each block's stored hash matches its recalculated hash
   * 2. Each block's previousHash matches the hash of the block before it
   *
   * If any block has been tampered with, validation will fail —
   * this is the core mechanism that makes blockchains tamper-evident.
   *
   * @returns {boolean} true if the chain is valid
   */
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      // Recalculate the current block's hash and compare
      if (current.hash !== current.calculateHash()) {
        return false;
      }

      // Verify the link to the previous block
      if (current.previousHash !== previous.hash) {
        return false;
      }
    }
    return true;
  }

  /**
   * Print every block in the chain with formatted output.
   */
  displayChain() {
    console.log("\n" + "=".repeat(70));
    console.log("BLOCKCHAIN CONTENTS");
    console.log("=".repeat(70));

    for (const block of this.chain) {
      console.log("\n" + "-".repeat(70));
      console.log(`Block #${block.index}`);
      console.log("-".repeat(70));
      console.log(`  Index:            ${block.index}`);
      console.log(`  Timestamp:        ${block.timestamp}`);
      console.log(`  Data:             ${block.data}`);
      console.log(`  Previous Hash:    ${block.previousHash}`);
      console.log(`  Hash:             ${block.hash}`);
    }

    console.log("\n" + "=".repeat(70));
  }
}

// ---------------------------------------------------------------------------
// Main demonstration
// ---------------------------------------------------------------------------

function main() {
  console.log("\n" + "=".repeat(70));
  console.log("ZDR-001: BLOCKCHAIN FUNDAMENTALS DEMONSTRATION");
  console.log("=".repeat(70));

  // Step 1 – create a blockchain with at least 3 blocks
  console.log("\n[STEP 1] Creating blockchain with 3 blocks...");
  const blockchain = new Blockchain();
  blockchain.addBlock("Block 1 - First transaction data");
  blockchain.addBlock("Block 2 - Second transaction data");

  // Step 2 – display original blockchain
  console.log("\n[STEP 2] Original blockchain:");
  blockchain.displayChain();

  // Step 3 – capture Block 1's original state
  const block1 = blockchain.chain[1]; // index 0 = genesis, 1 = Block 1
  const originalData = block1.data;
  const originalHash = block1.hash;

  console.log("\n" + "=".repeat(70));
  console.log("BLOCK 1 - ORIGINAL STATE");
  console.log("=".repeat(70));
  console.log(`  Original Data:    ${originalData}`);
  console.log(`  Original Hash:    ${originalHash}`);

  // Step 4 – modify Block 1's data
  console.log("\n[STEP 3] Modifying Block 1's data...");
  const modifiedData = "Block 1 - MODIFIED TRANSACTION DATA (TAMPERED!)";
  block1.data = modifiedData;

  // Step 5 – recalculate hash and show the change
  block1.hash = block1.calculateHash();
  const modifiedHash = block1.hash;

  console.log("\n" + "=".repeat(70));
  console.log("BLOCK 1 - AFTER MODIFICATION");
  console.log("=".repeat(70));
  console.log(`  Modified Data:    ${modifiedData}`);
  console.log(`  Modified Hash:    ${modifiedHash}`);

  // Step 6 – show the difference
  console.log("\n" + "=".repeat(70));
  console.log("HASH COMPARISON - IMMUTABILITY DEMONSTRATION");
  console.log("=".repeat(70));
  console.log(`  Original Hash:    ${originalHash}`);
  console.log(`  Modified Hash:    ${modifiedHash}`);
  console.log(`  Hashes match:     ${originalHash === modifiedHash}`);
  console.log("\n  *** The hash changed! This proves that modifying data");
  console.log("      in a block breaks the chain's integrity. ***");
  console.log("=".repeat(70));

  // Step 7 – validate the chain
  console.log("\n[STEP 4] Validating blockchain integrity...");
  const isValid = blockchain.isChainValid();
  console.log(`\n  Blockchain valid: ${isValid}`);

  if (!isValid) {
    console.log("  *** Tampering detected! The blockchain validation failed.");
    console.log("      This demonstrates how blockchains protect data integrity. ***");
  } else {
    console.log("  Blockchain is valid.");
  }

  console.log("\n" + "=".repeat(70));
  console.log("DEMONSTRATION COMPLETE");
  console.log("=".repeat(70) + "\n");
}

// Allow both direct execution and import
if (require.main === module) {
  main();
}

module.exports = { Block, Blockchain };
