// Inline SVG illustrations for the landing page. Colours come from classes in
// globals.css (.ill-*) so they follow the Metropolis tokens; text inside the
// drawings is decorative and each figure carries its own aria-label.

type Props = { className?: string };

/** Client money into the contract, then out to worker, reviewers, or back. */
export function EscrowVault({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 560 300" role="img" aria-label="The client deposits into the escrow contract, which pays the worker and reviewers on approval and returns unearned money to the client">
      <defs>
        <marker id="ill-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 8 4 0 8z" className="ill-fill-ink" />
        </marker>
        <pattern id="ill-grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" className="ill-grid" fill="none" />
        </pattern>
      </defs>

      {/* client */}
      <g transform="translate(20 110)">
        <rect width="104" height="80" className="ill-box" />
        <circle cx="52" cy="30" r="11" className="ill-stroke-ink" fill="none" />
        <path d="M30 62c4-12 14-17 22-17s18 5 22 17" className="ill-stroke-ink" fill="none" />
        <text x="52" y="-10" className="ill-label" textAnchor="middle">CLIENT</text>
      </g>

      {/* deposit */}
      <path d="M128 150H206" className="ill-flow" markerEnd="url(#ill-arrow)" />
      <text x="167" y="140" className="ill-small" textAnchor="middle">FUND</text>

      {/* vault */}
      <g transform="translate(212 60)">
        <rect width="136" height="180" fill="url(#ill-grid)" className="ill-vault" />
        <rect x="18" y="22" width="100" height="100" className="ill-vault-door" />
        <circle cx="68" cy="72" r="26" className="ill-stroke-accent" fill="none" />
        <circle cx="68" cy="72" r="6" className="ill-fill-accent" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line key={a} x1="68" y1="46" x2="68" y2="52" className="ill-stroke-accent" transform={`rotate(${a} 68 72)`} />
        ))}
        <rect x="30" y="140" width="76" height="8" className="ill-fill-accent" />
        <rect x="30" y="140" width="46" height="8" className="ill-fill-positive" />
        <text x="68" y="170" className="ill-small" textAnchor="middle">AUSD LOCKED</text>
        <text x="68" y="-10" className="ill-label" textAnchor="middle">CONTRACT</text>
      </g>

      {/* worker */}
      <path d="M352 110C390 110 392 70 426 70" className="ill-flow ill-flow-positive" markerEnd="url(#ill-arrow)" />
      <g transform="translate(432 36)">
        <rect width="108" height="64" className="ill-box" />
        <path d="M20 22h20M20 32h34M20 42h26" className="ill-stroke-dim" />
        <path d="M70 26l6 6 12-12" className="ill-stroke-positive" fill="none" strokeWidth="2.5" />
        <text x="54" y="82" className="ill-label" textAnchor="middle">WORKER</text>
      </g>

      {/* reviewers */}
      <path d="M352 150H426" className="ill-flow ill-flow-positive" markerEnd="url(#ill-arrow)" />
      <g transform="translate(432 122)">
        <rect width="108" height="56" className="ill-box" />
        {[26, 54, 82].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy="28" r="10" className={i < 2 ? "ill-fill-positive-soft ill-stroke-positive" : "ill-stroke-dim"} fill={i < 2 ? undefined : "none"} />
          </g>
        ))}
        <text x="54" y="74" className="ill-label" textAnchor="middle">REVIEWERS</text>
      </g>

      {/* refund */}
      <path d="M352 200C400 200 400 262 300 262H80V194" className="ill-flow ill-flow-dashed" markerEnd="url(#ill-arrow)" />
      <text x="230" y="284" className="ill-small" textAnchor="middle">UNEARNED RETURNS TO CLIENT</text>
      <text x="440" y="222" className="ill-small">ON APPROVAL</text>
    </svg>
  );
}

/** Milestone escrow: a project cut into stages, each released on approval. */
export function MilestoneTrack({ className }: Props) {
  const stages = [
    { label: "WIREFRAMES", state: "paid" },
    { label: "BUILD", state: "paid" },
    { label: "LAUNCH", state: "review" },
    { label: "HANDOVER", state: "locked" },
  ] as const;
  return (
    <svg className={className} viewBox="0 0 480 230" role="img" aria-label="A four-milestone project: two milestones paid, one in review, one still locked in escrow">
      <text x="20" y="28" className="ill-label">PROJECT / 4 MILESTONES</text>
      <line x1="56" y1="92" x2="424" y2="92" className="ill-stroke-dim" />
      <line x1="56" y1="92" x2="178.67" y2="92" className="ill-stroke-positive" strokeWidth="3" />
      {stages.map((s, i) => {
        const x = 56 + i * 122.67;
        return (
          <g key={s.label} transform={`translate(${x} 92)`}>
            {s.state === "paid" && <>
              <rect x="-15" y="-15" width="30" height="30" className="ill-fill-positive-soft ill-stroke-positive" />
              <path d="M-7 0l5 5 9-10" className="ill-stroke-positive" fill="none" strokeWidth="2.5" />
            </>}
            {s.state === "review" && <>
              <rect x="-15" y="-15" width="30" height="30" className="ill-fill-caution-soft ill-stroke-caution" />
              <circle cx="0" cy="0" r="6" className="ill-stroke-caution" fill="none" />
              <line x1="4" y1="4" x2="9" y2="9" className="ill-stroke-caution" strokeWidth="2" />
            </>}
            {s.state === "locked" && <>
              <rect x="-15" y="-15" width="30" height="30" className="ill-box" />
              <rect x="-6" y="-2" width="12" height="9" className="ill-stroke-dim" fill="none" />
              <path d="M-4-2v-4a4 4 0 0 1 8 0v4" className="ill-stroke-dim" fill="none" />
            </>}
            <text y="40" className="ill-small" textAnchor="middle">{s.label}</text>
            <text y="56" className="ill-small ill-dim" textAnchor="middle">{s.state === "paid" ? "RELEASED" : s.state === "review" ? "IN REVIEW" : "LOCKED"}</text>
          </g>
        );
      })}
      <g transform="translate(20 180)">
        <rect width="440" height="12" className="ill-fill-muted" />
        <rect width="220" height="12" className="ill-fill-positive" />
        <text y="32" className="ill-small">EARNED BY WORKER + REVIEWER</text>
        <text x="440" y="32" className="ill-small" textAnchor="end">STILL IN ESCROW</text>
      </g>
    </svg>
  );
}

/** Proof-checked job: evidence, hard checks, AI confidence, then 2-of-3 votes. */
export function ProofPipeline({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 480 230" role="img" aria-label="Evidence passes hard checks, the AI scores confidence against pass and fail thresholds, and two of three reviewer votes release payment">
      <text x="20" y="28" className="ill-label">ONE DELIVERABLE / 3 REVIEWERS</text>

      {/* evidence */}
      <g transform="translate(20 52)">
        <rect width="86" height="92" className="ill-box" />
        <path d="M16 20h40M16 32h54M16 44h30" className="ill-stroke-dim" />
        <circle cx="24" cy="70" r="5" className="ill-stroke-accent" fill="none" />
        <path d="M29 70h28" className="ill-stroke-accent" />
        <circle cx="62" cy="70" r="5" className="ill-stroke-accent" fill="none" />
        <text x="43" y="112" className="ill-small" textAnchor="middle">EVIDENCE</text>
      </g>

      {/* checks */}
      <g transform="translate(130 52)">
        {["COMMIT", "API", "JSON"].map((c, i) => (
          <g key={c} transform={`translate(0 ${i * 32})`}>
            <rect width="92" height="24" className="ill-box" />
            <path d="M10 12l4 4 8-8" className="ill-stroke-positive" fill="none" strokeWidth="2" />
            <text x="32" y="16" className="ill-small">{c}</text>
          </g>
        ))}
      </g>

      {/* AI confidence gauge with thresholds */}
      <g transform="translate(246 52)">
        <rect width="100" height="92" className="ill-box" />
        <text x="50" y="18" className="ill-small" textAnchor="middle">AI SCORE</text>
        <rect x="12" y="36" width="76" height="10" className="ill-fill-muted" />
        <rect x="12" y="36" width="8" height="10" className="ill-fill-negative" />
        <rect x="80" y="36" width="8" height="10" className="ill-fill-positive" />
        <line x1="83" y1="30" x2="83" y2="52" className="ill-stroke-ink" strokeWidth="2" />
        <text x="12" y="66" className="ill-small ill-dim">FAIL</text>
        <text x="88" y="66" className="ill-small ill-dim" textAnchor="end">PASS</text>
        <text x="50" y="84" className="ill-small" textAnchor="middle">ELSE: HUMANS</text>
      </g>

      {/* votes */}
      <g transform="translate(370 52)">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(0 ${i * 32})`}>
            <rect width="90" height="24" className={i < 2 ? "ill-fill-positive-soft ill-stroke-positive" : "ill-box"} />
            <text x="10" y="16" className="ill-small">{i === 0 ? "ENGINE" : `REVIEWER ${i}`}</text>
          </g>
        ))}
      </g>

      <path d="M106 98h20M222 98h20M346 98h20" className="ill-stroke-dim" />
      <g transform="translate(20 180)">
        <rect width="440" height="12" className="ill-fill-positive" />
        <text y="32" className="ill-small">2 OF 3 PASS: WORKER PAID IN FULL</text>
        <text x="440" y="32" className="ill-small" textAnchor="end">EACH VOTER: 1/3 OF FEES</text>
      </g>
    </svg>
  );
}

/** Small glyphs for the four steps. */
export function StepGlyph({ step }: { step: number }) {
  return (
    <svg className="lp-step-glyph" viewBox="0 0 64 64" aria-hidden>
      {step === 0 && <>
        <rect x="12" y="8" width="34" height="44" className="ill-box" />
        <path d="M19 18h20M19 26h20M19 34h12" className="ill-stroke-dim" />
        <rect x="34" y="36" width="20" height="16" className="ill-fill-accent" />
        <path d="M38 36v-5a6 6 0 0 1 12 0v5" className="ill-stroke-accent" fill="none" strokeWidth="2.5" />
      </>}
      {step === 1 && <>
        <rect x="10" y="22" width="44" height="34" className="ill-box" />
        <circle cx="32" cy="39" r="8" className="ill-stroke-accent" fill="none" strokeWidth="2" />
        <rect x="26" y="4" width="12" height="12" className="ill-fill-positive" />
        <path d="M32 16v6" className="ill-stroke-positive" strokeWidth="2" />
      </>}
      {step === 2 && <>
        <circle cx="16" cy="32" r="6" className="ill-stroke-accent" fill="none" strokeWidth="2" />
        <circle cx="48" cy="16" r="6" className="ill-stroke-accent" fill="none" strokeWidth="2" />
        <circle cx="48" cy="48" r="6" className="ill-fill-accent" />
        <path d="M22 32h8l12-14M30 32l12 14" className="ill-stroke-accent" fill="none" strokeWidth="2" />
      </>}
      {step === 3 && <>
        <path d="M32 6l6 5 8-1 2 8 7 4-3 7 3 7-7 4-2 8-8-1-6 5-6-5-8 1-2-8-7-4 3-7-3-7 7-4 2-8 8 1z" className="ill-fill-positive-soft ill-stroke-positive" />
        <path d="M23 32l6 6 12-12" className="ill-stroke-positive" fill="none" strokeWidth="3" />
      </>}
    </svg>
  );
}
