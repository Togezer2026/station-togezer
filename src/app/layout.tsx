import type { Metadata } from "next";
import { Cormorant_Garamond, Mulish } from "next/font/google";
import "./globals.css";

// Titres — serif élégant, esprit voyage/luxe discret
const titre = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-titre",
  display: "swap",
});

// Courant — sans-serif humaniste, chaleureuse et accessible
const corps = Mulish({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-corps",
  display: "swap",
});

export const metadata: Metadata = {
  title: "La Station TogeZer",
  description:
    "Rendez-vous entre agents de voyage et réceptifs partenaires — 15, 16 & 17 septembre 2026, Voie 15, Paris.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${titre.variable} ${corps.variable}`}>
      <body>{children}</body>
    </html>
  );
}
