import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base papier — ivoire doux, chaleureux
        creme: "#F5EFE2",
        carte: "#FBF7EE", // intérieur émaillé des cartouches
        ligne: "#D8C6A8", // filets fins
        // Encre — brun espresso chaud (élégant, jamais noir dur)
        encre: "#3B2F26",
        encreDoux: "#7C6C5B",
        // Accent lead — terracotta / brique, désaturé pour l'élégance
        brique: "#B0503C",
        briqueFonce: "#8E3E2E",
        // Palette du Z UNIQUEMENT (désaturée)
        zBrique: "#B0503C",
        zMoutarde: "#C79A46",
        zSarcelle: "#4E827D",
        zSauge: "#93A079",
      },
      fontFamily: {
        titre: ["var(--font-titre)", "Cormorant Garamond", "Georgia", "serif"],
        corps: ["var(--font-corps)", "Mulish", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        carte: "0 1px 2px rgba(59,47,38,0.04), 0 10px 30px rgba(59,47,38,0.05)",
      },
    },
  },
  plugins: [],
} satisfies Config;
