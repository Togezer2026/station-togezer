"use client";

import { useEffect, useState } from "react";

export default function GalerieVoie15({ images }: { images: string[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);

  // Fermeture au clavier (Échap)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="mt-8 grid grid-cols-3 gap-3">
        {images.map((f) => (
          <button
            key={f}
            onClick={() => setOuvert(f)}
            aria-label="Agrandir la photo"
            className="group overflow-hidden rounded-lg shadow-carte"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/${f}`}
              alt="Voie 15"
              className="h-24 w-full cursor-zoom-in object-cover transition duration-300 group-hover:scale-105 sm:h-36"
            />
          </button>
        ))}
      </div>

      {ouvert && (
        <div
          onClick={() => setOuvert(null)}
          className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-encre/80 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/${ouvert}`}
            alt="Voie 15"
            className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-carte"
          />
          <button
            onClick={() => setOuvert(null)}
            aria-label="Fermer"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-creme/90 font-corps text-xl text-encre shadow-carte"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
