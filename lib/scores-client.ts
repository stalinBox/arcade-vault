import { createClient } from "@/lib/supabase/client";

/** Insert rechazado por RLS/grants: la petición llegó sin una sesión válida. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Tu sesión expiró, vuelve a iniciar sesión");
    this.name = "SessionExpiredError";
  }
}

// `user_id` lo pone el default de la columna (auth.uid()); la política exige
// además que `player_name` sea el username del perfil (SPEC 15).
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
  // 42501 = insufficient_privilege: RLS o falta de grant (petición como anon).
  if (error?.code === "42501") throw new SessionExpiredError();
  if (error) throw error;
}
