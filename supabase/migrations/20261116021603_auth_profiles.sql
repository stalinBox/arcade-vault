create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,12}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);
-- Sin INSERT/UPDATE/DELETE para clientes: solo el trigger escribe.

-- Crea el perfil de cada usuario nuevo. Nunca falla por usuario repetido:
-- si el nombre está ocupado prueba base1, base2… recortando a 12 caracteres.
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
