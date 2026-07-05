import { redirect } from "next/navigation";
import { espaceUtilisateur } from "@/lib/espace";
import ConnexionForm from "./ConnexionForm";

export const dynamic = "force-dynamic";

export default async function ConnexionPage() {
  const dest = await espaceUtilisateur();
  if (dest) redirect(dest);
  return <ConnexionForm />;
}
