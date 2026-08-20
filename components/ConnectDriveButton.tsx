"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { DRIVE_CONNECT_NEXT, DRIVE_OAUTH_SCOPES } from "@/lib/drive-constants";

const OAUTH_NEXT_COOKIE = "sms_oauth_next";

function setOauthNextCookie(path: string) {
  document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(path)}; path=/; max-age=600; samesite=lax`;
}

export function ConnectDriveButton() {
  async function connect() {
    const supabase = createClient();
    const origin = window.location.origin;
    // Importante: redirectTo exacto (sin ?next=) para que coincida con la allowlist de Supabase.
    // El destino post-login va en cookie; si no, Auth cae al site_url (127.0.0.1) y rompe cookies de localhost.
    setOauthNextCookie(DRIVE_CONNECT_NEXT);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        scopes: DRIVE_OAUTH_SCOPES,
        queryParams: {
          hd: "sociopublico.com",
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  }

  return (
    <Button type="button" variant="primary" onClick={connect}>
      Conectar Google Drive
    </Button>
  );
}
