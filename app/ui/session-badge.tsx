"use client";
import { useEffect, useState } from "react";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { useWallet } from "../wallet-context";
import { SESSION_MINUTES } from "@/lib/mera-account";

/**
 * What the signing session covers, and how long it has left.
 *
 * A prompt-free session is a real grant: for its duration this page can sign
 * without asking again. Leaving that invisible would make the app feel
 * effortless by hiding something the person should be able to see. So the
 * badge states the scope in words, counts down, and warns before it lapses —
 * and when it does lapse it says so plainly rather than letting the next
 * action fail for no visible reason.
 */
export function SessionBadge() {
  const w = useWallet();
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!w.wallet) return;
    const tick = () =>
      setRemaining(Math.max(0, w.wallet!.expiresAt - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [w.wallet]);

  if (!w.wallet) return null;

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const expired = remaining <= 0;
  const ending = !expired && remaining < 2 * 60_000;

  return (
    <div
      className={`session-badge ${expired ? "is-expired" : ending ? "is-ending" : ""}`}
    >
      <span className="session-head">
        {expired ? <Fingerprint size={13} /> : <ShieldCheck size={13} />}
        {expired
          ? "Session ended"
          : `${minutes}:${String(seconds).padStart(2, "0")} left`}
      </span>
      <p>
        {expired ? (
          <>
            Your keys were discarded. The next action asks for your passkey
            again.
          </>
        ) : (
          <>
            Signing without prompting, on this device, for payments and
            agreements from your own accounts. Lasts {SESSION_MINUTES} minutes,
            then the keys are discarded.
          </>
        )}
      </p>
      {expired && (
        <button className="text-button" onClick={() => void w.connect("open")}>
          Unlock again
        </button>
      )}
    </div>
  );
}
