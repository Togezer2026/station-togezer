import { createClient } from "@supabase/supabase-js";

// Client "service_role" — SERVEUR UNIQUEMENT. Contourne la RLS.
// À n'utiliser que dans des server actions protégées par requireAdmin().
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
