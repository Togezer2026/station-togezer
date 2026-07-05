import Link from "next/link";
import Deconnexion from "@/app/mon-espace/Deconnexion";

// En-tête des espaces connectés (agent) : logo + navigation + déconnexion.
export default function AppHeader() {
  return (
    <header className="border-b border-ligne bg-carte/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/mon-espace" aria-label="La Station TogeZer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-togezer.png" alt="La Station TogeZer" className="h-11 w-auto" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/mon-espace"
            className="rounded-full px-3 py-1.5 font-corps text-sm text-encreDoux transition hover:bg-creme hover:text-encre"
          >
            Mon espace
          </Link>
          <Link
            href="/reservation"
            className="rounded-full px-3 py-1.5 font-corps text-sm text-encreDoux transition hover:bg-creme hover:text-encre"
          >
            Mes rendez-vous
          </Link>
          <Link
            href="/messages"
            className="rounded-full px-3 py-1.5 font-corps text-sm text-encreDoux transition hover:bg-creme hover:text-encre"
          >
            Messagerie
          </Link>
          <Link
            href="/annuaire"
            className="rounded-full px-3 py-1.5 font-corps text-sm text-encreDoux transition hover:bg-creme hover:text-encre"
          >
            Réceptifs
          </Link>
          <Deconnexion />
        </nav>
      </div>
    </header>
  );
}
