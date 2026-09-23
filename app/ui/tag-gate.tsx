"use client";
import { createContext, useContext, useState } from "react";
import { AtSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWallet } from "../wallet-context";

/**
 * Sending money and funding a job both name the sender by their tag, not
 * their address. Rather than letting either action fail against a tag that
 * does not exist yet, this catches it up front — anywhere in the app — with
 * the same claim form the payment tag card itself uses.
 */

type TagGateState = {
  /** True if the active role already has a tag. False opens the claim modal
      and returns false, so the caller can stop whatever it was about to do. */
  requireTag: () => boolean;
};

const Context = createContext<TagGateState | null>(null);

export function TagGateProvider({ children }: { children: React.ReactNode }) {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requireTag = () => {
    // No wallet is a different, earlier problem than no tag — each screen's
    // own "sign in" gate already covers it, so this only ever fires once a
    // role is actually connected and still has no tag.
    if (!w.wallet || w.tags[w.role]) return true;
    setError("");
    setOpen(true);
    return false;
  };

  const claim = async () => {
    setBusy(true);
    setError("");
    try {
      await w.claimTag(tag, name || tag);
      setTag("");
      setName("");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not claim");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Context.Provider value={{ requireTag }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="builder-dialog">
          <DialogHeader>
            <DialogTitle>Claim a tag first.</DialogTitle>
            <DialogDescription>
              A tag replaces a long account address with a name people can
              pay or name in an agreement. Claiming signs a message with your{" "}
              {w.role} account, which is how the directory knows the tag is
              yours.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="error">{error}</p>}
          <div className="tag-claim">
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="bola"
              aria-label="Tag"
              spellCheck={false}
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bola the builder"
              aria-label="Display name"
            />
            <button
              className="primary"
              disabled={busy || tag.trim().length < 3}
              onClick={() => void claim()}
            >
              <AtSign size={15} />
              {busy ? "Claiming…" : "Claim"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}

export function useTagGate(): TagGateState {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useTagGate must be used within a TagGateProvider");
  return ctx;
}
