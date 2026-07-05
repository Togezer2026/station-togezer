import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Confirmation d'e-mail. Gère les deux formats de lien Supabase :
//  - token_hash + type (recommandé, indépendant de l'appareil)
//  - code (PKCE, lien par défaut)
// Puis redirige l'agent vers sa page de réservation (?next=...).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // Seuls les chemins internes sont autorisés (pas de redirection externe).
  const brut = searchParams.get("next") ?? "/mon-espace";
  const next = brut.startsWith("/") && !brut.startsWith("//") ? brut : "/mon-espace";
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth/erreur`);
}
