import { createClient } from "@/lib/supabase/server";
import type { Game, GameCategory, GameColor } from "./games-types";

// Solo servidor. Los componentes cliente importan tipos y CATS de "./games-types".
export * from "./games-types";

function formatPlays(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

interface GameRow {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
}

async function withStats(row: GameRow): Promise<Game> {
  const supabase = await createClient();
  const [best, plays] = await Promise.all([
    supabase
      .from("scores")
      .select("score")
      .eq("game_id", row.id)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("game_id", row.id),
  ]);
  if (best.error) throw best.error;
  if (plays.error) throw plays.error;
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as GameCategory,
    cover: row.cover,
    color: row.color as GameColor,
    best: best.data?.score ?? 0,
    plays: formatPlays(plays.count ?? 0),
  };
}

const GAME_COLUMNS = "id, title, short, long, cat, cover, color";

export async function getCatalog(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return Promise.all(data.map(withStats));
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? withStats(data) : null;
}
