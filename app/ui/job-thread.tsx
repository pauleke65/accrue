"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { shortAddress } from "@/lib/chain";
import type { JobKind } from "@/lib/next-actions";
import { useWallet } from "../wallet-context";

type Message = { id: string; author: string; tag: string | null; body: string; at: string };

/**
 * The conversation on one job. Refreshes every 30 seconds while open, so a
 * reply shows up without a reload. Roles come from the job itself, so each
 * line says who is speaking: client, worker or reviewer.
 */
export function JobThread({ kind, id, roles }: { kind: JobKind; id: string; roles: Record<string, string> }) {
  const wallet = useWallet();
  const { proveParticipation } = wallet;
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const proofs = await proveParticipation();
      const response = await fetch(`/api/job-messages?kind=${kind}&id=${encodeURIComponent(id)}&proofs=${encodeURIComponent(JSON.stringify(proofs))}`);
      const data = (await response.json()) as { messages?: Message[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load messages.");
      setMessages(data.messages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load messages.");
    }
  }, [kind, id, proveParticipation]);

  useEffect(() => {
    void Promise.resolve().then(load);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setError("");
    try {
      const proofs = await proveParticipation();
      const response = await fetch("/api/job-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, body: draft, proofs }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Message not sent.");
      setDraft("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message not sent.");
    } finally {
      setSending(false);
    }
  };

  const me = wallet.address?.toLowerCase();
  return (
    <section className="panel job-thread" aria-labelledby={`thread-${id}`}>
      <div className="section-title">
        <h2 id={`thread-${id}`}><MessageSquare size={17} aria-hidden /> Messages</h2>
        <button className="text-button" onClick={() => void load()} aria-label="Refresh messages"><RefreshCw size={14} aria-hidden /></button>
      </div>
      <p className="fine-print">Only the people on this job see these. Messages don&apos;t change the terms; only what everyone accepted on chain counts.</p>
      {messages === null && !error ? <p className="muted">Loading…</p> : null}
      {messages && messages.length === 0 && <p className="muted">No messages yet. Ask about the brief, share a draft, or flag a problem early.</p>}
      {messages && messages.length > 0 && (
        <ol className="thread-list">
          {messages.map((m) => {
            const mine = m.author.toLowerCase() === me;
            return (
              <li key={m.id} className={mine ? "mine" : undefined}>
                <span className="thread-who">
                  {m.tag ? `@${m.tag}` : shortAddress(m.author)}
                  {roles[m.author.toLowerCase()] && <em>{roles[m.author.toLowerCase()]}</em>}
                  <time dateTime={m.at}>{new Date(m.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
                </span>
                <p>{m.body}</p>
              </li>
            );
          })}
        </ol>
      )}
      {error && <div role="alert" className="error-banner">{error}<button className="text-button" onClick={() => setError("")}>Dismiss</button></div>}
      <form className="thread-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label className="sr-only" htmlFor={`thread-input-${id}`}>Write a message</label>
        <Textarea id={`thread-input-${id}`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="Write to everyone on this job" />
        <button className="primary" type="submit" disabled={sending || !draft.trim()}><Send size={15} aria-hidden /> {sending ? "Sending…" : "Send"}</button>
      </form>
    </section>
  );
}
