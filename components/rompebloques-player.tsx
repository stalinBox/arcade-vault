"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  createRompebloques,
  type RompebloquesController,
  type RompebloquesStats,
} from "@/lib/rompebloques/engine";
import { ScoreForm } from "@/components/score-form";
import { SkinPicker } from "@/components/skin-picker";
import { useColorMode, useSkin } from "@/lib/skins";

// Normal difficulty: 3 lives.
const INITIAL_STATS: RompebloquesStats = { score: 0, lives: 3, level: 1 };

export function RompebloquesPlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RompebloquesController | null>(null);
  const [stats, setStats] = useState<RompebloquesStats>(INITIAL_STATS);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ score: number; level: number } | null>(
    null,
  );
  const [skin, setSkin] = useSkin("rompebloques");
  const mode = useColorMode();
  // Latest look, read once when the game is created below.
  const lookRef = useRef({ skin, mode });

  // Declared before the create effect so the first create sees the current look.
  useEffect(() => {
    lookRef.current = { skin, mode };
    gameRef.current?.setSkin(skin, mode);
  }, [skin, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createRompebloques(
      canvas,
      {
        onStats(next) {
          setStats(next);
          // The engine emits no stats after onGameOver until a new game starts,
          // so this also clears the form on restarts via Enter or Space.
          setResult(null);
        },
        onGameOver: setResult,
        onPauseChange: setPaused,
      },
      lookRef.current,
    );
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const isOver = result !== null;

  // Blur so a later Space keypress launches the ball instead of re-activating the button.
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
            <div className="l">Vidas</div>
            <div className="v">{"♥".repeat(stats.lives)}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(stats.level).padStart(2, "0")}</div>
          </div>
        </div>
        <SkinPicker value={skin} onChange={setSkin} />
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
          <Link href="/juego/rompebloques" className="btn ghost">
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
          <span>ROMPEBLOQUES · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {result && result.score > 0 && (
        <ScoreForm gameId="rompebloques" score={result.score} />
      )}
    </div>
  );
}
