"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JOURS } from "@/lib/jours";

const CONTINENTS = ["Afrique", "Amériques", "Asie", "Europe", "Océanie", "Autre"];
const FORMULES = [
  { v: "absent", l: "Absent" },
  { v: "petits_dej", l: "Petits-Déj (9h–13h)" },
  { v: "biz_biz", l: "BiZ-BiZ (9h–14h)" },
  { v: "journee", l: "Journée (9h–18h)" },
];

const JOUR_NOM: Record<string, string> = {
  "2026-09-15": "Mardi 15",
  "2026-09-16": "Mercredi 16",
  "2026-09-17": "Jeudi 17",
};

export type ExposantEdit = {
  id: string;
  slug: string;
  nom: string;
  pays_principal: string;
  continent_principal: string;
  description: string | null;
  logo_path: string | null;
  email_contact: string | null;
  contact_nom: string | null;
  whatsapp: string | null;
  nb_personnes: number | null;
  notes: string | null;
  representant: string | null;
  exposant_destinations: { pays: string; continent: string }[];
  presences: { jour: string; formule: string }[];
};

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export default function EditForm({ exposant }: { exposant: ExposantEdit | null }) {
  const router = useRouter();
  const isNew = !exposant;
  const [f, setF] = useState({
    nom: exposant?.nom ?? "",
    pays_principal: exposant?.pays_principal ?? "",
    continent_principal: exposant?.continent_principal ?? "Afrique",
    description: exposant?.description ?? "",
    logo_path: exposant?.logo_path ?? "",
    email_contact: exposant?.email_contact ?? "martin@togezer.travel",
    contact_nom: exposant?.contact_nom ?? "",
    whatsapp: exposant?.whatsapp ?? "",
    nb_personnes: exposant?.nb_personnes?.toString() ?? "",
    notes: exposant?.notes ?? "",
    representant: exposant?.representant ?? "",
  });
  const [dests, setDests] = useState<{ pays: string; continent: string }[]>(
    exposant?.exposant_destinations ?? [],
  );
  const [pres, setPres] = useState<Record<string, string>>(
    Object.fromEntries(
      JOURS.map((j) => [j.iso, exposant?.presences.find((p) => p.jour === j.iso)?.formule ?? "absent"]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    const supabase = createClient();

    const payload = {
      nom: f.nom.trim(),
      pays_principal: f.pays_principal.trim(),
      continent_principal: f.continent_principal,
      description: f.description.trim() || null,
      logo_path: f.logo_path.trim() || null,
      email_contact: f.email_contact.trim() || null,
      contact_nom: f.contact_nom.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      nb_personnes: f.nb_personnes ? parseInt(f.nb_personnes, 10) : null,
      notes: f.notes.trim() || null,
      representant: f.representant.trim() || null,
    };

    let id = exposant?.id;
    if (isNew) {
      const { data, error } = await supabase
        .from("exposants")
        .insert({ ...payload, slug: slugify(f.nom) + "-" + Math.floor(Date.now() / 1000) })
        .select("id")
        .single();
      if (error) { setErreur(error.message); setBusy(false); return; }
      id = data.id;
    } else {
      const { error } = await supabase.from("exposants").update(payload).eq("id", id!);
      if (error) { setErreur(error.message); setBusy(false); return; }
    }

    // Destinations secondaires : on remplace
    await supabase.from("exposant_destinations").delete().eq("exposant_id", id!);
    const cleanDests = dests.filter((d) => d.pays.trim());
    if (cleanDests.length) {
      await supabase.from("exposant_destinations").insert(
        cleanDests.map((d) => ({ exposant_id: id!, pays: d.pays.trim(), continent: d.continent })),
      );
    }

    // Présences : on remplace (seules les non-absent sont stockées)
    await supabase.from("presences").delete().eq("exposant_id", id!);
    const rows = JOURS.filter((j) => pres[j.iso] !== "absent").map((j) => ({
      exposant_id: id!,
      jour: j.iso,
      formule: pres[j.iso],
    }));
    if (rows.length) await supabase.from("presences").insert(rows);

    setBusy(false);
    router.push("/admin/receptifs");
    router.refresh();
  }

  async function remove() {
    if (!exposant) return;
    if (!confirm(`Supprimer définitivement « ${exposant.nom} » et tous ses rendez-vous ?`)) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("exposants").delete().eq("id", exposant.id);
    if (error) { setErreur(error.message); setBusy(false); return; }
    router.push("/admin/receptifs");
    router.refresh();
  }

  const champ = "w-full rounded-lg border border-encre/20 bg-white px-3 py-2 font-corps text-sm outline-none focus:border-brique";
  const lbl = "mb-1 block font-corps text-xs font-600 uppercase tracking-wide text-encreDoux";

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={lbl}>Nom du réceptif</span>
            <input className={champ} value={f.nom} onChange={set("nom")} required /></label>
          <label><span className={lbl}>Destination principale</span>
            <input className={champ} value={f.pays_principal} onChange={set("pays_principal")} required /></label>
          <label><span className={lbl}>Continent principal</span>
            <select className={champ} value={f.continent_principal} onChange={set("continent_principal")}>
              {CONTINENTS.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="sm:col-span-2"><span className={lbl}>Description</span>
            <textarea className={champ} rows={2} value={f.description} onChange={set("description")} /></label>
          <label><span className={lbl}>Contact (nom)</span>
            <input className={champ} value={f.contact_nom} onChange={set("contact_nom")} /></label>
          <label><span className={lbl}>WhatsApp</span>
            <input className={champ} value={f.whatsapp} onChange={set("whatsapp")} /></label>
          <label><span className={lbl}>E-mail de contact</span>
            <input className={champ} value={f.email_contact} onChange={set("email_contact")} /></label>
          <label><span className={lbl}>Nb de personnes</span>
            <input className={champ} type="number" value={f.nb_personnes} onChange={set("nb_personnes")} /></label>
          <label><span className={lbl}>Représentant (regroupement)</span>
            <input className={champ} value={f.representant} onChange={set("representant")} placeholder="ex. Mathilde Quéva" /></label>
          <label><span className={lbl}>Logo (chemin)</span>
            <input className={champ} value={f.logo_path} onChange={set("logo_path")} placeholder="/logos/xxx.svg" /></label>
          <label className="sm:col-span-2"><span className={lbl}>Notes internes</span>
            <textarea className={champ} rows={2} value={f.notes} onChange={set("notes")} /></label>
        </div>
      </div>

      {/* Destinations secondaires */}
      <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
        <div className="flex items-center justify-between">
          <h2 className="font-titre text-lg font-600 text-encre">Destinations secondaires</h2>
          <button type="button" onClick={() => setDests((d) => [...d, { pays: "", continent: f.continent_principal }])}
            className="rounded-full border border-encre/20 px-3 py-1 text-sm text-encre hover:bg-creme">+ Ajouter</button>
        </div>
        <div className="mt-4 space-y-2">
          {dests.length === 0 && <p className="font-corps text-sm text-encreDoux">Aucune.</p>}
          {dests.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input className={champ} value={d.pays} placeholder="Pays" onChange={(e) => setDests((arr) => arr.map((x, j) => j === i ? { ...x, pays: e.target.value } : x))} />
              <select className={champ + " max-w-[180px]"} value={d.continent} onChange={(e) => setDests((arr) => arr.map((x, j) => j === i ? { ...x, continent: e.target.value } : x))}>
                {CONTINENTS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button type="button" onClick={() => setDests((arr) => arr.filter((_, j) => j !== i))}
                className="rounded-lg border border-encre/20 px-3 text-encreDoux hover:bg-creme">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Présence par jour */}
      <div className="rounded-xl border border-ligne bg-carte p-6 shadow-carte">
        <h2 className="font-titre text-lg font-600 text-encre">Présence &amp; formule par jour</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {JOURS.map((j) => (
            <label key={j.iso}><span className={lbl}>{JOUR_NOM[j.iso]}</span>
              <select className={champ} value={pres[j.iso]} onChange={(e) => setPres((p) => ({ ...p, [j.iso]: e.target.value }))}>
                {FORMULES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
              </select></label>
          ))}
        </div>
      </div>

      {erreur && <p className="font-corps text-sm text-red-600">{erreur}</p>}

      <div className="flex items-center justify-between">
        <button type="submit" disabled={busy}
          className="rounded-full bg-brique px-8 py-3 font-corps font-600 text-creme hover:bg-briqueFonce disabled:opacity-50">
          {busy ? "Enregistrement…" : isNew ? "Créer le réceptif" : "Enregistrer"}
        </button>
        {!isNew && (
          <button type="button" onClick={remove} disabled={busy}
            className="font-corps text-sm text-red-600 underline underline-offset-2">
            Supprimer ce réceptif
          </button>
        )}
      </div>
    </form>
  );
}
