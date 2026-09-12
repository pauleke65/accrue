import { monadTestnet } from "viem/chains";

/**
 * Live-settlement constants. Every value here was read from an official source
 * on 13 September 2026 and confirmed by direct eth_call against public RPC;
 * `docs/RULES-AND-NETWORK.md` records the sources.
 *
 * Nothing in this module touches the sandbox. Sandbox money is integer cents
 * in D1; chain money is AUSD base units as bigint. The two are never mixed,
 * and the conversion below is the only bridge between them.
 */

export const chain = monadTestnet;

export const network = {
  chainId: 10143,
  name: "Monad Testnet",
  rpcUrls: [
    "https://testnet-rpc.monad.xyz",
    "https://rpc-testnet.monadinfra.com",
    "https://rpc.ankr.com/monad_testnet",
  ],
  explorer: "https://testnet.monadvision.com",
  gasFaucet: "https://faucet.monad.xyz",
} as const;

/** Agora's testnet AUSD deployment, verified on chain: symbol AUSD, 6 decimals. */
export const token = {
  address: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC",
  faucet: "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C",
  symbol: "AUSD",
  name: "Agora Dollar",
  decimals: 6,
} as const;

export type BaseUnits = bigint;

const SCALE = 10n ** BigInt(token.decimals);

/**
 * The sandbox counts integer cents; AUSD carries six decimals. One cent is
 * therefore 10^4 base units. Conversion only ever runs in this direction:
 * a sandbox figure can seed a live amount, but a live balance is never
 * rewritten back into sandbox cents.
 */
export function centsToBaseUnits(cents: number): BaseUnits {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new Error("Cents must be a non-negative integer");
  return BigInt(cents) * 10n ** BigInt(token.decimals - 2);
}

/** Parses a human amount such as "1030.50" into base units, without floats. */
export function parseAmount(input: string): BaseUnits {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Enter a valid amount");
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > token.decimals)
    throw new Error(
      `${token.symbol} supports ${token.decimals} decimal places`,
    );
  return (
    BigInt(whole) * SCALE + BigInt(fraction.padEnd(token.decimals, "0") || "0")
  );
}

/** Formats base units for display. Exact; never routed through Number. */
export function formatAmount(value: BaseUnits): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(token.decimals, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${fraction.slice(0, 2)}`;
}

export const explorer = {
  tx: (hash: string) => `${network.explorer}/tx/${hash}`,
  address: (address: string) => `${network.explorer}/address/${address}`,
};

/** Shortens an address for display without hiding which account it is. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Lifecycle of a submitted transaction. "unknown" is deliberate: a submission
 * whose outcome could not be established must be reconciled against the chain
 * before any retry, never silently resent.
 */
export type TransactionStatus =
  | "idle"
  | "awaiting-signature"
  | "submitted"
  | "confirmed"
  | "failed"
  | "unknown";

export type TransactionState = {
  status: TransactionStatus;
  hash?: `0x${string}`;
  error?: string;
};
