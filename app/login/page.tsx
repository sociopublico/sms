"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";

function readAuthError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const error = hash.get("error") ?? query.get("error");
  const errorCode = hash.get("error_code") ?? query.get("error_code");
  const description = hash.get("error_description") ?? query.get("error_description");
  return { error, errorCode, description };
}

function messageForAuthError(error: string | null, description: string | null) {
  const text = `${error ?? ""} ${description ?? ""}`.toLowerCase();
  if (text.includes("saving new user") || text.includes("database error")) {
    return "Google te autenticó, pero no se pudo crear tu usuario en el sistema. Entrá con la cuenta @sociopublico.com (no una Gmail personal) o avisale a un admin.";
  }
  if (error === "auth" || error === "server_error" || error === "access_denied") {
    return "No se pudo completar el login. Entrá con tu cuenta Google de @sociopublico.com.";
  }
  return null;
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { error: authError, errorCode, description } = readAuthError();
    if (!authError && !description) return;

    const message = messageForAuthError(authError, description);
    setError(message ?? "No se pudo completar el login.");

    const supabase = createClient();
    void supabase
      .rpc("log_auth_event", {
        p_action: "auth.login_failed",
        p_error: description ?? authError,
        p_payload: {
          error: authError,
          error_code: errorCode,
          error_description: description,
        },
      })
      .then(({ error: logError }) => {
        if (logError) console.error("log_auth_event failed", logError.message);
      });

    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    window.history.replaceState({}, "", url.pathname);
  }, []);

  async function signIn() {
    const supabase = createClient();
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: { hd: "sociopublico.com", prompt: "select_account" },
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
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <Button type="button" variant="primary" onClick={signIn} className="mt-8 w-full">
          Continuar con Google
        </Button>
      </div>
    </div>
  );
}
