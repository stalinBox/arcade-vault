-- SPEC 15 — Puntaje solo para usuarios autenticados.
--
-- Solo authenticated inserta en scores, con user_id = auth.uid() (default de la
-- columna) y player_name = su profiles.username. Filas antiguas quedan con
-- user_id null. anon conserva select.

alter table public.scores
  add column user_id uuid references auth.users (id) on delete set null default auth.uid();

drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_authenticated" on public.scores
  for insert to authenticated
  with check (
    exists (select 1 from public.games g where g.id = game_id)
    and score between 0 and 1000000
    and user_id = (select auth.uid())
    and player_name = (select p.username from public.profiles p where p.id = (select auth.uid()))
  );

revoke insert on public.scores from anon;
