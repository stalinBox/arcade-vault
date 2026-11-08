"use client";

import { useState, type FormEvent } from "react";

type Tab = "in" | "up";

// Visual-only form: submit does nothing (real auth is a later spec).
export function AuthForm() {
  const [tab, setTab] = useState<Tab>("in");
  const submit = (e: FormEvent<HTMLFormElement>) => e.preventDefault();

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="mark"></div>
        <h2 className="neon-cyan">ARCADE VAULT</h2>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}>
          ACCESO AL SISTEMA · v2.6
        </div>
      </div>

      <div className="auth-tabs">
        <button type="button" className={tab === "in" ? "on" : ""} aria-pressed={tab === "in"} onClick={() => setTab("in")}>
          INICIAR SESIÓN
        </button>
        <button type="button" className={tab === "up" ? "on" : ""} aria-pressed={tab === "up"} onClick={() => setTab("up")}>
          CREAR CUENTA
        </button>
      </div>

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="auth-user">Usuario</label>
          <input id="auth-user" name="user" autoComplete="username" placeholder="px_kai" />
        </div>
        {tab === "up" && (
          <div className="field slide-in">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="jugador@vault.gg" />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-pass">Contraseña</label>
          <input
            id="auth-pass"
            name="password"
            type="password"
            autoComplete={tab === "in" ? "current-password" : "new-password"}
            placeholder="••••••••"
          />
        </div>

        <button className="btn lg" type="submit" style={{ width: "100%", marginTop: 8 }}>
          {tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
        </button>
      </form>

      <button type="button" className="btn ghost" style={{ width: "100%", marginTop: 10 }}>
        JUGAR COMO INVITADO
      </button>

      <div className="auth-divider">O CONTINÚA CON</div>
      <div className="social">
        <button className="btn ghost" type="button">◆  GOOGLE</button>
        <button className="btn ghost" type="button">▣  GITHUB</button>
      </div>

      <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
        AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
      </div>
    </div>
  );
}
