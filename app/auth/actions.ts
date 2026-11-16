"use server";

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
// Mismo conjunto de símbolos que acepta Supabase Auth.
const PASSWORD_RULES = [
  /[a-z]/,
  /[A-Z]/,
  /[0-9]/,
  /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/,
];
const PASSWORD_MESSAGE =
  "La contraseña debe tener al menos 8 caracteres, con minúsculas, mayúsculas, números y símbolos.";

function isStrongPassword(p: string): boolean {
  return p.length >= MIN_PASSWORD && PASSWORD_RULES.every((re) => re.test(p));
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed:
    "Tu correo aún no está confirmado. Revisa tu bandeja de entrada.",
  user_already_exists: "Ese correo ya está registrado.",
  email_exists: "Ese correo ya está registrado.",
  weak_password: PASSWORD_MESSAGE,
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

// El origen sale de una variable de entorno, no de los headers de la petición
// (los controla el cliente: un Host falso envenenaría el enlace del correo).
function getOrigin(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta NEXT_PUBLIC_SITE_URL. Revisa .env.local.");
  }
  return "http://localhost:3000";
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
  if (typeof password !== "string" || !isStrongPassword(password)) {
    return fail(PASSWORD_MESSAGE);
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
      emailRedirectTo: `${getOrigin()}/auth/confirm`,
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
      redirectTo: `${getOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
    },
  });
  if (error || !data.url) {
    return fail(
      "No se pudo conectar con el proveedor. Prueba con correo y contraseña.",
    );
  }

  redirect(data.url);
}

// El cierre de sesión se hace en el navegador (components/nav.tsx) para que
// onAuthStateChange actualice la nav al instante.
