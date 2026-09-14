import {
  keccak256,
  encodeAbiParameters,
  decodeEventLog,
  type Account,
  type Hash,
} from "viem";
import abi from "./abi/escrow.json" with { type: "json" };
import { chain, escrow, token, type TransactionState } from "./chain.ts";
import { publicClient, walletClient, erc20Abi, readableError } from "./ausd.ts";

/**
 * Calls against the deployed milestone escrow.
 *
 * Authorization lives in the contract, not here: it binds every action to
 * msg.sender, so a wrong account cannot approve, withdraw, or accept another
 * participant's role no matter what this module asks for. What this module
 * owes the interface is an honest account of what happened to each call.
 */

export const escrowAbi = abi;

/**
 * The contract's own values, read from the source rather than assumed.
 * There is no distinct "changes requested" state: requestChanges returns the
 * milestone to pending, so the workflow status the app displays for that case
 * lives in the application record, not on chain.
 */
export const MilestoneState = {
  pending: 0,
  submitted: 1,
  earned: 2,
} as const;

export type MilestoneInput = {
  workerAmount: bigint;
  verifierFee: bigint;
  externalVerifier: boolean;
  criteriaHash: `0x${string}`;
};

export type OnChainAgreement = {
  payer: `0x${string}`;
  worker: `0x${string}`;
  verifier: `0x${string}`;
  expiry: bigint;
  termsHash: `0x${string}`;
  acceptances: number;
  cancellationVotes: number;
  funded: boolean;
  cancelled: boolean;
  deposit: bigint;
  reserved: bigint;
  workerEarned: bigint;
  verifierEarned: bigint;
  workerWithdrawn: bigint;
  verifierWithdrawn: bigint;
  refunded: bigint;
  nextMilestone: bigint;
};

/** Hashes text the way the contract expects: a digest, never the text itself. */
export function hashText(value: string): `0x${string}` {
  return keccak256(new TextEncoder().encode(value));
}

/**
 * Recomputes the terms hash the contract derived at creation. A participant
 * accepts this exact value, so acceptance cannot drift onto different terms
 * than the ones they were shown.
 */
export function termsHash(input: {
  id: bigint;
  payer: `0x${string}`;
  worker: `0x${string}`;
  verifier: `0x${string}`;
  expiry: bigint;
  scopeHash: `0x${string}`;
  milestones: readonly MilestoneInput[];
}): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "address" },
        { type: "uint64" },
        { type: "bytes32" },
        {
          type: "tuple[]",
          components: [
            { name: "workerAmount", type: "uint128" },
            { name: "verifierFee", type: "uint128" },
            { name: "externalVerifier", type: "bool" },
            { name: "criteriaHash", type: "bytes32" },
          ],
        },
      ],
      [
        BigInt(chain.id),
        escrow.address,
        input.id,
        input.payer,
        input.worker,
        input.verifier,
        input.expiry,
        input.scopeHash,
        input.milestones as never,
      ],
    ),
  );
}

export async function readAgreement(id: bigint): Promise<OnChainAgreement> {
  return publicClient().readContract({
    address: escrow.address,
    abi: escrowAbi,
    functionName: "getAgreement",
    args: [id],
  }) as Promise<OnChainAgreement>;
}

export async function readMilestones(id: bigint) {
  return publicClient().readContract({
    address: escrow.address,
    abi: escrowAbi,
    functionName: "getMilestones",
    args: [id],
  });
}

export async function readNextId(): Promise<bigint> {
  return publicClient().readContract({
    address: escrow.address,
    abi: escrowAbi,
    functionName: "nextId",
  }) as Promise<bigint>;
}

/**
 * The id a confirmed `create` call actually assigned, read from the
 * `AgreementCreated` event the transaction emitted.
 *
 * `nextId` is a live counter shared by every agreement on this contract. Read
 * it before submitting a create and assume the result is yours, and a second
 * create landing first — another workspace, a concurrent script, even a
 * double-click — hands you the wrong id: the app then funds, approves and
 * withdraws against an agreement that is not the one it thinks it is. The
 * event is the contract's own record of what id this specific transaction
 * produced, so it cannot be wrong the way a prediction can.
 */
export async function readCreatedId(hash: Hash): Promise<bigint> {
  const receipt = await publicClient().getTransactionReceipt({ hash });
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== escrow.address.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: escrowAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "AgreementCreated") {
        const args = decoded.args as unknown as { id: bigint };
        return args.id;
      }
    } catch {
      // Not every log on this contract is AgreementCreated; skip and keep looking.
    }
  }
  throw new Error(
    "The agreement was created, but its id could not be read back from the transaction.",
  );
}

type Report = (state: TransactionState) => void;

/**
 * Sends one escrow call and follows it to a settled outcome. As with plain
 * transfers, a receipt that never arrives becomes "unknown" rather than being
 * guessed at in either direction.
 */
export async function callEscrow(options: {
  account: Account;
  functionName: string;
  args: readonly unknown[];
  report?: Report;
}): Promise<TransactionState & { hash?: Hash }> {
  const { account, functionName, args, report } = options;
  report?.({ status: "awaiting-signature" });
  let hash: Hash;
  try {
    hash = await walletClient(account).writeContract({
      address: escrow.address,
      abi: escrowAbi,
      functionName,
      args,
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
  report?.({ status: "submitted", hash });
  try {
    const receipt = await publicClient().waitForTransactionReceipt({
      hash,
      timeout: 40_000,
    });
    const state: TransactionState =
      receipt.status === "success"
        ? { status: "confirmed", hash }
        : {
            status: "failed",
            hash,
            error: "The contract rejected this action.",
          };
    report?.(state);
    return state;
  } catch {
    const state: TransactionState = {
      status: "unknown",
      hash,
      error:
        "This action was sent but its outcome is not yet known. Check before sending it again.",
    };
    report?.(state);
    return state;
  }
}

/**
 * Funding needs an allowance first. The approval is for exactly the deposit,
 * never unbounded, so the escrow can never draw more than the agreement's own
 * total from the payer's account.
 */
export async function approveDeposit(options: {
  account: Account;
  amount: bigint;
  report?: Report;
}): Promise<TransactionState & { hash?: Hash }> {
  const { account, amount, report } = options;
  report?.({ status: "awaiting-signature" });
  let hash: Hash;
  try {
    hash = await walletClient(account).writeContract({
      address: token.address,
      abi: [
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
      ] as const,
      functionName: "approve",
      args: [escrow.address, amount],
      chain,
      account,
    });
  } catch (error) {
    // Without this, a raw provider message — sometimes as opaque as "Missing
    // or invalid parameters" — reached the screen verbatim. callEscrow
    // already translated its own failures this way; this step was the one
    // gap in that pattern.
    const state: TransactionState = {
      status: "failed",
      error: readableError(error),
    };
    report?.(state);
    return state;
  }
  report?.({ status: "submitted", hash });
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  const state: TransactionState =
    receipt.status === "success"
      ? { status: "confirmed", hash }
      : { status: "failed", hash, error: "Approval failed." };
  report?.(state);
  return state;
}

export async function readAllowance(owner: `0x${string}`): Promise<bigint> {
  return publicClient().readContract({
    address: token.address,
    abi: [
      {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ type: "uint256" }],
      },
    ] as const,
    functionName: "allowance",
    args: [owner, escrow.address],
  });
}

export { erc20Abi };
