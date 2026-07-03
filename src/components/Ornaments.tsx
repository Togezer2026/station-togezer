// Iconographie fine au trait — un seul détail par composition, jamais lourde.

export function HorlogeQuai({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      {/* horloge de quai suspendue */}
      <path d="M24 4v4" />
      <circle cx="24" cy="24" r="15" />
      <circle cx="24" cy="24" r="1" fill="currentColor" stroke="none" />
      <path d="M24 15v9l6 4" />
    </svg>
  );
}

export function FiletRail({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 12"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden
      preserveAspectRatio="none"
    >
      {/* rail unique + traverses */}
      <line x1="0" y1="4" x2="200" y2="4" />
      <line x1="0" y1="8" x2="200" y2="8" />
      {Array.from({ length: 13 }).map((_, i) => (
        <line key={i} x1={8 + i * 16} y1="2" x2={8 + i * 16} y2="10" />
      ))}
    </svg>
  );
}

// Séparateur « panneau émaillé » : filet double avec un petit repère central.
export function FiletGare({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 text-ligne ${className}`}>
      <span className="h-px flex-1 bg-ligne" />
      <span className="block h-1.5 w-1.5 rotate-45 border border-ligne" />
      <span className="h-px flex-1 bg-ligne" />
    </div>
  );
}
