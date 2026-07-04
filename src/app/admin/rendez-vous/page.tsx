import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminRdv() {
  await requireAdmin();
  return (
    <div>
      <h1 className="font-titre text-3xl font-600 text-encre">Rendez-vous</h1>
      <p className="mt-2 max-w-xl font-corps text-encreDoux">
        La vue complète des rendez-vous (par jour, par réceptif, par agent, par
        créneau et par salle) arrivera avec le moteur de prise de rendez-vous.
        Elle inclura la supervision en temps réel et les exports.
      </p>
    </div>
  );
}
