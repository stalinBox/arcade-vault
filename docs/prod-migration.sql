-- Arcade Vault: migración manual a producción (solo estructura + datos de games).
-- Equivale a aplicar en orden las 8 migraciones de supabase/migrations/ (estado final).
-- Ejecutar UNA vez en el SQL Editor de prod, en un proyecto vacío.
-- No copia scores, auth.users ni profiles.

begin;

-- 1. Tablas ---------------------------------------------------------------

create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan', 'magenta', 'green', 'yellow')),
  created_at timestamptz not null default now()
);

create table public.scores (
  id          bigint generated always as identity primary key,
  game_id     text not null references public.games (id),
  player_name text not null check (player_name = btrim(player_name) and char_length(player_name) between 1 and 12),
  score       integer not null check (score between 0 and 1000000),
  created_at  timestamptz not null default now()
);

create index scores_game_ranking_idx on public.scores (game_id, score desc, created_at asc);
create index scores_recent_idx on public.scores (created_at desc);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,12}$'),
  created_at timestamptz not null default now()
);

-- 2. RLS y políticas ------------------------------------------------------

alter table public.games enable row level security;
alter table public.scores enable row level security;
alter table public.profiles enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);

create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

-- Versión final (SPEC 13): valida el insert por completo.
create policy "scores_insert_public" on public.scores
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.games g where g.id = game_id)
    and player_name = btrim(player_name)
    and char_length(player_name) between 1 and 12
    and score between 0 and 1000000
  );

create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);

-- Sin políticas de UPDATE ni DELETE en ninguna tabla.

-- 3. Perfil automático al registrarse -------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  n         integer := 0;
begin
  base := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    ''
  );
  base := left(regexp_replace(lower(base), '[^a-z0-9_]', '', 'g'), 12);
  if char_length(base) < 3 then
    base := 'jugador';
  end if;

  candidate := base;
  loop
    insert into public.profiles (id, username)
    values (new.id, candidate)
    on conflict (username) do nothing;
    exit when found;

    n := n + 1;
    candidate := left(base, 12 - char_length(n::text)) || n::text;
  end loop;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Mínimo privilegio ----------------------------------------------------
-- Quedan: select en games/profiles/scores e insert en scores.

revoke insert, update, delete, truncate, trigger, references
  on public.games, public.profiles
  from anon, authenticated;

revoke update, delete, truncate, trigger, references
  on public.scores
  from anon, authenticated;

-- rls_auto_enable() la crea Supabase/dashboard, no este repo. Solo se revoca si existe.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;

-- 5. Datos: games ---------------------------------------------------------

insert into public.games (id, title, short, long, cat, cover, color) values
(
  'asteroids',
  'ASTEROIDES',
  'Pulveriza asteroides en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir asteroides en fragmentos cada vez más pequeños. Limpia el campo para subir de nivel.',
  'SHOOTER',
  'cover-asteroids',
  'yellow'
),
(
  'blocks',
  'BLOQUES',
  'Encaja piezas y limpia líneas.',
  'Siete piezas caen sobre un pozo de 10×20. Gíralas, encájalas y completa filas para borrarlas. Cada 10 líneas sube el nivel y la caída se acelera.',
  'PUZZLE',
  'cover-blocks',
  'magenta'
),
(
  'rompebloques',
  'ROMPEBLOQUES',
  'Rebota la bola y rompe todos los bloques.',
  'Mueve la paleta para que la bola no caiga y rompe los bloques de tres mapas. Algunos aguantan varios golpes y dan más puntos. Elige entre tres dificultades: la bola se acelera en cada mapa.',
  'ARCADE',
  'cover-rompebloques',
  'cyan'
),
(
  'snake',
  'SNAKE',
  'Come, crece y no toques tu propia cola.',
  'Guía la serpiente por el tablero y come frutas para crecer. Las paredes se unen: si sales por un borde apareces en el opuesto. Termina al chocar contigo misma.',
  'ARCADE',
  'cover-snake',
  'green'
),
(
  'paddle-duel',
  'DUELO PALA',
  'Duelo de palas contra la CPU: alarga el rally y encadena puntos.',
  'Mueve tu pala y devuelve la bola a la CPU: cada devolución seguida del rally vale más, y los puntos ganados en racha multiplican el premio. Pulsa Espacio justo antes del golpe para un tiro potente. Tienes tres vidas y la CPU mejora cada dos puntos que le ganas.',
  'VERSUS',
  'cover-paddle-duel',
  'cyan'
)
on conflict (id) do nothing;

commit;

-- Verificación rápida (ejecutar aparte):
--   select id from public.games order by id;                       -- 5 filas
--   select grantee, table_name, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon', 'authenticated')
--   order by 2, 1, 3;                                              -- select; scores también insert
