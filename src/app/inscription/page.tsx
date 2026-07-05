import { redirect } from "next/navigation";
import { espaceUtilisateur } from "@/lib/espace";
import InscriptionForm from "./InscriptionForm";

export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const dest = await espaceUtilisateur();
  if (dest) redirect(dest);
  return <InscriptionForm />;
}
