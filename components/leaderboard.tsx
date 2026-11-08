import type { ScoreRow } from "@/lib/scores";

const TOP = ["top1", "top2", "top3"];

export function Leaderboard({ rows, title = "MEJORES PUNTUACIONES" }: { rows: ScoreRow[]; title?: string }) {
  return (
    <div className="leaderboard">
      <h3>{title}</h3>
      {rows.map((r, i) => (
        <div key={r.name} className={["lb-row", TOP[i]].filter(Boolean).join(" ")}>
          <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
          <div className="pl">
            {r.name}
            <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>{r.date}</div>
          </div>
          <div className="sc">{r.score.toLocaleString("es-ES")}</div>
        </div>
      ))}
    </div>
  );
}
