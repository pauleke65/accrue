"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAccount,
  signIn,
  forgetCredential,
  passkeysAvailable,
  type Connection,
} from "@/lib/mera-account";
import {
  readBalance,
  readGasBalance,
  sendAusd,
  requestFaucetDrip,
  reconcile,
  readableError,
} from "@/lib/ausd";
import { parseAmount, type TransactionState } from "@/lib/chain";

/**
 * Live settlement state, kept deliberately apart from the sandbox workspace.
 * Nothing here reads or writes sandbox agreements: a balance shown on this
 * screen came from the chain, and a sandbox figure is never presented as one.
 */
export function useLiveAccount() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [gas, setGas] = useState<bigint | null>(null);
  const [transaction, setTransaction] = useState<TransactionState>({
    status: "idle",
  });
  const [remaining, setRemaining] = useState(0);
  const connectionRef = useRef<Connection | null>(null);

  const available = passkeysAvailable();

  const refresh = useCallback(async (address: `0x${string}`) => {
    try {
      const [next, fee] = await Promise.all([
        readBalance(address),
        readGasBalance(address),
      ]);
      setBalance(next);
      setGas(fee);
    } catch (cause) {
      setError(readableError(cause));
    }
  }, []);

  const adopt = useCallback(
    async (next: Connection) => {
      connectionRef.current?.end();
      connectionRef.current = next;
      setConnection(next);
      setBalance(null);
      setGas(null);
      await refresh(next.address);
    },
    [refresh],
  );

  const connect = useCallback(
    async (mode: "create" | "signin", label = "Accrue account") => {
      setConnecting(true);
      setError("");
      try {
        await adopt(
          mode === "create" ? await createAccount(label) : await signIn(),
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Sign-in failed.");
      } finally {
        setConnecting(false);
      }
    },
    [adopt],
  );

  const disconnect = useCallback(() => {
    connectionRef.current?.end();
    connectionRef.current = null;
    setConnection(null);
    setBalance(null);
    setGas(null);
    setTransaction({ status: "idle" });
  }, []);

  /** Also drops the remembered credential, so the next visit starts clean. */
  const forget = useCallback(() => {
    forgetCredential();
    disconnect();
  }, [disconnect]);

  // The session is bounded: signing is prompt-free until it expires, and the
  // countdown is shown rather than letting a signature fail unexplained.
  useEffect(() => {
    if (!connection) return;
    const tick = () => {
      const left = Math.max(0, connection.expiresAt - Date.now());
      setRemaining(left);
      if (left === 0) disconnect();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [connection, disconnect]);

  useEffect(() => () => connectionRef.current?.end(), []);

  const send = useCallback(
    async (to: string, amount: string) => {
      if (!connection) return;
      setError("");
      let value: bigint;
      try {
        value = parseAmount(amount);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Invalid amount");
        return;
      }
      if (!/^0x[0-9a-fA-F]{40}$/.test(to.trim())) {
        setError("Enter the recipient's full account address.");
        return;
      }
      const state = await sendAusd({
        account: connection.account,
        to: to.trim() as `0x${string}`,
        amount: value,
        report: setTransaction,
      });
      if (state.status !== "failed") await refresh(connection.address);
    },
    [connection, refresh],
  );

  const drip = useCallback(async () => {
    if (!connection) return;
    setError("");
    const state = await requestFaucetDrip({
      account: connection.account,
      report: setTransaction,
    });
    if (state.status !== "failed") await refresh(connection.address);
  }, [connection, refresh]);

  /**
   * The only way out of an unknown outcome. It asks the chain what happened
   * instead of assuming, so the same transfer is never sent twice on a guess.
   */
  const check = useCallback(async () => {
    if (!transaction.hash) return;
    setTransaction(await reconcile(transaction.hash));
    if (connection) await refresh(connection.address);
  }, [transaction.hash, connection, refresh]);

  const clearTransaction = useCallback(
    () => setTransaction({ status: "idle" }),
    [],
  );

  return {
    available,
    connection,
    connecting,
    error,
    setError,
    balance,
    gas,
    transaction,
    remaining,
    connect,
    disconnect,
    forget,
    send,
    drip,
    check,
    clearTransaction,
    refresh,
  };
}
