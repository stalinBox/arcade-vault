"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  createAsteroids,
  type AsteroidsController,
  type AsteroidsStats,
} from "@/lib/asteroids/engine";
import { saveScore } from "@/lib/scores-client";

const INITIAL_STATS: AsteroidsStats = { score: 0, lives: 3, level: 1 };

type SaveStatus = "idle" | "saving" | "saved" | "error";

// Se desmonta al reiniciar (result vuelve a null): cada partida se guarda una sola vez.
function ScoreForm({ score }: { score: number }) {
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
      await saveScore("asteroids", trimmed, score);
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

export function AsteroidsPlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsController | null>(null);
  const [stats, setStats] = useState<AsteroidsStats>(INITIAL_STATS);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ score: number; level: number } | null>(
    null,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createAsteroids(canvas, {
      onStats(next) {
        setStats(next);
        // A game with lives left is running: covers restarts via Enter too.
        if (next.lives > 0) setResult(null);
      },
      onGameOver: setResult,
      onPauseChange: setPaused,
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const isOver = result !== null;

  // Blur so a later Space keypress shoots instead of re-activating the button.
  const onTogglePause = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    gameRef.current?.togglePause();
  };
  const onRestart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    gameRef.current?.restart();
  };
  const onEnd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    gameRef.current?.end();
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              INVITADO
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{stats.score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(stats.lives).trim()}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(stats.level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="btn yellow"
            disabled={isOver}
            onClick={onTogglePause}
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          {isOver ? (
            <button type="button" className="btn magenta" onClick={onRestart}>
              NUEVA PARTIDA
            </button>
          ) : (
            <button type="button" className="btn magenta" onClick={onEnd}>
              FIN
            </button>
          )}
          <Link href="/juego/asteroids" className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt crt-game">
        <div className="crt-screen">
          <canvas ref={canvasRef} width={800} height={600} />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>ASTEROIDES · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {result && result.score > 0 && <ScoreForm score={result.score} />}
    </div>
  );
}
