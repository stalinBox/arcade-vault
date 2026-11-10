"use client";

import { useMemo, useState } from "react";
import { GameCard } from "@/components/game-card";
import { CATS, type Game } from "@/lib/games-types";

export function Library({ games }: { games: Game[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("TODOS");

  // Solo categorías con al menos un juego en el catálogo.
  const cats = useMemo(
    () => CATS.filter((c) => c === "TODOS" || games.some((g) => g.cat === c)),
    [games],
  );

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return games.filter(
      (g) =>
        (cat === "TODOS" || g.cat === cat) &&
        (g.title.toLowerCase().includes(needle) ||
          g.short.toLowerCase().includes(needle)),
    );
  }, [games, q, cat]);

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico" aria-hidden="true">
            ⌕
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un juego por nombre…"
            aria-label="Buscar juego"
          />
        </div>
        <div className="av-chips">
          {cats.map((c) => (
            <button
              key={c}
              className={"chip" + (cat === c ? " active" : "")}
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: 80,
              color: "var(--ink-faint)",
            }}
          >
            <div
              className="pixel"
              style={{
                fontSize: 14,
                color: "var(--magenta)",
                marginBottom: 12,
              }}
            >
              NO HAY RESULTADOS
            </div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </div>
  );
}
