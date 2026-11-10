"use client";

import Link from "next/link";
import { useState } from "react";
import type { Game } from "@/lib/games-types";
import type { ScoreRow } from "@/lib/scores-types";

const TOP = ["top1", "top2", "top3"];

function PodiumSlot({
  row,
  place,
  className,
}: {
  row: ScoreRow | undefined;
  place: string;
  className: string;
}) {
  const gold = className === "gold";
  return (
    <div className={"podium-slot " + className}>
      {gold && (
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
        >
          CAMPEÓN
        </div>
      )}
      <div
        className="rank-num"
        style={gold ? { fontSize: 36, marginTop: 4 } : undefined}
      >
        {place}
      </div>
      <div className="name">{row?.name ?? "—"}</div>
      <div className="score" style={gold ? { fontSize: 20 } : undefined}>
        {row ? row.score.toLocaleString("es-ES") : "—"}
      </div>
      <div className="date">{row?.date ?? ""}</div>
    </div>
  );
}

export function HallOfFame({
  games,
  scores,
}: {
  games: Game[];
  scores: Record<string, ScoreRow[]>;
}) {
  const [tab, setTab] = useState(games[0]?.id);
  const game = games.find((g) => g.id === tab);
  const rows = (tab && scores[tab]) || [];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            className={"chip" + (tab === g.id ? " active" : "")}
            aria-pressed={tab === g.id}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <h2
        className="pixel neon-cyan"
        style={{ fontSize: 14, textAlign: "center", margin: "0 0 24px" }}
      >
        {game?.title}
      </h2>

      {rows.length === 0 ? (
        <p
          className="pixel"
          style={{ fontSize: 12, textAlign: "center", color: "var(--ink-faint)" }}
        >
          Sin puntuaciones todavía
        </p>
      ) : (
        <>
          <div className="podium">
            <PodiumSlot row={rows[1]} place="02" className="silver" />
            <PodiumSlot row={rows[0]} place="01" className="gold" />
            <PodiumSlot row={rows[2]} place="03" className="bronze" />
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              // Keyed by tab too so the row entrance animation replays on tab change, as in the template.
              <div
                key={tab + "-" + r.rank}
                className={["tr", TOP[i]].filter(Boolean).join(" ")}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
