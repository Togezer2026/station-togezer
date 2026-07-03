// Le logotype officiel « La Station TogeZer » — plaque émaillée avec le
// Z-pinceau signature. (L'ancienne version SVG texte est remplacée par l'asset.)

export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-togezer.png"
      alt="La Station TogeZer"
      width={677}
      height={369}
      className={className}
    />
  );
}
