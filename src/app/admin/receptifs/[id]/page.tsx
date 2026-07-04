import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import EditForm, { type ExposantEdit } from "../EditForm";
import AccesReceptif from "../AccesReceptif";

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
    </div>
  );
}
