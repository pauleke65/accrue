import test from "node:test";
import assert from "node:assert/strict";
import {
  centsToBaseUnits,
  parseAmount,
  formatAmount,
  token,
  network,
  shortAddress,
} from "../lib/chain.ts";

test("network and token match the verified deployment", () => {
  assert.equal(network.chainId, 10143);
  assert.equal(token.decimals, 6);
  assert.equal(token.symbol, "AUSD");
  assert.equal(token.address, "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC");
});

test("cents convert to base units at the token's scale", () => {
  assert.equal(centsToBaseUnits(0), 0n);
  assert.equal(centsToBaseUnits(1), 10_000n);
  assert.equal(centsToBaseUnits(100), 1_000_000n);
  // The renovation example from the PRD: 1,030.00 reserved.
  assert.equal(centsToBaseUnits(103_000), 1_030_000_000n);
});

test("cents conversion rejects anything that is not a whole count", () => {
  assert.throws(() => centsToBaseUnits(1.5));
  assert.throws(() => centsToBaseUnits(-1));
  assert.throws(() => centsToBaseUnits(Number.MAX_SAFE_INTEGER + 2));
});

test("amounts parse exactly, without floating point", () => {
  assert.equal(parseAmount("1"), 1_000_000n);
  assert.equal(parseAmount("0.000001"), 1n);
  assert.equal(parseAmount("1030.50"), 1_030_500_000n);
  assert.equal(parseAmount("1,030.50"), 1_030_500_000n);
  assert.equal(parseAmount("  12.34  "), 12_340_000n);
  // 0.1 + 0.2 is the classic float trap; base units make it exact.
  assert.equal(parseAmount("0.1") + parseAmount("0.2"), parseAmount("0.3"));
});

test("amount parsing rejects malformed and over-precise input", () => {
  assert.throws(() => parseAmount(""));
  assert.throws(() => parseAmount("abc"));
  assert.throws(() => parseAmount("-5"));
  assert.throws(() => parseAmount("1.2.3"));
  assert.throws(() => parseAmount("1.0000001"), /6 decimal places/);
});

test("formatting is exact and round-trips through parsing", () => {
  assert.equal(formatAmount(0n), "0.00");
  assert.equal(formatAmount(1_000_000n), "1.00");
  assert.equal(formatAmount(1_030_500_000n), "1,030.50");
  assert.equal(formatAmount(1_234_567_890_000n), "1,234,567.89");
  for (const value of ["0.00", "5.00", "1,030.50", "999,999.99"]) {
    assert.equal(formatAmount(parseAmount(value)), value);
  }
});

test("formatting keeps large values exact where Number would not", () => {
  const huge = parseAmount("9007199254740993.01");
  assert.equal(formatAmount(huge), "9,007,199,254,740,993.01");
});

test("addresses shorten without losing which account they are", () => {
  const short = shortAddress(token.address);
  assert.ok(short.startsWith("0xa901"));
  assert.ok(short.endsWith("22dC"));
});
