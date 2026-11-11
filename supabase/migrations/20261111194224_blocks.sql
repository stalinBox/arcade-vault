insert into public.games (id, title, short, long, cat, cover, color)
values (
  'blocks',
  'BLOQUES',
  'Encaja piezas y limpia líneas.',
  'Siete piezas caen sobre un pozo de 10×20. Gíralas, encájalas y completa filas para borrarlas. Cada 10 líneas sube el nivel y la caída se acelera.',
  'PUZZLE',
  'cover-blocks',
  'magenta'
)
on conflict (id) do nothing;
