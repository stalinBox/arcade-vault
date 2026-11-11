insert into public.games (id, title, short, long, cat, cover, color)
values (
  'rompebloques',
  'ROMPEBLOQUES',
  'Rebota la bola y rompe todos los bloques.',
  'Mueve la paleta para que la bola no caiga y rompe los bloques de tres mapas. Algunos aguantan varios golpes y dan más puntos. Elige entre tres dificultades: la bola se acelera en cada mapa.',
  'ARCADE',
  'cover-rompebloques',
  'cyan'
)
on conflict (id) do nothing;
