import {
  decodeEventLog,
  getAddress,
  isAddress,
  type Account,
  type Address,
  type Hash,
} from "viem";
import abi from "./abi/digital-work.json" with { type: "json" };
import { announceSettled, chain, token, type TransactionState } from "./chain";
import { publicClient, readableError, walletClient } from "./ausd";

export const digitalWorkAbi = abi;

const approvalAbi = [
  {
    type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const DigitalWorkStatus = {
  draft: 0,
  funded: 1,
  submitted: 2,
  needsChanges: 3,
  paid: 4,
  refunded: 5,
  /** Rules version 2 only. */
  cancelled: 6,
} as const;

export type DigitalJobOnChain = {
  payer: Address;
  worker: Address;
  verifiers: readonly [Address, Address, Address];
  reward: bigint;
  feePool: bigint;
  remainingFees: bigint;
  deliveryDeadline: bigint;
  reviewDeadline: bigint;
  policyHash: Hash;
  evidenceHash: Hash;
  version: number;
  passVotes: number;
  failVotes: number;
  workerAccepted: boolean;
  status: number;
};

export function digitalWorkAddress(): Address | null {
  const configured = process.env.NEXT_PUBLIC_ACCRUE_DIGITAL_WORK_ADDRESS;
  return configured && isAddress(configured) ? getAddress(configured) : null;
}

function configuredAddress(): Address {
  const address = digitalWorkAddress();
  if (!address) throw new Error("Digital-work contract is not configured.");
  return address;
}

/**
 * Every helper takes the contract a job lives on. New jobs use the current
 * deployment; a job created on an earlier one keeps being read and acted on
 * there (digital_jobs.contract), so a new version never strands old jobs.
 */
const rulesCache = new Map<string, Promise<number>>();

/** 1 for the original rules, 2 for pay-on-silence and cancellation. */
export function readDigitalRulesVersion(at?: Address): Promise<number> {
  const address = at ?? configuredAddress();
  const key = address.toLowerCase();
  if (!rulesCache.has(key))
    rulesCache.set(key, publicClient()
      .readContract({ address, abi: digitalWorkAbi, functionName: "rulesVersion" })
      .then((v) => Number(v))
      .catch(() => 1)); // version 1 has no such function
  return rulesCache.get(key)!;
}

/** Which parties have agreed to cancel (version 2): bit 1 payer, bit 2 worker. */
export async function readCancelConsents(id: bigint, at?: Address): Promise<number> {
  const address = at ?? configuredAddress();
  if ((await readDigitalRulesVersion(address)) < 2) return 0;
  return Number(await publicClient().readContract({
    address, abi: digitalWorkAbi, functionName: "cancelConsents", args: [id],
  }));
}

export async function readDigitalJob(id: bigint, at?: Address): Promise<DigitalJobOnChain> {
  return publicClient().readContract({
    address: at ?? configuredAddress(),
    abi: digitalWorkAbi,
    functionName: "getJob",
    args: [id],
  }) as Promise<DigitalJobOnChain>;
}

export async function readDigitalClaimable(address: Address, at?: Address): Promise<bigint> {
  return publicClient().readContract({
    address: at ?? configuredAddress(),
    abi: digitalWorkAbi,
    functionName: "claimable",
    args: [address],
  }) as Promise<bigint>;
}

export async function ensureDigitalAllowance(
  account: Account,
  amount: bigint,
  report?: (state: TransactionState) => void,
  at?: Address,
): Promise<void> {
  const spender = at ?? configuredAddress();
  const allowance = await publicClient().readContract({
    address: token.address, abi: approvalAbi, functionName: "allowance", args: [account.address, spender],
  });
  if (allowance >= amount) return;
  report?.({ status: "awaiting-signature" });
  const hash = await walletClient(account).writeContract({
    address: token.address, abi: approvalAbi, functionName: "approve",
    args: [spender, amount], chain, account,
  });
  report?.({ status: "submitted", hash });
  const sentAt = Date.now();
  const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 40_000 });
  if (receipt.status !== "success") throw new Error("AUSD approval did not confirm.");
  announceSettled(hash, sentAt);
  report?.({ status: "confirmed", hash });
}

export async function readDigitalVote(id: bigint, verifier: Address, at?: Address): Promise<{
  version: number;
  pass: boolean;
  reportHash: Hash;
}> {
  const value = await publicClient().readContract({
    address: at ?? configuredAddress(),
    abi: digitalWorkAbi,
    functionName: "votes",
    args: [id, verifier],
  }) as readonly [number, boolean, Hash];
  return { version: value[0], pass: value[1], reportHash: value[2] };
}

export async function sendDigitalAction(options: {
  account: Account;
  functionName: string;
  args: readonly unknown[];
  report?: (state: TransactionState) => void;
  /** The contract the job lives on; the current deployment if omitted. */
  at?: Address;
}): Promise<TransactionState & { hash?: Hash }> {
  const { account, functionName, args, report, at } = options;
  report?.({ status: "awaiting-signature" });
  let hash: Hash;
  try {
    hash = await walletClient(account).writeContract({
      address: at ?? configuredAddress(),
      abi: digitalWorkAbi,
      functionName,
      args,
      chain,
      account,
    });
  } catch (error) {
    const state: TransactionState = { status: "failed", error: readableError(error) };
    report?.(state);
    return state;
  }
  report?.({ status: "submitted", hash });
  const sentAt = Date.now();
  try {
    const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 40_000 });
    if (receipt.status === "success") announceSettled(hash, sentAt);
    const state: TransactionState = receipt.status === "success"
      ? { status: "confirmed", hash }
      : { status: "failed", hash, error: "The contract rejected this action." };
    report?.(state);
    return state;
  } catch {
    const state: TransactionState = {
      status: "unknown",
      hash,
      error: "Transaction sent, but confirmation is unknown. Check the chain before retrying.",
    };
    report?.(state);
    return state;
  }
}

export async function readDigitalCreatedId(hash: Hash): Promise<bigint> {
  const receipt = await publicClient().getTransactionReceipt({ hash });
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== configuredAddress().toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: digitalWorkAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "JobCreated") {
        return (decoded.args as unknown as { id: bigint }).id;
      }
    } catch {
      // Other events in the same receipt are not a created job.
    }
  }
  throw new Error("The job was created, but its on-chain ID could not be read.");
}
