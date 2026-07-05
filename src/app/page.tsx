import Link from "next/link";
import { redirect } from "next/navigation";
import Wordmark from "@/components/Wordmark";
import { FiletGare } from "@/components/Ornaments";
import GalerieVoie15 from "@/components/GalerieVoie15";
import { espaceUtilisateur } from "@/lib/espace";

export const dynamic = "force-dynamic";

const MAPS_URL = "https://maps.app.goo.gl/u6fRgKjAh7WwCScH9";

const PROGRAMME = [
  {
    h: "09h00 – 13h00",
    t: "Les Petits-Dejs TogeZer",
    d: "Nos fameux rendez-vous en tête-à-tête de 20 minutes, toute la matinée de 9h00 à 13h00.",
  },
  {
    h: "13h00 – 14h00",
    t: "Dejs Biz Biz",
    d: "Une heure de déjeuner dans une ambiance conviviale, avec un ou plusieurs réceptifs — assis ou debout, c'est vous qui décidez.",
  },
  {
    h: "14h00 – 18h00",
    t: "Les Z'aprems",
    d: "Des formations d'une heure par destination, et des rendez-vous en tête-à-tête avec les réceptifs.",
  },
];

const IMAGES_VOIE15 = ["voie15-salle.png", "voie15-terrasse.png", "voie15-acces.png"];

const ETAPES = [
  {
    n: "1",
    titre: "Je m'inscris",
    desc: "Je crée mon accès en une minute — c'est gratuit.",
  },
  {
    n: "2",
    titre: "Je prends mes rendez-vous",
    desc: "Je choisis mes jours de venue, puis mes rendez-vous avec les réceptifs. Je reviens autant de fois que je veux pour ajuster mon programme.",
  },
];

export default async function Home() {
  // Déjà connecté ? On reste dans l'espace connecté, jamais sur l'accueil public.
  const dest = await espaceUtilisateur();
  if (dest) redirect(dest);

  return (
    <main className="min-h-screen">
      {/* En-tête — logo cliquable (retour accueil) */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-8">
        <Link href="/" aria-label="Accueil La Station TogeZer">
          <Wordmark className="h-auto w-[175px]" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href="/annuaire"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden font-corps text-sm text-encreDoux underline-offset-4 hover:text-encre hover:underline sm:inline"
          >
            Voir la liste des réceptifs participants
          </a>
          <Link
            href="/connexion"
            className="rounded-full border border-encre/25 px-5 py-2 font-corps text-sm font-500 text-encre transition hover:bg-encre/5"
          >
            <span className="hidden text-encreDoux sm:inline">Vous avez déjà un compte&nbsp;? </span>
            <span className="font-600">Se connecter</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-12 pt-12 text-center sm:pt-16">
        <h1 className="font-titre text-4xl font-600 uppercase leading-[1.1] tracking-wide text-encre sm:text-5xl">
          Bienvenue à bord de la station des réceptifs&nbsp;!
        </h1>

        <p className="mx-auto mt-7 max-w-xl font-corps text-lg leading-relaxed text-encreDoux">
          <span className="mb-1 block font-600 text-encre">Chers Agents de Voyages,</span>
          La Station TogeZer réunit pour la première fois tous nos formats phares en
          un seul événement&nbsp;: Petits-Déjeuners, déjeuners de réseautage et
          après-midis de rendez-vous, rythmés par des formations dédiées à chaque
          destination.
          <span className="mt-2 block">
            Trois jours pour rencontrer nos réceptifs, découvrir des nouveautés et
            repartir avec des projets concrets.
          </span>
        </p>

        {/* Appel à l'action + gratuité (remonté) */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/inscription"
              className="rounded-full bg-brique px-8 py-3 font-corps font-600 tracking-wide text-creme shadow-carte transition hover:bg-briqueFonce"
            >
              Je m'inscris en tant qu'agent de voyages
            </Link>
            <Link
              href="/connexion"
              className="rounded-full border border-encre/20 px-8 py-3 font-corps font-500 tracking-wide text-encre transition hover:bg-encre/5"
            >
              J'ai déjà un compte, je me connecte
            </Link>
          </div>
          <a
            href="/annuaire"
            target="_blank"
            rel="noopener noreferrer"
            className="font-corps text-sm text-brique underline underline-offset-2"
          >
            Voir les réceptifs
          </a>
          <p className="font-corps text-sm text-encreDoux">
            Accès <span className="font-600 text-brique">gratuit</span> pour les agents
            de voyage — sur simple inscription.
          </p>
        </div>

        {/* Le Programme */}
        <h2 className="mt-16 font-titre text-4xl font-600 text-encre">Le Programme</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {PROGRAMME.map((p) => (
            <div
              key={p.t}
              className="rounded-xl border-2 border-double border-brique/40 bg-carte px-5 py-6 text-center shadow-carte"
            >
              <p className="font-corps text-sm font-700 tracking-[0.15em] text-brique">{p.h}</p>
              <p className="mt-2 font-titre text-2xl font-600 leading-tight text-encre">{p.t}</p>
              <p className="mt-3 font-corps text-sm leading-relaxed text-encreDoux">{p.d}</p>
            </div>
          ))}
        </div>

        {/* Dates + lieu */}
        <p className="mt-10 font-titre text-2xl font-500 tracking-wide text-encre">
          Mardi 15, mercredi 16 &amp; jeudi 17 septembre 2026
        </p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="inline-block rounded-lg border-[3px] border-double border-brique/55 bg-carte px-6 py-2 font-corps text-sm tracking-wide text-encre">
            Voie 15 — 397 bis rue de Vaugirard, 75015 Paris · Porte de Versailles
          </span>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-corps text-sm text-brique underline underline-offset-2"
          >
            Voir la carte
          </a>
        </div>

        {/* Images du lieu — clic pour agrandir */}
        <GalerieVoie15 images={IMAGES_VOIE15} />
      </section>

      <div className="mx-auto max-w-3xl px-6">
        <FiletGare />
      </div>

      {/* Comment ça marche — 2 étapes */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-center font-titre text-4xl font-500 text-encre">
          Comment ça marche&nbsp;?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center font-corps text-encreDoux">
          Deux étapes, et vous revenez autant de fois que vous le souhaitez pour ajuster
          vos rendez-vous.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {ETAPES.map((e) => (
            <div key={e.n} className="rounded-xl border border-ligne bg-carte p-7 shadow-carte">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brique/60 font-titre text-xl font-600 text-brique">
                {e.n}
              </div>
              <h3 className="mt-5 font-titre text-2xl font-600 text-encre">{e.titre}</h3>
              <p className="mt-2 font-corps text-sm leading-relaxed text-encreDoux">{e.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rappel pratique */}
      <section className="border-t border-ligne">
        <div className="mx-auto grid max-w-3xl gap-10 px-6 py-14 sm:grid-cols-3">
          <InfoPratique titre="Quand" lignes={["15, 16 & 17 septembre 2026", "De 9h00 à 18h00"]} />
          <InfoPratique
            titre="Où"
            lignes={["Voie 15 — Paris 15ᵉ", "Porte de Versailles (M12 / T2)"]}
            lien={{ href: MAPS_URL, label: "Voir la carte" }}
          />
          <InfoPratique
            titre="Pour qui"
            lignes={["Les agents de voyage", "Participation gratuite, sur inscription"]}
          />
        </div>
      </section>

      <footer className="border-t border-ligne py-9 text-center font-corps text-sm text-encreDoux">
        La Station TogeZer — hello@togezer.travel
        <span className="mx-2 text-ligne">·</span>
        <Link href="/connexion" className="underline underline-offset-2 hover:text-encre">
          Se connecter
        </Link>
      </footer>
    </main>
  );
}

function InfoPratique({
  titre,
  lignes,
  lien,
}: {
  titre: string;
  lignes: string[];
  lien?: { href: string; label: string };
}) {
  return (
    <div>
      <p className="font-corps text-[0.7rem] uppercase tracking-[0.28em] text-brique">{titre}</p>
      <p className="mt-2 font-titre text-xl font-600 text-encre">{lignes[0]}</p>
      {lignes.slice(1).map((l) => (
        <p key={l} className="font-corps text-sm text-encreDoux">{l}</p>
      ))}
      {lien && (
        <a href={lien.href} target="_blank" rel="noopener noreferrer"
          className="mt-1 inline-block font-corps text-sm text-brique underline underline-offset-2">
          {lien.label}
        </a>
      )}
    </div>
  );
}
