"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveScore } from "@/lib/scores-client";

type SaveStatus = "idle" | "saving" | "saved" | "error";

// Se desmonta al reiniciar (result vuelve a null): cada partida se guarda una sola vez.
export function ScoreForm({ gameId, score }: { gameId: string; score: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 12;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || status === "saving" || status === "saved") return;
    setStatus("saving");
    try {
      await saveScore(gameId, trimmed, score);
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  if (status === "saved") {
    return (
      <p className="pixel neon-cyan" style={{ fontSize: 11, textAlign: "center", marginTop: 20 }}>
        Puntuación guardada
      </p>
    );
  }

  // El motor escucha teclas en window (Espacio, Enter, P): no deben llegar desde el campo.
  const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 20,
      }}
    >
      <label className="pixel" htmlFor="score-name" style={{ fontSize: 10 }}>
        Nombre
      </label>
      <div className="av-search" style={{ flex: "0 1 220px" }}>
        <input
          id="score-name"
          value={name}
          maxLength={12}
          autoComplete="off"
          disabled={status === "saving"}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={stopKeys}
          onKeyUp={stopKeys}
          placeholder="Hasta 12 caracteres"
        />
      </div>
      <button type="submit" className="btn" disabled={!valid || status === "saving"}>
        {status === "saving" ? "GUARDANDO…" : "GUARDAR"}
      </button>
      {status === "error" && (
        <p role="alert" style={{ flexBasis: "100%", textAlign: "center", color: "var(--magenta)", margin: 0 }}>
          No se pudo guardar la puntuación. Revisa tu conexión y vuelve a intentarlo.
        </p>
      )}
    </form>
  );
}
