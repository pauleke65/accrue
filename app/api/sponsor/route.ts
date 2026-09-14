import { env } from "cloudflare:workers";
import { authorize, failure, HttpError } from "@/lib/server";
import {
  isAddress,
  getAddress,
  parseEther,
  createWalletClient,
  http,
  fallback,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { publicClient, faucetAbi } from "@/lib/ausd";
import { network, token, GAS_TOPUP_THRESHOLD } from "@/lib/chain";

/**
 * Gas sponsorship for first-time accounts.
 *
 * A new passkey account holds no MON, so it can neither claim test AUSD nor
 * send anything — the product would ask someone to find a gas faucet before
 * they can be paid, which is exactly the blockchain plumbing this is supposed
 * to hide. The sponsor pays that first cost instead.
 *
 * It is deliberately narrow. It calls one function on one known faucet
 * contract, or sends a small fixed amount of test MON, to the address the
 * signed-in user asked for. It never takes an arbitrary transaction, never
 * takes an arbitrary target, and is capped per account and per workspace.
 * On a test network with test money, that is a sensible trade; on a real
 * network this would need a budget, quotas and monitoring first.
 */

/** Enough test MON to cover a handful of transfers, and no more. */
const GAS_GRANT = parseEther("0.05");
/** Above this the account does not need help — shared with the client, so
    the two sides agree on what "enough" means. See GAS_TOPUP_THRESHOLD. */
const GAS_CEILING = GAS_TOPUP_THRESHOLD;

function relayer() {
  const key = (env as Record<string, unknown>).ACCRUE_SPONSOR_KEY;
  if (typeof key !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(key))
    throw new HttpError(
      503,
      "Sponsored gas is not configured on this deployment. An account can still act if it holds MON.",
    );
  return privateKeyToAccount(key as `0x${string}`);
}

function wallet() {
  return createWalletClient({
    account: relayer(),
    chain: monadTestnet,
    transport: fallback(network.rpcUrls.map((url) => http(url))),
  });
}

export async function GET() {
  try {
    await authorize();
    const key = (env as Record<string, unknown>).ACCRUE_SPONSOR_KEY;
    const configured =
      typeof key === "string" && /^0x[0-9a-fA-F]{64}$/.test(key);
    if (!configured) return Response.json({ configured: false });
    const account = relayer();
    const balance = await publicClient().getBalance({
      address: account.address,
    });
    return Response.json({
      configured: true,
      address: account.address,
      funded: balance > GAS_GRANT,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    const body = (await request.json()) as {
      address?: string;
      action?: "gas" | "tokens";
    };
    if (!body.address || !isAddress(body.address))
      throw new HttpError(400, "A valid account address is required.");
    const address = getAddress(body.address);
    const action = body.action ?? "gas";
    const client = publicClient();

    if (action === "gas") {
      const balance = await client.getBalance({ address });
      if (balance >= GAS_CEILING)
        return Response.json({
          skipped: true,
          reason: "This account already has enough to cover network fees.",
        });
      const hash = await wallet().sendTransaction({
        to: address,
        value: GAS_GRANT,
        chain: monadTestnet,
        account: relayer(),
      });
      await client.waitForTransactionReceipt({ hash });
      return Response.json({ hash, action });
    }

    // The faucet takes the recipient as an argument, so the sponsor can claim
    // on the user's behalf and pay the fee. The tokens land in the user's
    // account, never the sponsor's.
    const hash = await wallet().writeContract({
      address: token.faucet,
      abi: faucetAbi,
      functionName: "requestFunds",
      args: [address],
      chain: monadTestnet,
      account: relayer(),
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success")
      throw new HttpError(
        429,
        "The faucet refused: it allows one claim a minute, and stops once an account holds 100,000.",
      );
    return Response.json({ hash, action });
  } catch (error) {
    return failure(error);
  }
}
