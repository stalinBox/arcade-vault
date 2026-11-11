"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  createBlocks,
  type BlocksController,
  type BlocksStats,
} from "@/lib/blocks/engine";
import { ScoreForm } from "@/components/score-form";

const INITIAL_STATS: BlocksStats = { score: 0, lines: 0, level: 1 };

export function BlocksPlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BlocksController | null>(null);
  const [stats, setStats] = useState<BlocksStats>(INITIAL_STATS);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ score: number; level: number } | null>(
    null,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createBlocks(canvas, {
      onStats(next) {
        setStats(next);
        // The engine emits no stats after onGameOver until a new game starts,
        // so this also clears the form on restarts via Enter.
        setResult(null);
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

  // Blur so a later Space keypress hard-drops instead of re-activating the button.
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
          <div className="hud-stat">
            <div className="l">Líneas</div>
            <div className="v">{stats.lines.toLocaleString("es-ES")}</div>
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
          <Link href="/juego/blocks" className="btn ghost">
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
          <span>BLOQUES · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {result && result.score > 0 && (
        <ScoreForm gameId="blocks" score={result.score} />
      )}
    </div>
  );
}
