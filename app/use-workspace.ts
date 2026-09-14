"use client";
import {useCallback,useEffect,useState} from "react";
import { usePrivy } from "@privy-io/react-auth";
import type {Agreement,Action,Draft,Role} from "@/lib/domain";
import type {Intent} from "./ui/action-dialog";
export type Page="agreements"|"earnings"|"activity"|"integrations"|"profile";
export function useWorkspace(){
  const { getAccessToken, authenticated, ready, user } = usePrivy();

  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [page, setPage] = useState<Page>("agreements");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profileData, setProfileData] = useState<{name: string | null; email: string; walletAddress: string} | null>(null);

  useEffect(() => {
    if (authenticated && user?.email?.address && user?.wallet?.address) {
      getAccessToken().then(token => {
        fetch("/api/auth/sync", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            email: user.email!.address,
            walletAddress: user.wallet!.address,
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.user) setProfileData(data.user);
          if (data.needsOnboarding) {
            setNeedsOnboarding(true);
          } else {
            setNeedsOnboarding(false);
          }
        })
        .catch(console.error);
      });
    }
  }, [authenticated, user, getAccessToken]);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    if (!ready || !authenticated) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/agreements", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = (await response.json()) as {
        error: string;
        agreements: Agreement[];
        agreement: Agreement;
      };
      if (response.status === 401) {
        return;
      }
      if (!response.ok) throw new Error(data.error);
      setAgreements(data.agreements);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot load agreements.");
    } finally {
      setLoading(false);
    }
  }, [ready, authenticated, getAccessToken]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  const save = (a: Agreement) =>
    setAgreements((list) => [a, ...list.filter((item) => item.id !== a.id)]);
  const create = async (draft: Draft) => {
    setBusy(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/agreements", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...draft, operationId: crypto.randomUUID() }),
      });
      const data = (await response.json()) as {
        error: string;
        agreements: Agreement[];
        agreement: Agreement;
      };
      if (!response.ok) throw new Error(data.error);
      save(data.agreement);
      setCreating(false);
      setSelected(data.agreement.id);
      setNotice(
        "Agreement created. Switch to worker and verifier to accept the terms.",
      );
      return data.agreement as Agreement;
    } finally {
      setBusy(false);
    }
  };
  const active = agreements.find((a) => a.id === selected);
  const act = async (action: Action) => {
    if (!active) return;
    const token = await getAccessToken();
    const response = await fetch(`/api/agreements/${active.id}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ ...action, version: active.version }),
    });
    const data = (await response.json()) as {
      error: string;
      agreements: Agreement[];
      agreement: Agreement;
    };
    if (!response.ok) {
      await refresh();
      throw new Error(data.error);
    }
    save(data.agreement);
    setNotice("Saved to your private sandbox workspace.");
  };

  const completeOnboarding = async (name: string) => {
    const token = await getAccessToken();
    await fetch("/api/auth/onboard", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ name })
    });
    setNeedsOnboarding(false);
    void refresh();
  };

  const navigate = (value: Page) => {
    setPage(value);
    setSelected(null);
    setIntent(null);
  };
  useEffect(() => {
    type ModelContext = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext["registerTool"]>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: "read_accrue_workspace",
      description:
        "Read the current signed-in sandbox agreement summaries. No real funds.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ({
        mode: "sandbox",
        agreements: agreements.map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          reservedCents: a.reserved,
        })),
      }),
    });
    register({
      name: "open_accrue_agreement",
      description:
        "Open an existing agreement for review. Does not accept terms or move funds.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const id = (input as { id?: unknown })?.id;
        if (typeof id !== "string" || !agreements.some((a) => a.id === id))
          throw new Error("Agreement not found");
        setPage("agreements");
        setSelected(id);
        return { opened: id };
      },
    });
    return () => lifecycle.abort();
  }, [agreements]);
  const visible = agreements.filter(
    (a) =>
      (filter === "all" || a.status === filter) &&
      `${a.title} ${a.earner} ${a.verifier}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const reserved = agreements.reduce((s, a) => s + a.reserved, 0);
  const earned = agreements.reduce(
    (s, a) => s + a.earned.earner + a.earned.verifier,
    0,
  );
  const reviews = agreements.reduce(
    (s, a) => s + a.milestones.filter((m) => m.status === "submitted").length,
    0,
  );
return {agreements,page,selected,setSelected,loading,error,setError,ready,authenticated,creating,setCreating,busy,intent,setIntent,query,setQuery,filter,setFilter,notice,setNotice,refresh,create,active,act,navigate,visible,reserved,earned,reviews,needsOnboarding,completeOnboarding,profileData};
}

