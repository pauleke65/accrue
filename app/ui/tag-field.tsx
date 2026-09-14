"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWallet } from "../wallet-context";
import { shortAddress } from "@/lib/chain";

/**
 * A tag input that says who it found.
 *
 * Naming the wrong person is the expensive mistake in this product: the money
 * follows the tag, and a transfer cannot be undone. So the field resolves as
 * it is typed and shows the display name and address it landed on, giving the
 * payer a chance to notice before they commit rather than after.
 */
export function TagField({
  label,
  value,
  onChange,
  onResolved,
  placeholder = "@bola",
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onResolved?: (
    found: { address: `0x${string}`; displayName: string } | null,
  ) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  const w = useWallet();
  const [state, setState] = useState<
    | { kind: "empty" }
    | { kind: "looking" }
    | { kind: "found"; displayName: string; address: `0x${string}` }
    | { kind: "missing" }
  >({ kind: "empty" });

  const tag = value.trim().replace(/^@/, "").toLowerCase();

  useEffect(() => {
    if (tag.length < 3) {
      setState({ kind: "empty" });
      onResolved?.(null);
      return;
    }
    let cancelled = false;
    setState({ kind: "looking" });
    // Waiting out the typing keeps this from asking on every keystroke.
    const timer = window.setTimeout(async () => {
      const found = await w.resolveTag(tag);
      if (cancelled) return;
      if (found) {
        setState({
          kind: "found",
          displayName: found.displayName,
          address: found.address,
        });
        onResolved?.(found);
      } else {
        setState({ kind: "missing" });
        onResolved?.(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Resolution depends on the tag alone; the callback identity must not retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  return (
    <label className="tag-field">
      {label}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        aria-describedby={`${label}-resolution`}
      />
      {/* Always rendered so the row does not jump as the answer arrives. */}
      <span
        id={`${label}-resolution`}
        className={`tag-resolution is-${state.kind}`}
        role="status"
        aria-live="polite"
      >
        {state.kind === "looking" && (
          <>
            <Loader2 size={13} className="spin" /> Looking…
          </>
        )}
        {state.kind === "found" && (
          <>
            <Check size={13} /> {state.displayName} ·{" "}
            {shortAddress(state.address)}
          </>
        )}
        {state.kind === "missing" && (
          <>
            <UserX size={13} /> Nobody here goes by @{tag} yet.
          </>
        )}
        {state.kind === "empty" && (optional ? "Leave blank for none." : " ")}
      </span>
    </label>
  );
}
