"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { offerUrl } from "../use-offers";

/** Shown once a hiring link exists: the link, a copy button, what happens next. */
export function HiringLinkDone({ token, onDone }: { token: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = offerUrl(token);
  return (
    <section className="hiring-link-done" aria-live="polite">
      <span className="hiring-link-icon" aria-hidden><Link2 size={22} /></span>
      <h1>Your hiring link is ready.</h1>
      <p className="muted">
        Send it to the person you want to hire, or post it where they will see it. Whoever takes it
        first becomes the worker. You then create the job for them from Home, and money only moves
        when you fund it.
      </p>
      <div className="hiring-link-copy">
        <code>{url}</code>
        <button className="primary" onClick={() => { void navigator.clipboard.writeText(url).then(() => setCopied(true)); }}>
          {copied ? <><Check size={15} aria-hidden /> Copied</> : <><Copy size={15} aria-hidden /> Copy link</>}
        </button>
      </div>
      <button className="text-button" onClick={onDone}>Back to jobs</button>
    </section>
  );
}
