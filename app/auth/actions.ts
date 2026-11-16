"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export type AuthState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "check-email"; email: string };

const USERNAME_RE = /^[a-z0-9_]{3,12}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed:
    "Tu correo aún no está confirmado. Revisa tu bandeja de entrada.",
  user_already_exists: "Ese correo ya está registrado.",
  email_exists: "Ese correo ya está registrado.",
  weak_password: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`,
  email_address_invalid: "El correo no es válido.",
  signup_disabled: "El registro está desactivado.",
  over_email_send_rate_limit:
    "Se enviaron demasiados correos. Espera unos minutos y vuelve a probar.",
  over_request_rate_limit:
    "Demasiados intentos. Espera unos minutos y vuelve a probar.",
};
const GENERIC_ERROR = "No se pudo completar la operación. Inténtalo de nuevo.";

function fail(message: string): AuthState {
  return { status: "error", message };
}

function authError(code: string | undefined): AuthState {
  return fail((code && ERROR_MESSAGES[code]) || GENERIC_ERROR);
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${h.get("host")}`;
}

// Registro con usuario + email + contraseña. No inicia sesión: exige confirmar el correo.
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = field(formData, "username").toLowerCase();
  const email = field(formData, "email");
  const password = formData.get("password");

  if (!USERNAME_RE.test(username)) {
    return fail(
      "El usuario debe tener de 3 a 12 caracteres: letras minúsculas, números o _.",
    );
  }
  if (!EMAIL_RE.test(email)) return fail("El correo no es válido.");
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return fail(
      `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`,
    );
  }

  const supabase = await createClient();

  const { data: taken, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (lookupError) return fail(GENERIC_ERROR);
  if (taken) return fail("Ese usuario ya está en uso.");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${await getOrigin()}/auth/confirm`,
    },
  });
  if (error) return authError(error.code);

  return { status: "check-email", email };
}

// Inicio de sesión con email + contraseña. Si va bien, redirige a `next`.
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = field(formData, "email");
  const password = formData.get("password");

  if (!email || typeof password !== "string" || !password) {
    return fail("Escribe tu correo y tu contraseña.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return authError(error.code);

  redirect(safeNext(field(formData, "next")));
}

export type OAuthProvider = "google" | "github";

// Inicio de sesión / registro con Google o GitHub. Redirige al proveedor;
// a la vuelta, /auth/callback canjea el código y redirige a `next`.
export async function signInWithOAuth(
  provider: OAuthProvider,
  next: string,
): Promise<AuthState> {
  if (provider !== "google" && provider !== "github")
    return fail(GENERIC_ERROR);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${await getOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
    },
  });
  if (error || !data.url) {
    return fail(
      "No se pudo conectar con el proveedor. Prueba con correo y contraseña.",
    );
  }

  redirect(data.url);
}

// Cierre de sesión desde la nav.
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/inicio");
}
