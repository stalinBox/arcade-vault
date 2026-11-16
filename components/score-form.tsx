"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCurrentUser } from "@/lib/auth-client";
import { SessionExpiredError, saveScore } from "@/lib/scores-client";

type SaveStatus = "idle" | "saving" | "saved" | "error" | "expired";

const boxStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 20,
};

// Se desmonta al reiniciar (result vuelve a null): cada partida se guarda una sola vez.
// Solo usuarios con sesión guardan, con su username fijo (la política de RLS lo exige).
export function ScoreForm({
  gameId,
  score,
}: {
  gameId: string;
  score: number;
}) {
  const router = useRouter();
  const user = useCurrentUser();
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Cargando la sesión: estado neutro, sin mostrar ni el formulario ni el mensaje.
  if (user === undefined)
    return <div aria-hidden style={{ ...boxStyle, minHeight: 40 }} />;

  if (user === null) {
    return (
      <div style={boxStyle}>
        <p className="pixel" style={{ fontSize: 10, margin: 0 }}>
          Inicia sesión para guardar tu puntaje
        </p>
        <Link
          href={`/auth?next=${encodeURIComponent(`/jugar/${gameId}`)}`}
          className="btn"
        >
          INICIAR SESIÓN
        </Link>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <p
        className="pixel neon-cyan"
        style={{ fontSize: 11, textAlign: "center", marginTop: 20 }}
      >
        Puntuación guardada
      </p>
    );
  }

  const username = user.username;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "saving") return;
    setStatus("saving");
    try {
      await saveScore(gameId, username, score);
      setStatus("saved");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof SessionExpiredError ? "expired" : "error");
    }
  }

  return (
    <form onSubmit={onSubmit} style={boxStyle}>
      <span className="pixel" style={{ fontSize: 10 }}>
        Jugador
      </span>
      <span className="pixel neon-cyan" style={{ fontSize: 11 }}>
        {username}
      </span>
      <button type="submit" className="btn" disabled={status === "saving"}>
        {status === "saving" ? "GUARDANDO…" : "GUARDAR"}
      </button>
      {(status === "error" || status === "expired") && (
        <p
          role="alert"
          style={{
            flexBasis: "100%",
            textAlign: "center",
            color: "var(--magenta)",
            margin: 0,
          }}
        >
          {status === "expired"
            ? "Tu sesión expiró, vuelve a iniciar sesión"
            : "No se pudo guardar la puntuación. Revisa tu conexión y vuelve a intentarlo."}
        </p>
      )}
    </form>
  );
}
