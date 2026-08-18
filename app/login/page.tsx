"use client";

import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";

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
    <div className="flex min-h-full items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-3xl border border-line bg-paper p-10">
        <BrandMark className="h-10 w-10" />
        <h1 className="mt-6 text-2xl font-medium tracking-tight text-ink">Socio Management System</h1>
        <p className="mt-2 text-sm text-muted">
          Entrá con tu cuenta Google de @sociopublico.com.
        </p>
        <Button type="button" variant="primary" onClick={signIn} className="mt-8 w-full">
          Continuar con Google
        </Button>
      </div>
    </div>
  );
}
