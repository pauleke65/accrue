"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Zap } from "lucide-react";
import { explorer, SETTLED_EVENT } from "@/lib/chain";

type Settled = { hash: `0x${string}`; ms: number };

const seconds = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/**
 * "Confirmed on Monad in 0.8 s": every transaction this page sends reports
 * the time from submission to receipt. Speed is the reason this runs on
 * Monad, so it is shown as it happens, with a running average for the
 * session and a link to check the transaction.
 */
export function SettledToast() {
  const [last, setLast] = useState<Settled | null>(null);
  const [stats, setStats] = useState({ count: 0, total: 0 });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onSettled = (event: Event) => {
      const detail = (event as CustomEvent<Settled>).detail;
      setLast(detail);
      setStats((s) => ({ count: s.count + 1, total: s.total + detail.ms }));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLast(null), 7000);
    };
    window.addEventListener(SETTLED_EVENT, onSettled);
    return () => { window.removeEventListener(SETTLED_EVENT, onSettled); window.clearTimeout(timer.current); };
  }, []);

  return (
    <div className="settled-toast-region" aria-live="polite">
      {last && (
        <div className="settled-toast">
          <Zap size={16} aria-hidden />
          <div>
            <b>Confirmed on Monad in {seconds(last.ms)}</b>
            {stats.count > 1 && <span>{stats.count} transactions this session, {seconds(Math.round(stats.total / stats.count))} on average</span>}
          </div>
          <a href={explorer.tx(last.hash)} target="_blank" rel="noreferrer noopener" aria-label="View this transaction on the Monad explorer">
            View <ArrowUpRight size={13} aria-hidden />
          </a>
        </div>
      )}
    </div>
  );
}
