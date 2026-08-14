"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function signIn() {
    const supabase = createClient();
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: { hd: "sociopublico.com" },
      },
    });
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-stone-50 px-6">
      <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-8">
        <h1 className="text-xl font-semibold tracking-tight">Gestión Socio</h1>
        <p className="mt-2 text-sm text-stone-600">
          Entrá con tu cuenta Google de @sociopublico.com.
        </p>
        <button
          type="button"
          onClick={signIn}
          className="mt-6 w-full rounded bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
        >
          Continuar con Google
        </button>
      </div>
    </div>
  );
}
