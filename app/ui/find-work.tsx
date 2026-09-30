"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Scale } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWallet } from "../wallet-context";
import { loadReviewerPool } from "./reviewer-suggestions";
import { useTagGate } from "./tag-gate";

/**
 * The worker's and reviewer's way in. Home was written for someone hiring;
 * this is for someone who wants to be hired, or paid to judge work.
 */
export function FindWork() {
  const wallet = useWallet();
  const gate = useTagGate();
  const me = wallet.address?.toLowerCase() ?? "";
  const [joined, setJoined] = useState<string | null | undefined>(undefined);
  const [skills, setSkills] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadReviewerPool().then((pool) => {
      if (!active) return;
      const mine = pool.find((r) => r.address.toLowerCase() === me);
      setJoined(mine ? mine.skills : null);
      if (mine) setSkills(mine.skills);
    });
    return () => { active = false; };
  }, [me]);

  const send = async (method: "PUT" | "DELETE") => {
    if (method === "PUT" && !gate.requireTag()) return;
    setSaving(true);
    setError("");
    try {
      const proofs = await wallet.proveParticipation();
      const response = await fetch("/api/reviewers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(method === "PUT" ? { skills, proofs } : { proofs }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "That did not save.");
      setJoined(method === "PUT" ? skills.trim() : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="home-panel" aria-labelledby="find-work-title">
      <div className="home-panel-head"><h2 id="find-work-title">Get paid on Accrue</h2></div>
      <div className="home-start">
        <a className="home-start-card" href="/jobs">
          <BriefcaseBusiness size={22} aria-hidden />
          <b>Find work</b>
          <p>Browse open jobs clients have listed. You see the pay and what counts as done before you take one, and the money is locked before you start.</p>
          <span>Open the job board <ArrowUpRight size={14} aria-hidden /></span>
        </a>
        <div className="home-start-card home-review-card">
          <Scale size={22} aria-hidden />
          <b>Earn by reviewing</b>
          {joined === undefined ? <p className="muted">Checking…</p> : joined ? (
            <>
              <p>You&apos;re in the reviewer pool for: <b>{joined}</b>. Clients see you when they pick reviewers, and you earn a fee for every decision.</p>
              <button className="text-button" disabled={saving} onClick={() => void send("DELETE")}>Leave the pool</button>
            </>
          ) : (
            <>
              <p>Say what you can judge and clients will be able to name you. You&apos;re paid for each decision, and it builds your public record.</p>
              <form className="home-review-form" onSubmit={(e) => { e.preventDefault(); void send("PUT"); }}>
                <label className="sr-only" htmlFor="review-skills">What you can review</label>
                <Input id="review-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, landing pages, copywriting" maxLength={160} />
                <button className="secondary" type="submit" disabled={saving || skills.trim().length < 3}>{saving ? "Joining…" : "Join"}</button>
              </form>
            </>
          )}
          {error && <p role="alert" className="field-error">{error}</p>}
        </div>
      </div>
    </section>
  );
}
