"use client";
import { useState } from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Draft } from "@/lib/domain";
import { Choice, money } from "./shared";
const initialMilestone = {
  title: "",
  criteria: "",
  amount: 100000,
  fee: 3000,
  approver: "verifier" as const,
};
export const exampleDraft = (): Draft => ({
  title: "Lekki home renovation",
  scope:
    "Renovate the ground-floor living space. The agreed site engineer reviews the evidence against each milestone before payment is earned.",
  earner: "worker@example.com",
  verifier: "verifier@example.com",
  expiry: new Date(Date.now() + 30 * 86400000).toISOString(),
  milestones: [
    {
      title: "Preparation & materials",
      criteria:
        "Site cleared, material quantities checked, and dated delivery receipts attached.",
      amount: 100000,
      fee: 3000,
      approver: "verifier",
    },
    {
      title: "Electrical & finishing",
      criteria:
        "Electrical work tested and signed off. Wall finishing matches the accepted specification.",
      amount: 150000,
      fee: 4500,
      approver: "verifier",
    },
    {
      title: "Final handover",
      criteria:
        "Complete a joint walkthrough and resolve every item on the snag list.",
      amount: 50000,
      fee: 1500,
      approver: "verifier",
    },
  ],
});
export default function Builder({
  open,
  onClose,
  onCreate,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: Draft) => Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Draft>({
    title: "",
    scope: "",
    earner: "",
    verifier: "",
    expiry: new Date(Date.now() + 30 * 86400000).toISOString(),
    milestones: [initialMilestone],
  });
  const [error, setError] = useState("");
  const update = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const milestone = (index: number, key: string, value: unknown) =>
    setDraft((d) => ({
      ...d,
      milestones: d.milestones.map((m, i) =>
        i === index
          ? {
              ...m,
              [key]: value,
              ...(key === "approver" && value === "payer" ? { fee: 0 } : {}),
            }
          : m,
      ),
    }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onCreate(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create agreement");
    }
  }
  return (
    <Dialog open={open} onOpenChange={(value) => !value && !busy && onClose()}>
      <DialogContent className="builder-dialog">
        <DialogHeader>
          <DialogTitle>Make good work a clear agreement.</DialogTitle>
          <DialogDescription>
            Define the work, the people, and exactly when payment is earned.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-stack">
          <label>
            Project name
            <Input
              required
              maxLength={200}
              value={draft.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Lekki home renovation"
            />
          </label>
          <label>
            Scope of work
            <Textarea
              required
              minLength={10}
              maxLength={4000}
              value={draft.scope}
              onChange={(e) => update("scope", e.target.value)}
              placeholder="What is included, and what is not?"
            />
          </label>
          <div className="form-grid">
            <label>
              Worker email
              <Input
                type="email"
                required
                value={draft.earner}
                onChange={(e) => update("earner", e.target.value)}
                placeholder="worker@example.com"
              />
            </label>
            <label>
              Verifier email (optional)
              <Input
                type="email"
                value={draft.verifier}
                onChange={(e) => update("verifier", e.target.value)}
                placeholder="verifier@example.com"
              />
            </label>
          </div>
          <label>
            Agreement expiry (your local time)
            <Input
              type="datetime-local"
              required
              value={new Date(
                Date.parse(draft.expiry) -
                  new Date(draft.expiry).getTimezoneOffset() * 60000,
              )
                .toISOString()
                .slice(0, 16)}
              onChange={(e) =>
                e.target.value &&
                update("expiry", new Date(e.target.value).toISOString())
              }
            />
          </label>
          <div className="section-title">
            <h3>Milestones</h3>
            <span className="muted">USD</span>
          </div>
          {draft.milestones.map((m, i) => (
            <section className="builder-milestone" key={i}>
              <div className="section-title">
                <span className="eyebrow">MILESTONE {i + 1}</span>
                {draft.milestones.length > 1 && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove milestone ${i + 1}`}
                    onClick={() =>
                      update(
                        "milestones",
                        draft.milestones.filter((_, index) => index !== i),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <label>
                Milestone title
                <Input
                  required
                  value={m.title}
                  onChange={(e) => milestone(i, "title", e.target.value)}
                />
              </label>
              <label>
                Acceptance criteria
                <Textarea
                  required
                  minLength={10}
                  value={m.criteria}
                  onChange={(e) => milestone(i, "criteria", e.target.value)}
                  placeholder="Use specific, observable completion criteria."
                />
              </label>
              <div className="form-grid">
                <label>
                  Worker allocation ($)
                  <Input
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    required
                    value={m.amount / 100}
                    onChange={(e) =>
                      milestone(
                        i,
                        "amount",
                        Math.round(Number(e.target.value) * 100),
                      )
                    }
                  />
                </label>
                <label>
                  Approved by
                  <Choice
                    label="Milestone approver"
                    value={m.approver}
                    onChange={(v) => milestone(i, "approver", v)}
                    items={[
                      { value: "verifier", label: "Agreed verifier" },
                      { value: "payer", label: "Payer (no verifier fee)" },
                    ]}
                  />
                </label>
              </div>
              {m.approver === "verifier" && (
                <label>
                  Verifier fee ($)
                  <Input
                    type="number"
                    min="0"
                    max="100000"
                    step="0.01"
                    required
                    value={m.fee / 100}
                    onChange={(e) =>
                      milestone(
                        i,
                        "fee",
                        Math.round(Number(e.target.value) * 100),
                      )
                    }
                  />
                </label>
              )}
            </section>
          ))}
          {draft.milestones.length < 12 && (
            <button
              type="button"
              className="secondary"
              onClick={() =>
                update("milestones", [
                  ...draft.milestones,
                  { ...initialMilestone },
                ])
              }
            >
              <Plus size={16} />
              Add milestone
            </button>
          )}
          <div className="notice">
            <ShieldCheck size={20} />
            <p>
              All participants must accept these fixed terms before funding.
              Fees are earned only on approval. Expiry returns unused reserves,
              never earned money.
            </p>
          </div>
          <div className="section-title">
            <span>Total commitment</span>
            <strong>
              {money(
                draft.milestones.reduce((s, m) => s + m.amount + m.fee, 0),
              )}
            </strong>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy} className="primary wide">
            {busy ? "Creating…" : "Create agreement"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
