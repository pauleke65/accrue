"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { network, escrow, token, shortAddress } from "@/lib/chain";

/**
 * Which network the money is on, stated in the chrome rather than buried.
 *
 * Mainnet is listed and deliberately not selectable. The escrow has had no
 * independent audit and is deployed only to the test network, so offering a
 * switch that moved real money would be offering something that should not be
 * used. Showing it locked, with the reason, is more honest than hiding it and
 * leaving people to guess whether this is real.
 */

const options = [
  {
    id: "testnet",
    name: "Monad Testnet",
    detail: "Test money. Safe to experiment with.",
    available: true,
  },
  {
    id: "mainnet",
    name: "Monad Mainnet",
    detail: "Not enabled: the escrow is unaudited and testnet-only.",
    available: false,
  },
] as const;

export function NetworkSwitch() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="network-switch" ref={box}>
      <button
        className="network-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="network-dot" aria-hidden="true" />
        {network.name}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="network-menu" role="listbox">
          {options.map((option) => (
            <div
              key={option.id}
              role="option"
              aria-selected={option.available}
              aria-disabled={!option.available}
              className={`network-option ${option.available ? "is-active" : "is-locked"}`}
            >
              <div className="network-option-head">
                {option.available ? <Check size={14} /> : <Lock size={13} />}
                <b>{option.name}</b>
              </div>
              <p>{option.detail}</p>
            </div>
          ))}
          <div className="network-facts">
            <div>
              <span>Chain</span>
              <b>{network.chainId}</b>
            </div>
            <div>
              <span>{token.symbol}</span>
              <b>{shortAddress(token.address)}</b>
            </div>
            <div>
              <span>Escrow</span>
              <b>{shortAddress(escrow.address)}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
