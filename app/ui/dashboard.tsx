"use client";
import {
  ArrowUpRight,
  Plus,
  ShieldCheck,
  FolderOpen,
  Wallet,
  Activity,
  Search,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Agreement, Draft } from "@/lib/domain";
import { available, total } from "@/lib/domain";
import { money, Status } from "./shared";
import { exampleDraft } from "./builder";
import { Timeline } from "./detail";
export function Dashboard({
  agreements,
  reserved,
  earned,
  reviews,
  filter,
  setFilter,
  query,
  setQuery,
  visible,
  busy,
  create,
  setError,
  setCreating,
  setSelected,
}: {
  agreements: Agreement[];
  reserved: number;
  earned: number;
  reviews: number;
  filter: string;
  setFilter: (s: string) => void;
  query: string;
  setQuery: (s: string) => void;
  visible: Agreement[];
  busy: boolean;
  create: (d: Draft) => Promise<Agreement>;
  setError: (s: string) => void;
  setCreating: (b: boolean) => void;
  setSelected: (s: string) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PAY WITH CONFIDENCE</p>
          <h1>
            Your agreements<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Clear milestones. Shared progress. Money where it belongs.
          </p>
        </div>
        <button className="primary" onClick={() => setCreating(true)}>
          <Plus size={18} />
          New agreement
        </button>
      </div>
      <div className="metrics">
        <section className="metric featured">
          <div className="section-title">
            <span>Reserved for work</span>
            <ShieldCheck size={20} />
          </div>
          <strong>{money(reserved)}</strong>
          <small>
            Across {agreements.filter((a) => a.reserved > 0).length} funded
            agreements
          </small>
        </section>
        <section className="metric">
          <span>Earned by your team</span>
          <strong>{money(earned)}</strong>
          <small>Protected once work is verified</small>
        </section>
        <section className="metric">
          <span>Awaiting verification</span>
          <strong>{String(reviews).padStart(2, "0")}</strong>
          <small>
            {reviews === 1 ? "One milestone" : `${reviews} milestones`} ready
            for review
          </small>
        </section>
      </div>
      <div className="list-toolbar">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList variant="line">
            <TabsTrigger value="all">All agreements</TabsTrigger>
            <TabsTrigger value="active">In progress</TabsTrigger>
            <TabsTrigger value="complete">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="search">
          <Search size={16} />
          <Input
            aria-label="Search agreements"
            placeholder="Search agreements…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {visible.length === 0 ? (
        <section className="empty-state">
          <FolderOpen size={34} />
          <h2>
            {agreements.length
              ? "No matching agreements"
              : "A better way to pay for good work."}
          </h2>
          <p>
            {agreements.length
              ? "Try another name or filter."
              : "Create your first agreement, or explore a renovation example with all three sandbox roles."}
          </p>
          {!agreements.length && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void create(exampleDraft()).catch((e) => setError(e.message))
              }
            >
              {busy ? "Creating…" : "Explore a sample agreement"}
              <ArrowRight size={16} />
            </button>
          )}
        </section>
      ) : (
        visible.map((a) => (
          <button
            className="agreement-card interactive"
            key={a.id}
            onClick={() => setSelected(a.id)}
          >
            <span className="project-icon">
              <FolderOpen size={24} />
            </span>
            <div>
              <Status
                value={
                  a.status === "active" &&
                  a.milestones.some((m) => m.status === "submitted")
                    ? "submitted"
                    : a.status
                }
              />
              <h2>{a.title}</h2>
              <p className="muted">
                With {a.earner} · {a.milestones.length} milestones
              </p>
            </div>
            <div className="project-amount">
              {money(total(a))}
              <small>Total commitment</small>
            </div>
            <footer>
              <span>
                <span className="mini-avatar">
                  {(a.verifier || "YO").slice(0, 2).toUpperCase()}
                </span>
                {a.verifier
                  ? `Verified by ${a.verifier}`
                  : "Payer-approved work"}
              </span>
              <span className="card-progress">
                {a.milestones.filter((m) => m.status === "approved").length} /{" "}
                {a.milestones.length} complete <ArrowUpRight size={17} />
              </span>
            </footer>
          </button>
        ))
      )}
      <div className="bottom-note">
        <ShieldCheck size={16} />
        Payment follows verified progress. Never the other way around.
      </div>
    </>
  );
}
