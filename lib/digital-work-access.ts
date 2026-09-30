import { getAddress, isAddress, verifyMessage, type Address, type Hash } from "viem";
import { readDigitalJob, type DigitalJobOnChain } from "./digital-work-chain";
import { contractOfJobId, digitalJobId, digitalWriteMessage } from "./digital-work-id";
import { verifiedAddresses, type ParticipantProof } from "./live-agreements-access";
import { database, HttpError } from "./server";

export type DigitalJobRow = {
  id: string;
  onchain_id: string;
  title: string;
  policy_json: string;
  policy_hash: string;
  payer_address: string;
  worker_address: string;
  verifier_a: string;
  verifier_b: string;
  verifier_c: string;
  created_at: string;
};

export { contractOfJobId, digitalJobId, digitalWriteMessage } from "./digital-work-id";

export async function verifyDigitalWrite(
  address: string,
  signature: string,
  action: "create" | "submit" | "vote",
  jobId: string,
  hash: Hash,
): Promise<void> {
  if (!isAddress(address) || !signature.startsWith("0x"))
    throw new HttpError(403, "Signed participant proof required.");
  const valid = await verifyMessage({
    address: getAddress(address),
    message: digitalWriteMessage(action, jobId, hash),
    signature: signature as Hash,
  });
  if (!valid) throw new HttpError(403, "Participant signature did not verify.");
}

/**
 * `contract` names the deployment for a job created on an earlier one. It is
 * only a lookup key: the row must exist, and its policy must match what that
 * contract holds, so naming an arbitrary address finds nothing.
 */
export async function readAuthorizedDigitalJob(
  onchainId: string,
  proofs: ParticipantProof[] | undefined,
  contract?: string | null,
): Promise<{ row: DigitalJobRow; chainJob: DigitalJobOnChain; addresses: Address[]; contract: Address }> {
  const id = digitalJobId(onchainId, contract);
  const at = contractOfJobId(id);
  const row = await database()
    .prepare("SELECT * FROM digital_jobs WHERE id = ?")
    .bind(id)
    .first<DigitalJobRow>();
  if (!row) throw new HttpError(404, "Digital job not found.");
  const addresses = await verifiedAddresses(proofs);
  const participants = [row.payer_address, row.worker_address, row.verifier_a, row.verifier_b, row.verifier_c];
  if (!addresses.some((address) => participants.some((participant) => participant.toLowerCase() === address.toLowerCase())))
    throw new HttpError(403, "A participant signature is required to view this job.");
  const chainJob = await readDigitalJob(BigInt(onchainId), at);
  if (chainJob.policyHash.toLowerCase() !== row.policy_hash.toLowerCase())
    throw new HttpError(409, "Readable policy does not match the contract.");
  return { row, chainJob, addresses, contract: at };
}
