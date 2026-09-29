"use client";
import { useCallback, useEffect, useState } from "react";

export type Page = "home" | "jobs" | "send" | "earnings" | "activity" | "integrations";

/**
 * The workspace shell's own state: which page is showing, which role is
 * acting, and whether there is an authenticated app session at all.
 *
 * That last one still needs a network round trip to know for certain — a
 * missing or expired session cookie only reveals itself once a request
 * carrying it comes back 401. Every page-specific fetch already handles its
 * own data, but the shell needs an answer before it can decide whether to
 * show a page at all, or the signed-out landing screen instead.
 */
export function useWorkspace() {
  const [page, setPage] = useState<Page>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/agreements");
      if (response.status === 401) {
        setSignedOut(true);
        return;
      }
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not reach your workspace.");
      }
      setSignedOut(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not reach your workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const navigate = (value: Page) => setPage(value);

  return {
    page,
    loading,
    error,
    signedOut,
    notice,
    setNotice,
    refresh,
    navigate,
  };
}
