/**
 * ZDR-001: Blockchain Fundamentals – Test Suite
 *
 * Comprehensive tests covering:
 * - Block creation and structure
 * - SHA-256 hashing
 * - Hash linking between blocks
 * - Blockchain validation
 * - Tamper detection
 *
 * Run with:  node test_blockchain.js
 */

const crypto = require("crypto");
const { Block, Blockchain } = require("./blockchain");

// ---------------------------------------------------------------------------
// Minimal test framework (no external dependencies)
// ---------------------------------------------------------------------------

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function describe(label, fn) {
  console.log(`\n  ${label}`);
  fn();
}

function it(label, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`    ✓ ${label}`);
  } catch (err) {
    failedTests++;
    console.log(`    ✗ ${label}`);
    console.log(`      ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

function assertNotEqual(a, b, label) {
  if (a === b) {
    throw new Error(`${label}: values are equal (${a})`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Block", () => {
  it("creates a block with all required fields", () => {
    const block = new Block(1, "2024-01-01T00:00:00Z", "Test data", "0".repeat(64));
    assertEqual(block.index, 1, "index");
    assertEqual(block.data, "Test data", "data");
    assertEqual(block.previousHash, "0".repeat(64), "previousHash");
    assert(typeof block.hash === "string", "hash should be a string");
    assertEqual(block.hash.length, 64, "hash length should be 64 hex chars");
  });

  it("hash is a valid SHA-256 of the block contents", () => {
    const ts = "2024-01-01T00:00:00Z";
    const block = new Block(0, ts, "Genesis Block", "0".repeat(64));

    const payload = JSON.stringify({
      index: 0,
      timestamp: ts,
      data: "Genesis Block",
      previousHash: "0".repeat(64),
    });
    const expected = crypto.createHash("sha256").update(payload).digest("hex");

    assertEqual(block.hash, expected, "hash");
  });

  it("different data produces different hashes", () => {
    const block1 = new Block(1, "2024-01-01T00:00:00Z", "Data A", "0".repeat(64));
    const block2 = new Block(1, "2024-01-01T00:00:00Z", "Data B", "0".repeat(64));
    assertNotEqual(block1.hash, block2.hash, "hashes should differ");
  });
});

describe("Blockchain", () => {
  it("creates a genesis block on initialization", () => {
    const bc = new Blockchain();
    assertEqual(bc.chain.length, 1, "chain length");
    assertEqual(bc.chain[0].index, 0, "genesis index");
    assertEqual(bc.chain[0].previousHash, "0".repeat(64), "genesis previousHash");
  });

  it("adds a block that references the previous block's hash", () => {
    const bc = new Blockchain();
    bc.addBlock("Block 1");
    assertEqual(bc.chain.length, 2, "chain length");
    assertEqual(bc.chain[1].data, "Block 1", "data");
    assertEqual(bc.chain[1].previousHash, bc.chain[0].hash, "previousHash links to genesis");
  });

  it("links Block 2 to Block 1 via previous hash", () => {
    const bc = new Blockchain();
    bc.addBlock("Block 1");
    bc.addBlock("Block 2");
    assertEqual(bc.chain[2].previousHash, bc.chain[1].hash, "Block2.prevHash === Block1.hash");
  });

  it("has at least 3 blocks after adding two", () => {
    const bc = new Blockchain();
    bc.addBlock("Block 1");
    bc.addBlock("Block 2");
    assert(bc.chain.length >= 3, "need >= 3 blocks");
  });

  it("valid chain passes validation", () => {
    const bc = new Blockchain();
    bc.addBlock("Block 1");
    bc.addBlock("Block 2");
    assert(bc.isChainValid() === true, "chain should be valid");
  });

  it("modifying block data invalidates the chain", () => {
    const bc = new Blockchain();
    bc.addBlock("Block 1");
    bc.addBlock("Block 2");

    bc.chain[1].data = "TAMPERED";
    assert(bc.isChainValid() === false, "chain should be invalid after tampering");
  });

  it("modifying data changes the block's hash", () => {
    const bc = new Blockchain();
    bc.addBlock("Original data");
    const block1 = bc.chain[1];
    const originalHash = block1.hash;

    block1.data = "Modified data";
    block1.hash = block1.calculateHash();

    assertNotEqual(originalHash, block1.hash, "hash should change");
  });
});

describe("Full demonstration (ZDR-001 requirements)", () => {
  it("create chain → modify Block 1 → detect tampering", () => {
    const bc = new Blockchain();
    bc.addBlock("Block 1 - Original");
    bc.addBlock("Block 2");

    assertEqual(bc.chain.length, 3, "need 3 blocks");
    assert(bc.isChainValid() === true, "chain should start valid");

    const block1 = bc.chain[1];
    const originalData = block1.data;
    const originalHash = block1.hash;

    // Modify
    block1.data = "Block 1 - TAMPERED";
    const modifiedHash = block1.calculateHash();

    assertNotEqual(originalData, block1.data, "data changed");
    assertNotEqual(originalHash, modifiedHash, "hash changed");
    assert(bc.isChainValid() === false, "chain invalid after tamper");

    console.log(`\n    Original data:  "${originalData}"`);
    console.log(`    Original hash:  ${originalHash}`);
    console.log(`    Modified data:  "${block1.data}"`);
    console.log(`    Modified hash:  ${modifiedHash}`);
    console.log(`    Hashes match:   false (tampering detected!)`);
  });
});

// ---------------------------------------------------------------------------
// Run & report
// ---------------------------------------------------------------------------

console.log("\n" + "=".repeat(60));
console.log("ZDR-001: BLOCKCHAIN FUNDAMENTALS – TEST SUITE");
console.log("=".repeat(60));

// The describe/it calls above execute immediately

console.log("\n" + "=".repeat(60));
console.log(`Results: ${passedTests}/${totalTests} passed, ${failedTests} failed`);
console.log("=".repeat(60) + "\n");

process.exit(failedTests > 0 ? 1 : 0);
