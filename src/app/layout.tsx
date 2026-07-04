import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Station TogeZer",
  description:
    "Rendez-vous entre agents de voyage et réceptifs partenaires — 15, 16 & 17 septembre 2026, Voie 15, Paris.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
