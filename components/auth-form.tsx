"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  signIn,
  signInWithOAuth,
  signUp,
  type AuthState,
  type OAuthProvider,
} from "@/app/auth/actions";

type Tab = "in" | "up";

const IDLE: AuthState = { status: "idle" };

// Errores que llegan por `?error=` desde /auth/confirm y /auth/callback.
const URL_ERRORS: Record<string, string> = {
  confirm: "El enlace de confirmación no es válido o ha caducado.",
  oauth: "No se pudo iniciar sesión con el proveedor. Inténtalo de nuevo.",
};

export function AuthForm({ next, error }: { next: string; error?: string }) {
  const [tab, setTab] = useState<Tab>("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [inState, inAction, inPending] = useActionState(signIn, IDLE);
  const [upState, upAction, upPending] = useActionState(signUp, IDLE);
  const [oauthError, setOauthError] = useState<string>();
  const [oauthPending, startTransition] = useTransition();

  const startOAuth = (provider: OAuthProvider) =>
    startTransition(async () => {
      setOauthError(undefined);
      // Si va bien, la acción redirige al proveedor y no vuelve aquí.
      const result = await signInWithOAuth(provider, next);
      if (result.status === "error") setOauthError(result.message);
    });

  const state = tab === "in" ? inState : upState;
  const pending = tab === "in" ? inPending : upPending;
  const message =
    state.status === "error"
      ? state.message
      : state.status === "idle" && error
        ? URL_ERRORS[error]
        : undefined;

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="mark"></div>
        <h2 className="neon-cyan">ARCADE VAULT</h2>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
            marginTop: 6,
          }}
        >
          ACCESO AL SISTEMA · v2.6
        </div>
      </div>

      <div className="auth-tabs">
        <button
          type="button"
          className={tab === "in" ? "on" : ""}
          aria-pressed={tab === "in"}
          onClick={() => setTab("in")}
        >
          INICIAR SESIÓN
        </button>
        <button
          type="button"
          className={tab === "up" ? "on" : ""}
          aria-pressed={tab === "up"}
          onClick={() => setTab("up")}
        >
          CREAR CUENTA
        </button>
      </div>

      {state.status === "check-email" ? (
        <div className="slide-in" role="status" style={{ textAlign: "center" }}>
          <h3
            className="neon-cyan"
            style={{
              fontFamily: "var(--pixel)",
              fontSize: 12,
              letterSpacing: "0.12em",
              margin: "8px 0 12px",
            }}
          >
            REVISA TU CORREO
          </h3>
          <p
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--ink-dim)",
              lineHeight: 1.6,
              margin: "0 0 16px",
            }}
          >
            Enviamos un enlace de confirmación a <strong>{state.email}</strong>.
            Ábrelo para activar tu cuenta y después inicia sesión.
          </p>
          <button
            type="button"
            className="btn"
            style={{ width: "100%" }}
            onClick={() => setTab("in")}
          >
            IR A INICIAR SESIÓN
          </button>
        </div>
      ) : (
        <form action={tab === "in" ? inAction : upAction}>
          <input type="hidden" name="next" value={next} />
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="auth-user">Usuario</label>
              <input
                id="auth-user"
                name="username"
                autoComplete="username"
                placeholder="px_kai"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="jugador@vault.gg"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              name="password"
              type="password"
              autoComplete={tab === "in" ? "current-password" : "new-password"}
              placeholder="••••••••"
              required
            />
          </div>

          {message && (
            <p className="contact-error" role="alert">
              {message}
            </p>
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={pending}
            style={{ width: "100%", marginTop: 8 }}
          >
            {pending
              ? "▶  CONECTANDO…"
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>
        </form>
      )}

      <Link
        href="/biblioteca"
        className="btn ghost"
        style={{ width: "100%", marginTop: 10 }}
      >
        JUGAR COMO INVITADO
      </Link>

      <div className="auth-divider">O CONTINÚA CON</div>
      <div className="social">
        <button
          className="btn ghost"
          type="button"
          disabled={oauthPending}
          onClick={() => startOAuth("google")}
        >
          ◆ GOOGLE
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={oauthPending}
          onClick={() => startOAuth("github")}
        >
          ▣ GITHUB
        </button>
      </div>
      {oauthError && (
        <p className="contact-error" role="alert" style={{ marginTop: 12 }}>
          {oauthError}
        </p>
      )}

      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 11,
          color: "var(--ink-faint)",
          letterSpacing: "0.1em",
        }}
      >
        AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
      </div>
    </div>
  );
}
