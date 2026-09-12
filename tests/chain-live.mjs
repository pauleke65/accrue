/**
 * Live read-only checks against Monad testnet.
 *
 * Separate from the default suite because it needs network access. It moves
 * no funds and needs no key: it only confirms that the constants this app
 * ships still match the chain, which is the failure mode a pinned address
 * would otherwise hide until demo day.
 *
 *   node tests/chain-live.mjs
 */
import assert from "node:assert/strict";
import { publicClient, readBalance, erc20Abi, faucetAbi } from "../lib/ausd.ts";
import { network, token, formatAmount } from "../lib/chain.ts";

const client = publicClient();
const checks = [];

const chainId = await client.getChainId();
assert.equal(
  chainId,
  network.chainId,
  "chain id must match the pinned network",
);
checks.push(`chain id ${chainId}`);

const decimals = await client.readContract({
  address: token.address,
  abi: erc20Abi,
  functionName: "decimals",
});
assert.equal(
  decimals,
  token.decimals,
  "token decimals must match the pinned value; balances would be wrong by orders of magnitude otherwise",
);
checks.push(`${token.symbol} decimals ${decimals}`);

const faucetToken = await client.readContract({
  address: token.faucet,
  abi: [
    {
      type: "function",
      name: "token",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "address" }],
    },
  ],
  functionName: "token",
});
assert.equal(
  faucetToken.toLowerCase(),
  token.address.toLowerCase(),
  "the faucet must pay out the token this app uses",
);
checks.push("faucet pays the pinned token");

const drip = await client.readContract({
  address: token.faucet,
  abi: faucetAbi,
  functionName: "faucetDripAmount",
});
assert.ok(drip > 0n, "faucet must still be dripping");
checks.push(`faucet drip ${formatAmount(drip)} ${token.symbol}`);

const maxOwn = await client.readContract({
  address: token.faucet,
  abi: faucetAbi,
  functionName: "maxAmountToOwn",
});
checks.push(`faucet ceiling ${formatAmount(maxOwn)} ${token.symbol}`);

// A balance read against an account that holds nothing still proves the path.
const balance = await readBalance("0x0000000000000000000000000000000000000001");
assert.equal(typeof balance, "bigint");
checks.push("balance reads return base units as bigint");

const block = await client.getBlockNumber();
checks.push(`head at block ${block}`);

console.log(
  JSON.stringify({ passed: true, network: network.name, checks }, null, 2),
);
