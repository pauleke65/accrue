"use client";
import {
  createPasskeyWithPrfOutput,
  getPasskeyPrfOutput,
  createSecp256k1SigningSession,
  isMeraError,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { LocalAccount } from "viem";

/**
 * The account layer: one passkey, no seed phrase, no extension, no custody
 * backend. A passkey's PRF output is 32 secret bytes that never leave the
 * device; the same passkey always reproduces the same bytes, so the same
 * accounts reconstruct on any device that holds it — nothing is stored server
 * side, and clearing browser storage loses nothing but convenience.
 *
 * One passkey backs several accounts. Each role sits at its own BIP-32 index,
 * so a single ceremony yields distinct payer, worker and verifier accounts
 * with distinct addresses. That is what lets one person demonstrate all three
 * sides of an agreement on one device without pretending a role switch is
 * authorization: each role signs with its own key, and the contract sees three
 * unrelated accounts.
 *
 * Signing sessions own the derived keys in memory for a bounded window. Within
 * it viem signs without a further prompt; once it ends the keys are gone and
 * the next signature needs a fresh passkey ceremony.
 */

export type Role = "payer" | "worker" | "verifier";

export const ROLES: readonly Role[] = ["payer", "worker", "verifier"];

/** Each role derives from its own account index under the standard EVM path. */
const ROLE_INDEX: Record<Role, number> = { payer: 0, worker: 1, verifier: 2 };
const path = (index: number) => `m/44'/60'/0'/0/${index}`;

const CREDENTIAL_KEY = "accrue.passkey.credential";

/** How long a signing session stays prompt-free before it must be renewed. */
export const SESSION_MINUTES = 15;

export type Wallet = {
  addresses: Record<Role, `0x${string}`>;
  accounts: Record<Role, LocalAccount>;
  /** Epoch milliseconds after which signing requires a new passkey ceremony. */
  expiresAt: number;
  end: () => void;
};

export class PasskeyUnsupportedError extends Error {}
export class PasskeyCancelledError extends Error {}

/** WebAuthn needs a secure context; localhost counts during development. */
export function passkeysAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential === "function"
  );
}

function relyingPartyId(): string {
  return window.location.hostname;
}

/**
 * The credential id is a convenience only: it pins a later ceremony to the
 * passkey this browser used last. Sign-in deliberately still works without it,
 * because a discoverable passkey can be offered by the authenticator itself —
 * which is what lets the account survive cleared storage and a fresh device.
 */
function rememberedCredential(): { credentialId: string } | undefined {
  try {
    const raw = window.localStorage.getItem(CREDENTIAL_KEY);
    return raw ? (JSON.parse(raw) as { credentialId: string }) : undefined;
  } catch {
    return undefined;
  }
}

function rememberCredential(credentialId: string): void {
  try {
    window.localStorage.setItem(
      CREDENTIAL_KEY,
      JSON.stringify({ credentialId }),
    );
  } catch {
    // A browser that refuses storage still signs in; it just prompts more.
  }
}

export function forgetCredential(): void {
  try {
    window.localStorage.removeItem(CREDENTIAL_KEY);
  } catch {
    // Nothing to clean up if storage was never available.
  }
}

function connect(prfOutput: Uint8Array): Wallet {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const master = HDKey.fromMasterSeed(seed);
  const sessions: { end: () => void }[] = [];
  const accounts = {} as Record<Role, LocalAccount>;
  const addresses = {} as Record<Role, `0x${string}`>;

  for (const role of ROLES) {
    const node = master.derive(path(ROLE_INDEX[role]));
    if (node.privateKey === null)
      throw new Error("That passkey did not produce a usable account.");
    const session = createSecp256k1SigningSession({
      privateKey: node.privateKey,
    });
    node.wipePrivateData();
    sessions.push(session);
    const account = toViemAccount(session);
    accounts[role] = account;
    addresses[role] = account.address;
  }
  master.wipePrivateData();

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    for (const session of sessions) session.end();
  };
  const expiresAt = Date.now() + SESSION_MINUTES * 60_000;
  window.setTimeout(end, SESSION_MINUTES * 60_000);
  return { addresses, accounts, expiresAt, end };
}

function translate(error: unknown): never {
  if (isMeraError(error)) {
    if (error.code === "PRF_UNAVAILABLE")
      throw new PasskeyUnsupportedError(
        "This device's passkey cannot secure an account. Try a password manager such as 1Password, or iCloud Keychain.",
      );
    if (error.code === "PASSKEY_OPERATION_FAILED")
      throw new PasskeyCancelledError(
        "The passkey prompt was dismissed or did not complete.",
      );
  }
  throw error;
}

/** First visit: one passkey ceremony creates every role's account. */
export async function createWallet(label: string): Promise<Wallet> {
  if (!passkeysAvailable())
    throw new PasskeyUnsupportedError(
      "Passkeys need a secure connection and a supported browser.",
    );
  try {
    const { credentialId, prfOutput } = await createPasskeyWithPrfOutput({
      rp: { id: relyingPartyId(), name: "Accrue" },
      user: { name: label, displayName: label },
    });
    rememberCredential(credentialId);
    return connect(prfOutput);
  } catch (error) {
    translate(error);
  }
}

/** A later visit, on this device or any other holding the passkey. */
export async function openWallet(): Promise<Wallet> {
  if (!passkeysAvailable())
    throw new PasskeyUnsupportedError(
      "Passkeys need a secure connection and a supported browser.",
    );
  try {
    const { prfOutput } = await getPasskeyPrfOutput({
      rpId: relyingPartyId(),
      credential: rememberedCredential(),
    });
    return connect(prfOutput);
  } catch (error) {
    translate(error);
  }
}
