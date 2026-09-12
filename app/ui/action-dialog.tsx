"use client";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Action, Agreement, Role } from "@/lib/domain";
import { total, available } from "@/lib/domain";
import { money } from "./shared";
export type Intent = { type: Action["type"]; milestone?: number };
const names: Record<Action["type"], string> = {
  accept: "Accept agreement terms",
  fund: "Reserve funds for this work",
  submit: "Submit work for review",
  approve: "Approve completed work",
  changes: "Request changes",
  withdraw: "Withdraw your earnings",
  refund: "Return unused funds",
  cancel: "Consent to cancellation",
  correct: "Append an attestation correction",
};
export default function ActionDialog({
  agreement,
  role,
  intent,
  onClose,
  onAction,
}: {
  agreement: Agreement;
  role: Role;
  intent: Intent;
  onClose: () => void;
  onAction: (action: Action) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [operationId] = useState(() => crypto.randomUUID());
  // Files that already reached the server are remembered so retrying a failed
  // action resumes from the first unsent file instead of re-uploading all of
  // them. The server resolves duplicate content to one stored file as well.
  const uploaded = useRef(new Map<File, string>());
  const milestone =
    intent.milestone === undefined
      ? null
      : agreement.milestones[intent.milestone];
  const needNotes = ["submit", "changes", "correct"].includes(intent.type);
  const amount =
    intent.type === "fund"
      ? total(agreement)
      : intent.type === "approve" && milestone
        ? milestone.amount + milestone.fee
        : intent.type === "refund"
          ? agreement.reserved
          : intent.type === "withdraw" && role !== "payer"
            ? available(agreement, role)
            : 0;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ids: string[] = [];
      for (let index = 0; index < files.length; index++) {
        setProgress(`Uploading file ${index + 1} of ${files.length}…`);
        const known = uploaded.current.get(files[index]);
        if (known) {
          ids.push(known);
          continue;
        }
        const form = new FormData();
        form.set("file", files[index]);
        form.set("agreementId", agreement.id);
        const response = await fetch("/api/evidence", {
          method: "POST",
          body: form,
        });
        const data = (await response.json()) as { error: string; id: string };
        if (!response.ok) throw new Error(data.error);
        uploaded.current.set(files[index], data.id);
        ids.push(data.id);
      }
      setProgress("Saving action…");
      await onAction({
        ...intent,
        role,
        operationId,
        notes,
        files: ids,
        digest:
          intent.type === "approve"
            ? milestone?.evidence.at(-1)?.digest
            : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(value) => !value && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{names[intent.type]}</DialogTitle>
          <DialogDescription>
            {agreement.title}
            {milestone ? ` · ${milestone.title}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-stack">
          {amount > 0 && (
            <div className="confirmation-amount">
              {money(amount)}
              <small>Sandbox USD · no token transfer</small>
            </div>
          )}
          {intent.type === "accept" && (
            <p className="muted">
              You are accepting the displayed scope, allocations, approval
              authority, and expiry as the sandbox {role}. Participant names are
              demo identities, not invitations or bound wallets.
            </p>
          )}
          {intent.type === "fund" && (
            <p className="muted">
              This records simulated funding of every accepted milestone. No
              wallet is connected and no real money will move.
            </p>
          )}
          {intent.type === "approve" && milestone && (
            <div className="notice">
              <p>
                Worker earns {money(milestone.amount)} and verifier earns{" "}
                {money(milestone.fee)} together. This cannot be undone by
                cancellation, expiry, or a later correction. Review evidence v
                {milestone.evidence.length} before confirming.
              </p>
            </div>
          )}
          {intent.type === "withdraw" && (
            <p className="muted">
              Destination: your sandbox {role} account. This is a simulation,
              not a bank payout or blockchain transaction.
            </p>
          )}
          {intent.type === "refund" && (
            <p className="muted">
              Only unused reserves will return to the payer. Earned worker and
              verifier balances remain withdrawable.
            </p>
          )}
          {intent.type === "cancel" && (
            <p className="muted">
              Cancellation requires all required participants to consent.
              Existing earnings remain protected; unused reserve becomes
              refundable after the last consent.
            </p>
          )}
          {intent.type === "correct" && (
            <p className="muted">
              Corrections are appended to history. Original evidence and settled
              allocations remain unchanged.
            </p>
          )}
          {needNotes && (
            <label>
              {intent.type === "submit"
                ? "Evidence & completion notes"
                : "Your explanation"}
              <Textarea
                required
                minLength={1}
                maxLength={6000}
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  intent.type === "submit"
                    ? "Explain how the work meets each accepted criterion."
                    : "Describe the requested change or correction."
                }
              />
            </label>
          )}
          {intent.type === "submit" && (
            <>
              <label>
                Supporting files (optional)
                <Input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,application/pdf,text/plain"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    if (selected.length > 5) {
                      setError("Choose up to five files.");
                      e.target.value = "";
                      return;
                    }
                    setFiles(selected);
                  }}
                />
              </label>
              <p className="fine-print">
                Up to 5 files, 10 MB each. Private to this signed-in sandbox
                workspace. Use synthetic or consented material; files are
                retained for the prototype’s lifetime. Downloads are not
                malware-scanned.
              </p>
            </>
          )}
          <label className="check-label">
            <input required type="checkbox" />I reviewed this action and
            understand this is a sandbox.
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary wide" disabled={busy}>
            {busy ? progress : "Confirm " + intent.type}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
