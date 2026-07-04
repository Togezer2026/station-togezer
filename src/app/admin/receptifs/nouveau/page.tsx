import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import EditForm from "../EditForm";

export const dynamic = "force-dynamic";

export default async function NouveauReceptif() {
  await requireAdmin();
  return (
    <div>
      <Link href="/admin/receptifs" className="font-corps text-sm text-encreDoux hover:text-encre">
        ← Réceptifs
      </Link>
      <h1 className="mb-6 mt-3 font-titre text-3xl font-600 text-encre">Nouveau réceptif</h1>
      <EditForm exposant={null} />
    </div>
  );
}
