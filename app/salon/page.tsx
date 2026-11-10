import { Suspense } from "react";
import { HallOfFame } from "@/components/hall-of-fame";
import { getCatalog } from "@/lib/games";
import { getTopScores } from "@/lib/scores";

async function HallLoader() {
  const games = await getCatalog();
  const rows = await Promise.all(games.map((g) => getTopScores(g.id, 12)));
  const scores = Object.fromEntries(games.map((g, i) => [g.id, rows[i]]));
  return <HallOfFame games={games} scores={scores} />;
}

// Lecturas con cookies (cliente de servidor): dentro de <Suspense> (Cache Components).
export default function SalonPage() {
  return (
    <Suspense fallback={<div className="av-hall" aria-busy="true" />}>
      <HallLoader />
    </Suspense>
  );
}
