import type { Hash } from "viem";
import { network } from "./chain";
import { digitalWorkAddress } from "./digital-work-chain";

export function digitalJobId(onchainId: string): string {
  const address = digitalWorkAddress();
  if (!address || !/^\d{1,20}$/.test(onchainId)) throw new Error("Invalid digital job ID or contract address.");
  return `${network.chainId}:${address}:${onchainId}`;
}

export function digitalWriteMessage(action: "create" | "submit" | "vote", jobId: string, hash: Hash): string {
  return `Accrue digital work ${action}\nJob: ${jobId}\nDigest: ${hash}`;
}
