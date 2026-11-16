-- SPEC 13 — Seguridad básica.

drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_public" on public.scores
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.games g where g.id = game_id)
    and player_name = btrim(player_name)
    and char_length(player_name) between 1 and 12
    and score between 0 and 1000000
  );

-- Función del event trigger ensure_rls (creada desde dashboard). El trigger sigue
-- funcionando: los event triggers no comprueban EXECUTE del rol que lanza el DDL.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
