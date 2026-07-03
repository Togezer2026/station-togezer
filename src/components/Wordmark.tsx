// Le logotype « La Station TogeZer ».
// Règle d'or : tout reste sobre (serif + encre), seul le Z pétille — un coup
// de pinceau multicolore (palette du Z) qui peut légèrement déborder du cadre.

export function ZBrush({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 86 100"
      className={className}
      role="img"
      aria-label="Z"
      style={{ height: "0.92em", width: "auto", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="z-brush" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A8432B" />
          <stop offset="0.4" stopColor="#C1902F" />
          <stop offset="0.72" stopColor="#47827E" />
          <stop offset="1" stopColor="#8E9B72" />
        </linearGradient>
      </defs>
      {/* coup de pinceau : barre haute légèrement arquée, diagonale, barre basse */}
      <path
        d="M12 23 Q43 14 73 19 L19 83 Q47 91 75 82"
        fill="none"
        stroke="url(#z-brush)"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Wordmark({
  className = "",
  eyebrow = true,
}: {
  className?: string;
  eyebrow?: boolean;
}) {
  return (
    <span className={`inline-flex flex-col font-titre leading-none ${className}`}>
      {eyebrow && (
        <span className="text-[0.26em] font-500 uppercase tracking-[0.34em] text-encreDoux">
          La Station
        </span>
      )}
      <span className="mt-[0.12em] inline-flex items-baseline font-600 text-encre">
        Toge
        <ZBrush className="mx-[0.01em] self-center" />
        er
      </span>
    </span>
  );
}
