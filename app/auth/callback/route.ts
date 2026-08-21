import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DRIVE_CONNECT_NEXT, DRIVE_OAUTH_SCOPES, DRIVE_ROOT_FOLDER_ID } from "@/lib/drive-constants";

const OAUTH_NEXT_COOKIE = "sms_oauth_next";

function safeNextPath(raw: string | null | undefined, fallback = "/timeline") {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const cookieNext = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_NEXT_COOKIE}=`))
    ?.slice(OAUTH_NEXT_COOKIE.length + 1);
  const next = safeNextPath(
    searchParams.get("next") ?? (cookieNext ? decodeURIComponent(cookieNext) : null),
  );

  const clearCookie = {
    name: OAUTH_NEXT_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  };

  const oauthError = searchParams.get("error");
  const oauthDescription = searchParams.get("error_description");
  const oauthCode = searchParams.get("error_code");
  let exchangeError: string | null = null;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      exchangeError = error.message;
      console.error("auth callback exchange failed", error.message);
    }
    if (!error) {
      const wantsDrive =
        next.startsWith("/horas/sync") || next.startsWith("/integraciones/drive");
      if (wantsDrive && data.session?.provider_refresh_token) {
        const userId = data.session.user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("app_role")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.app_role === "admin") {
          await supabase.from("drive_connections").upsert(
            {
              provider: "google",
              connected_by: userId,
              refresh_token: data.session.provider_refresh_token,
              access_token: data.session.provider_token ?? null,
              access_token_expires_at: data.session.provider_token
                ? new Date(Date.now() + 55 * 60 * 1000).toISOString()
                : null,
              scopes: DRIVE_OAUTH_SCOPES,
              root_folder_id: DRIVE_ROOT_FOLDER_ID,
              connected_at: new Date().toISOString(),
            },
            { onConflict: "provider" },
          );
        }
      } else if (wantsDrive && !data.session?.provider_refresh_token) {
        const response = NextResponse.redirect(
          `${origin}/horas/sync?error=${encodeURIComponent(
            "Google no devolvió refresh token. Revisá el scope drive.readonly y volvé a conectar.",
          )}`,
        );
        response.cookies.set(clearCookie);
        return response;
      }

      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.set(clearCookie);
      return response;
    }
  }

  console.error("auth callback failed", {
    missingCode: !code,
    oauthError,
    oauthCode,
    oauthDescription,
    exchangeError,
  });

  const login = new URL(`${origin}/login`);
  login.searchParams.set("error", "auth");
  const description = oauthDescription ?? exchangeError;
  if (description) login.searchParams.set("error_description", description);
  if (oauthCode) login.searchParams.set("error_code", oauthCode);
  const response = NextResponse.redirect(login);
  response.cookies.set(clearCookie);
  return response;
}
