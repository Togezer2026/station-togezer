import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { HorlogeQuai, FiletGare } from "@/components/Ornaments";

const MAPS_URL = "https://maps.app.goo.gl/BaG2dEYZsWxJaT3e9";

const ETAPES = [
  {
    n: "1",
    titre: "Je m'inscris",
    desc: "Agence, prénom, nom, e-mail. Je crée mon accès en une minute — c'est gratuit.",
  },
  {
    n: "2",
    titre: "Je prends mes rendez-vous",
    desc: "Je choisis mes jours de venue, puis mes créneaux avec les réceptifs. Je reviens autant de fois que je veux pour ajuster mon programme.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero — crème, aéré ; le Z est la seule fantaisie */}
      <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <div className="mb-10 flex items-center justify-center text-encreDoux">
          <HorlogeQuai className="h-8 w-8" />
        </div>

        <p className="text-[0.7rem] font-600 uppercase tracking-[0.38em] text-brique">
          Gratuit pour les agents de voyage
        </p>

        <div className="mt-8 flex justify-center">
          <Wordmark className="h-auto w-[340px] max-w-full sm:w-[440px]" />
        </div>

        <p className="mx-auto mt-9 max-w-lg font-corps text-lg leading-relaxed text-encreDoux">
          Trois journées de rendez-vous privilégiés entre agents de voyage et nos
          réceptifs partenaires. Inscrivez-vous, puis composez votre programme.
        </p>

        <p className="mt-9 font-titre text-3xl font-500 tracking-wide text-encre">
          Mardi 15, mercredi 16 &amp; jeudi 17 septembre 2026
        </p>

        {/* plaque émaillée — signalétique « Voie 15 » */}
        <div className="mt-6 flex justify-center">
          <span className="inline-block rounded-lg border-[3px] border-double border-brique/55 bg-carte px-6 py-2.5 font-corps text-sm tracking-wide text-encre">
            Voie 15 — 397 bis rue de Vaugirard, 75015 Paris · Porte de Versailles
          </span>
        </div>

        <div className="mt-11 flex flex-wrap justify-center gap-4">
          <Link
            href="/inscription"
            className="rounded-full bg-brique px-8 py-3 font-corps font-600 tracking-wide text-creme shadow-carte transition hover:bg-briqueFonce"
          >
            Je m'inscris
          </Link>
          <Link
            href="/annuaire"
            className="rounded-full border border-encre/20 px-8 py-3 font-corps font-500 tracking-wide text-encre transition hover:bg-encre/5"
          >
            Voir les exposants
          </Link>
        </div>
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
          Deux étapes, et vous revenez autant de fois que vous le souhaitez pour
          ajuster vos rendez-vous.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {ETAPES.map((e) => (
            <div
              key={e.n}
              className="rounded-xl border border-ligne bg-carte p-7 shadow-carte"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brique/60 font-titre text-xl font-600 text-brique">
                {e.n}
              </div>
              <h3 className="mt-5 font-titre text-2xl font-600 text-encre">
                {e.titre}
              </h3>
              <p className="mt-2 font-corps text-sm leading-relaxed text-encreDoux">
                {e.desc}
              </p>
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
            lien={{ href: MAPS_URL, label: "Voir l'itinéraire" }}
          />
          <InfoPratique
            titre="Pour qui"
            lignes={["Les agents de voyage", "Participation gratuite, sur inscription"]}
          />
        </div>
      </section>

      <footer className="border-t border-ligne py-9 text-center font-corps text-sm text-encreDoux">
        La Station TogeZer — hello@togezer.travel
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
      <p className="font-corps text-[0.7rem] uppercase tracking-[0.28em] text-brique">
        {titre}
      </p>
      <p className="mt-2 font-titre text-xl font-600 text-encre">{lignes[0]}</p>
      {lignes.slice(1).map((l) => (
        <p key={l} className="font-corps text-sm text-encreDoux">
          {l}
        </p>
      ))}
      {lien && (
        <a
          href={lien.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block font-corps text-sm text-brique underline underline-offset-2"
        >
          {lien.label}
        </a>
      )}
    </div>
  );
}
