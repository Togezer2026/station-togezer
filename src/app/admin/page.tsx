import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const { supabase, profile } = await requireAdmin();

  const [{ count: nbReceptifs }, { count: nbAgents }, { count: nbRdv }] =
    await Promise.all([
      supabase.from("exposants").select("*", { count: "exact", head: true }),
      supabase.from("agents").select("*", { count: "exact", head: true }),
      supabase
        .from("engagements")
        .select("*", { count: "exact", head: true })
        .neq("statut", "annule"),
    ]);

  const cartes = [
    { href: "/admin/receptifs", label: "Réceptifs", val: nbReceptifs ?? 0, desc: "Créer, éditer, supprimer les fiches" },
    { href: "/admin/agents", label: "Agents inscrits", val: nbAgents ?? 0, desc: "Voir et gérer les agents" },
    { href: "/admin/rendez-vous", label: "Rendez-vous", val: nbRdv ?? 0, desc: "Vue complète, filtres, exports" },
  ];

  return (
    <div>
      <h1 className="font-titre text-4xl font-600 text-encre">
        Bonjour {profile.full_name || "admin"}
      </h1>
      <p className="mt-2 font-corps text-encreDoux">
        Vous avez la main sur tout. Choisissez une section.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {cartes.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-ligne bg-carte p-6 shadow-carte transition hover:border-brique/40"
          >
            <p className="font-titre text-4xl font-700 text-brique">{c.val}</p>
            <p className="mt-2 font-titre text-xl font-600 text-encre">{c.label}</p>
            <p className="mt-1 font-corps text-sm text-encreDoux">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
