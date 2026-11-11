import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ComponentType } from "react";
import { AsteroidsPlayer } from "@/components/asteroids-player";
import { BlocksPlayer } from "@/components/blocks-player";
import { RompebloquesPlayer } from "@/components/rompebloques-player";
import { SnakePlayer } from "@/components/snake-player";
import { CrtScreen } from "@/components/crt-screen";
import { getGame, getGameIds } from "@/lib/games";

export async function generateStaticParams() {
  return getGameIds();
}

// Playable games: id → player component. Ids without an entry show the static CRT placeholder.
const GAME_PLAYERS: Record<string, ComponentType> = {
  asteroids: AsteroidsPlayer,
  blocks: BlocksPlayer,
  rompebloques: RompebloquesPlayer,
  snake: SnakePlayer,
};

// Fixed HUD values: no game logic in this spec.
const SCORE = 0;
const LIVES = 3;
const LEVEL = 1;

// `params` is read inside <Suspense> (Cache Components + Partial Prefetching):
// the static shell stays URL-independent and navigations remain instant.
export default function GamePlayerPage({ params }: PageProps<"/jugar/[id]">) {
  return (
    <Suspense fallback={<div className="av-player" aria-busy="true" />}>
      <GamePlayer params={params} />
    </Suspense>
  );
}

async function GamePlayer({
  params,
}: Pick<PageProps<"/jugar/[id]">, "params">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const Player = GAME_PLAYERS[game.id];
  if (Player) return <Player />;

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
            <div className="v">{SCORE.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(LIVES).trim()}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(LEVEL).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button type="button" className="btn yellow">
            PAUSA
          </button>
          <button type="button" className="btn magenta">
            FIN
          </button>
          <Link href={`/juego/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <CrtScreen title={game.title} />
    </div>
  );
}
