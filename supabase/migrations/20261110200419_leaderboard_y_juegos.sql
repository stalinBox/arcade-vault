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

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);

create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

create policy "scores_insert_public" on public.scores
  for insert to anon, authenticated with check (true);

-- Sin políticas de UPDATE ni DELETE: nadie puede modificar ni borrar puntuaciones.

insert into public.games (id, title, short, long, cat, cover, color)
values (
  'asteroids',
  'ASTEROIDES',
  'Pulveriza asteroides en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir asteroides en fragmentos cada vez más pequeños. Limpia el campo para subir de nivel.',
  'SHOOTER',
  'cover-asteroids',
  'yellow'
)
on conflict (id) do nothing;
