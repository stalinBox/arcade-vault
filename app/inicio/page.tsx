import { Suspense } from "react";
import { Landing } from "@/components/landing";
import { getCatalog } from "@/lib/games";
import { getLatestScores, getTopScores } from "@/lib/scores";

async function LandingLoader() {
  const [games, latest, top] = await Promise.all([
    getCatalog(),
    getLatestScores(6),
    getTopScores("asteroids", 5),
  ]);
  return <Landing games={games} latest={latest} top={top} />;
}

// Lecturas con cookies (cliente de servidor): dentro de <Suspense> (Cache Components).
export default function Inicio() {
  return (
    <Suspense fallback={<div className="home" aria-busy="true" />}>
      <LandingLoader />
    </Suspense>
  );
}
