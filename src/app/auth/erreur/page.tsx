import Link from "next/link";

export default function AuthErreur() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-titre text-2xl text-encre">Lien de confirmation invalide</h1>
      <p className="mt-3 text-encre/70">
        Ce lien a peut-être expiré ou a déjà été utilisé. Réessayez de vous
        connecter, ou refaites une demande d'inscription.
      </p>
      <Link href="/inscription" className="mt-6 text-brique underline">
        Retour à l'inscription
      </Link>
    </main>
  );
}
