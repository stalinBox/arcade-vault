import { createClient } from "@/lib/supabase/client";

export async function saveScore(
  gameId: string,
  playerName: string,
  score: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("scores").insert({
    game_id: gameId,
    player_name: playerName.trim(),
    score,
  });
  if (error) throw error;
}
