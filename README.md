## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```
## Supabase

Copia `.env.template` a `.env.local` y completa las variables de Supabase (panel del proyecto → Settings → API):

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave publicable (`sb_publishable_...`).

Ambas son públicas por diseño; la seguridad la dan las políticas RLS. Nunca uses la clave `service_role` en el cliente.

CLI (sin instalación, vía `npx`):

```bash
npx supabase login
npx supabase link --project-ref wocydpxpwcejsqwnqzgy
npx supabase migration new nombre_de_la_migracion
```
