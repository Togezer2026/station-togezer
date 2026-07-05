import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import EditForm, { type ExposantEdit } from "../EditForm";
import AccesReceptif from "../AccesReceptif";
import UserActions from "../../UserActions";

export const dynamic = "force-dynamic";

export default async function EditReceptif({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("exposants")
    .select("*, exposant_destinations(pays, continent), presences(jour, formule)")
    .eq("id", id)
    .single();

  if (!data) notFound();

  // Compte réceptif lié (pour réinitialisation / suppression)
  let compte: { id: string; email: string } | null = null;
  if (data.proprietaire_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", data.proprietaire_id)
      .single();
    if (p) compte = p as { id: string; email: string };
  }

  return (
    <div>
      <Link href="/admin/receptifs" className="font-corps text-sm text-encreDoux hover:text-encre">
        ← Réceptifs
      </Link>
      <h1 className="mb-6 mt-3 font-titre text-3xl font-600 text-encre">{data.nom}</h1>
      <div className="mt-6">
        <EditForm exposant={data as unknown as ExposantEdit} />
      </div>
      <div className="mt-8">
        <AccesReceptif
          exposantId={data.id}
          defaultEmail={data.email_contact ?? ""}
          hasAccess={!!data.proprietaire_id}
        />
      </div>
      {compte && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ligne bg-carte p-6 shadow-carte">
          <div>
            <p className="font-titre text-lg font-600 text-encre">Gérer le compte réceptif</p>
            <p className="font-corps text-sm text-encreDoux">Connecté avec : {compte.email}</p>
          </div>
          <UserActions userId={compte.id} email={compte.email} label={data.nom} />
        </div>
      )}
    </div>
  );
}
