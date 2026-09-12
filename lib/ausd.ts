import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  type Account,
  type Hash,
} from "viem";
import { chain, network, token, type TransactionState } from "./chain.ts";

/**
 * Reading and moving AUSD on Monad testnet.
 *
 * Every write here reports its lifecycle through an `onState` callback rather
 * than only resolving at the end, because the interface has to distinguish
 * "waiting for a signature" from "submitted" from "confirmed" — and has to be
 * able to say "unknown" when a submission's outcome could not be established.
 * An unknown outcome is never retried blindly; it is reconciled first.
 */

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

/** Agora's testnet faucet: 10,000 AUSD a call, one a minute, up to 100,000 held. */
export const faucetAbi = [
  {
    type: "function",
    name: "requestFunds",
    stateMutability: "nonpayable",
    inputs: [{ name: "recipient", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "faucetDripAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "maxAmountToOwn",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** Reads fall back across the published endpoints rather than trusting one. */
export function publicClient() {
  return createPublicClient({
    chain,
    transport: fallback(network.rpcUrls.map((url) => http(url))),
  });
}

export function walletClient(account: Account) {
  return createWalletClient({
    account,
    chain,
    transport: fallback(network.rpcUrls.map((url) => http(url))),
  });
}

export async function readBalance(address: `0x${string}`): Promise<bigint> {
  return publicClient().readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
}

export async function readGasBalance(address: `0x${string}`): Promise<bigint> {
  return publicClient().getBalance({ address });
}

/** How long to watch for a receipt before the outcome is called unknown. */
const RECEIPT_TIMEOUT_MS = 40_000;

type Report = (state: TransactionState) => void;

/**
 * Watches a submitted transaction to a settled outcome. A timeout is not a
 * failure: the transaction may still confirm, so the state becomes "unknown"
 * and carries the hash for reconciliation.
 */
async function settle(hash: Hash, report?: Report): Promise<TransactionState> {
  report?.({ status: "submitted", hash });
  try {
    const receipt = await publicClient().waitForTransactionReceipt({
      hash,
      timeout: RECEIPT_TIMEOUT_MS,
    });
    const state: TransactionState =
      receipt.status === "success"
        ? { status: "confirmed", hash }
        : {
            status: "failed",
            hash,
            error: "The network rejected this transfer.",
          };
    report?.(state);
    return state;
  } catch {
    const state: TransactionState = {
      status: "unknown",
      hash,
      error:
        "This transfer was sent but its outcome is not yet known. Check before sending again.",
    };
    report?.(state);
    return state;
  }
}

/**
 * Re-checks a transaction whose outcome was never established. This is the
 * only sanctioned path out of "unknown": the caller must learn what happened
 * before offering a retry, so the same transfer cannot be sent twice.
 */
export async function reconcile(hash: Hash): Promise<TransactionState> {
  try {
    const receipt = await publicClient().getTransactionReceipt({ hash });
    return receipt.status === "success"
      ? { status: "confirmed", hash }
      : {
          status: "failed",
          hash,
          error: "The network rejected this transfer.",
        };
  } catch {
    return {
      status: "unknown",
      hash,
      error: "The network has not recorded this transfer yet.",
    };
  }
}

export async function sendAusd(options: {
  account: Account;
  to: `0x${string}`;
  amount: bigint;
  report?: Report;
}): Promise<TransactionState> {
  const { account, to, amount, report } = options;
  if (amount <= 0n) throw new Error("Enter an amount above zero.");
  report?.({ status: "awaiting-signature" });
  let hash: Hash;
  try {
    hash = await walletClient(account).writeContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
      chain,
      account,
    });
  } catch (error) {
    const state: TransactionState = {
      status: "failed",
      error: readableError(error),
    };
    report?.(state);
    return state;
  }
  return settle(hash, report);
}

/** Self-funds a demo account from Agora's testnet faucet. */
export async function requestFaucetDrip(options: {
  account: Account;
  report?: Report;
}): Promise<TransactionState> {
  const { account, report } = options;
  report?.({ status: "awaiting-signature" });
  let hash: Hash;
  try {
    hash = await walletClient(account).writeContract({
      address: token.faucet,
      abi: faucetAbi,
      functionName: "requestFunds",
      args: [account.address],
      chain,
      account,
    });
  } catch (error) {
    const state: TransactionState = {
      status: "failed",
      error: readableError(error),
    };
    report?.(state);
    return state;
  }
  return settle(hash, report);
}

/**
 * Turns provider errors into something a payer can act on. Anything
 * unrecognised keeps its original text rather than being flattened into a
 * generic message that hides what happened.
 */
export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/insufficient funds/i.test(message))
    return "This account has no MON left to pay the network fee. Top it up from the Monad faucet.";
  if (/transfer amount exceeds balance|ERC20: transfer/i.test(message))
    return "That is more AUSD than this account holds.";
  if (/User rejected|denied|cancelled/i.test(message))
    return "The signature was declined.";
  if (/nonce/i.test(message))
    return "This account has another transfer in flight. Wait for it to settle, then try again.";
  return message.split("\n")[0].slice(0, 200);
}
