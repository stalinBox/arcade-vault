-- Auditoría de seguridad 2026-11-15 (security-auditor), hallazgo de severidad baja.
--
-- anon y authenticated conservan los privilegios por defecto de Supabase
-- (INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES) en games, profiles y
-- scores. Hoy RLS los bloquea (no hay políticas de escritura salvo el INSERT de
-- scores), pero si una política se relaja o RLS se desactiva por error quedarían
-- abiertos, y TRUNCATE no pasa por RLS. Mínimo privilegio: los clientes solo leen,
-- y en scores además insertan (ScoreForm como invitado o con sesión).
--
-- handle_new_user (security definer, owner postgres) sigue escribiendo profiles.

revoke insert, update, delete, truncate, trigger, references
  on public.games, public.profiles
  from anon, authenticated;

revoke update, delete, truncate, trigger, references
  on public.scores
  from anon, authenticated;

-- Quedan: select en games/profiles/scores e insert en scores.
