import { createClient } from "@/lib/supabase/server";
import type { ScoreRow } from "./scores-types";

// Solo servidor. Los componentes cliente importan de "./scores-types" y "./scores-client".
export * from "./scores-types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getUTCFullYear()}`;
}

export async function getTopScores(
  gameId: string,
  limit = 12,
): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data.map((r, i) => ({
    rank: i + 1,
    name: r.player_name,
    score: r.score,
    date: formatDate(r.created_at),
  }));
}

export async function getLatestScores(
  limit = 6,
): Promise<(ScoreRow & { game: string })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("game_id, player_name, score, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((r, i) => ({
    rank: i + 1,
    name: r.player_name,
    score: r.score,
    date: formatDate(r.created_at),
    game: r.game_id,
  }));
}
