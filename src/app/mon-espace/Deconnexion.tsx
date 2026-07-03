"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Deconnexion() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="rounded-lg border border-encre/20 px-4 py-2 text-sm text-encre/70 hover:bg-creme"
    >
      Se déconnecter
    </button>
  );
}
