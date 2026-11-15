insert into public.games (id, title, short, long, cat, cover, color)
values (
  'paddle-duel',
  'DUELO PALA',
  'Duelo de palas contra la CPU: alarga el rally y encadena puntos.',
  'Mueve tu pala y devuelve la bola a la CPU: cada devolución seguida del rally vale más, y los puntos ganados en racha multiplican el premio. Pulsa Espacio justo antes del golpe para un tiro potente. Tienes tres vidas y la CPU mejora cada dos puntos que le ganas.',
  'VERSUS',
  'cover-paddle-duel',
  'cyan'
)
on conflict (id) do nothing;
