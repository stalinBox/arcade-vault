insert into public.games (id, title, short, long, cat, cover, color)
values (
  'snake',
  'SNAKE',
  'Come, crece y no toques tu propia cola.',
  'Guía la serpiente por el tablero y come frutas para crecer. Las paredes se unen: si sales por un borde apareces en el opuesto. Termina al chocar contigo misma.',
  'ARCADE',
  'cover-snake',
  'green'
)
on conflict (id) do nothing;
