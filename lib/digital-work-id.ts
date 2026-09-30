import { getAddress, isAddress, type Address, type Hash } from "viem";
import { network } from "./chain";
import { digitalWorkAddress } from "./digital-work-chain";

/**
 * A job's id names the chain, the contract and the on-chain number, so two
 * deployments (each counting from zero) never share an id. New jobs use the
 * current contract; pass `at` for a job on an earlier deployment.
 */
export function digitalJobId(onchainId: string, at?: string | null): string {
  const address = at && isAddress(at) ? getAddress(at) : digitalWorkAddress();
  if (!address || !/^\d{1,20}$/.test(onchainId)) throw new Error("Invalid digital job ID or contract address.");
  return `${network.chainId}:${address}:${onchainId}`;
}

/** The contract a job id belongs to. */
export function contractOfJobId(id: string): Address {
  const address = id.split(":")[1];
  if (!address || !isAddress(address)) throw new Error("Invalid digital job ID.");
  return getAddress(address);
}

export function digitalWriteMessage(action: "create" | "submit" | "vote", jobId: string, hash: Hash): string {
  return `Accrue digital work ${action}\nJob: ${jobId}\nDigest: ${hash}`;
}
