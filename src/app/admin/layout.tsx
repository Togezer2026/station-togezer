import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import Deconnexion from "@/app/mon-espace/Deconnexion";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/receptifs", label: "Réceptifs" },
  { href: "/admin/agents", label: "Agents inscrits" },
  { href: "/admin/rendez-vous", label: "Rendez-vous" },
  { href: "/admin/planning", label: "Planning" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b border-ligne bg-carte">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-titre text-xl font-700 text-encre">
              Admin · <span className="text-brique">TogeZer</span>
            </Link>
            <nav className="hidden gap-4 sm:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="font-corps text-sm text-encreDoux hover:text-encre"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-corps text-sm text-encreDoux hover:text-encre"
            >
              Voir le site
            </Link>
            <Deconnexion />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
