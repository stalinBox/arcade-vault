"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  createSnake,
  type SnakeController,
  type SnakeStats,
} from "@/lib/snake/engine";
import { ScoreForm } from "@/components/score-form";
import { SkinPicker } from "@/components/skin-picker";
import { useColorMode, useSkin } from "@/lib/skins";

const INITIAL_STATS: SnakeStats = { score: 0, level: 1 };

export function SnakePlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeController | null>(null);
  const [stats, setStats] = useState<SnakeStats>(INITIAL_STATS);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<SnakeStats | null>(null);
  const [skin, setSkin] = useSkin("snake");
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
    const game = createSnake(
      canvas,
      {
        onStats(next) {
          setStats(next);
          // Stats are emitted again only when a new match starts, so this clears the form on restart.
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

  // Blur so a later Enter or Space goes to the game, not to the focused button.
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
          <Link href="/juego/snake" className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt crt-game">
        <div className="crt-screen">
          <canvas ref={canvasRef} width={480} height={480} />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>SNAKE · CRT-83 · 60 HZ</span>
        </div>
      </div>

      {result && result.score > 0 && (
        <ScoreForm gameId="snake" score={result.score} />
      )}
    </div>
  );
}
