# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server (Turbopack)
- `npm run build` — production build (also the closest thing to a type check; there is no separate `tsc` script). Needs the Supabase env vars: `generateStaticParams` reads `games` at build time.
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, Next core-web-vitals + TypeScript rules)
- `npx supabase migration new <name>` — new migration file in `supabase/migrations/`
- `npx supabase db push --remote` — apply migrations to the hosted project (without `--remote` the CLI targets the local stack). If the CLI has no session, the user runs `npx supabase login`; fallback is `apply_migration` through the Supabase MCP with the same SQL, keeping the file in git.

There is no test runner configured. No test command exists to run a single test.

## Non-obvious setup

- `AGENTS.md` mandates reading the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. This is Next 16.4.x, which has breaking changes from earlier versions. Heed deprecation notices.
- `next.config.ts` enables experimental/canary-style flags: `experimental.agentFeedback`, `cacheComponents`, `partialPrefetching`, and a custom Turbopack CSS rule that routes `*.css` through `@tailwindcss/turbopack`. It also redirects `/` to `/inicio` (there is no `app/page.tsx`). Check these against the Next docs before changing routing, caching, or styling setup.
- `AGENTS.md` contains `BEGIN/END:nextjs-agent-rules` and `BEGIN/END:nextjs-agent-feedback` blocks that `next dev` rewrites. Keep them intact.
- `next-env.d.ts` is generated and git-ignored; do not edit it.
- Env vars live in `.env.local` (git-ignored); `.env.template` lists them: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (optional `CONTACT_FROM_EMAIL`). Never use the `service_role` key.
- `.mcp.json` registers the Supabase MCP server for the hosted project. Use it to inspect tables, advisors and logs.
- A `PostToolUse` hook (`.claude/hooks/format-lint.sh`) runs Prettier and `eslint --fix` on every file written or edited (`.ts/.tsx/.js/.mjs`; Prettier only for `.md`). ESLint errors come back as hook feedback and must be fixed.

## Skills

Skills live in `.agents/skills/` and are symlinked into `.claude/skills/`. `skills-lock.json` pins the ones installed with `npx skills` (`frontend-design`, `spec`, `spec-impl`); `add-game` and `spec-impl-game` are local to this repo.

- `/frontend-design` — usa siempre esta skill para diseñar una interfaz de usuario.
- `/spec <idea>` — designs a spec through questions and writes `specs/NN-slug.md` in state `Borrador`. Never writes code.
- `/spec-impl <NN-slug>` — implements a spec whose state is `Aprobado`: creates branch `spec-NN-slug` (`AutoCreateBranch` in `specs/.spec-config.yml`), goes step by step with pauses, never commits on its own.
- `/spec-impl-game <NN-slug>` — same flow as `/spec-impl` (reads and follows its SKILL.md) for a game spec; after the last step it launches the `skin-designer` agent on the game. Never commits.
- `/add-game <slug | reference folder | idea>` — `/spec` specialised for one new game with its leaderboard. Uses `.agents/skills/add-game/template.md`. Only writes the spec.

## Agents

Subagents live in `.claude/agents/`. Read the agent file for modes, contract and rules. A new agent file only registers after restarting the session.

- `game-planner` — proposes which game to add next; never writes specs or code. → `.claude/agents/game-planner.md`
- `game-jam` — topic → one original game plus ≥2 specs in `specs/game-jam/<id>/`; never writes code. → `.claude/agents/game-jam.md`
- `skin-designer` — audits/implements `classic` / `neon` / `retro` skins in dark and light mode. → `.claude/agents/skin-designer.md`
- `game-performance-booster` — audits/fixes one game's runtime performance against SPEC 11. → `.claude/agents/game-performance-booster.md`

## Spec-driven workflow

Every feature starts as a spec in `specs/` (Spanish, header `**Estado:**` / `**Fecha:**` / `**Depende de:**` / `**Objetivo:**`). The human moves the state from `Borrador` to `Aprobado`; after the acceptance criteria pass it becomes `IMPLEMENTED`. One branch and one PR per spec. Specs 01–10 and `specs/game-jam/paddle-duel/` (GJ-01, GJ-02) are implemented; SPEC 11 is merged but still marked `APPROVED`. `specs/game-jam/<id>/` holds specs written by the `game-jam` agent. Read the latest game spec (GJ-02) before touching the game pattern.

## Architecture

Arcade Vault is a retro game portal: players play canvas games as guests and save scores to a public leaderboard. UI copy is in Spanish; code and identifiers are in English.

### Routes (`app/`)

| Route                             | Content                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/inicio`                         | Landing: catalog, latest scores, top scores                                                                                                                      |
| `/biblioteca`                     | Game library with category filter (see `references/implemented-games.md`) when you need to check which games are implemented and add more games.                 |
| `/juego/[id]`                     | Game detail + top 10                                                                                                                                             |
| `/jugar/[id]`                     | Player. `GAME_PLAYERS` maps `id → component`; ids without an entry show a static CRT placeholder                                                                 |
| `/salon`                          | Hall of fame, top 12 per game                                                                                                                                    |
| `/acerca`                         | About + contact form (server action `sendContact`, Resend)                                                                                                       |
| `/auth`                           | Login/signup (Supabase Auth: email+password with mandatory email confirmation, Google/GitHub OAuth). `?next=` return path; redirects to `/inicio` when signed in |
| `/auth/confirm`, `/auth/callback` | Route handlers: email confirmation link (`verifyOtp`) and OAuth return (`exchangeCodeForSession`); both redirect to `safeNext(next)` or `/auth?error=…`          |

`app/layout.tsx` wraps every page with `Nav` and `Footer` and loads the fonts (Press Start 2P, JetBrains Mono, Courier Prime).

Pages are thin: a sync default export renders `<Suspense>` around an async loader that fetches and passes props to a component in `components/`. This is required by Cache Components, because the server Supabase client reads cookies and `params` must be awaited inside the boundary. Follow the same shape for new pages.

### Data layer (Supabase)

- Tables (`supabase/migrations/`): `games` (catalog row per game; `cat` ∈ `ARCADE | PUZZLE | SHOOTER | VERSUS`, `color` ∈ `cyan | magenta | green | yellow`, `cover` = CSS class) and `scores` (`game_id`, `player_name` 1–12 chars trimmed, `score` 0–1 000 000). RLS: public select on both, public insert on `scores`, no update or delete.
- `profiles` (`id` → `auth.users`, `username` unique `^[a-z0-9_]{3,12}$`): one row per user, written only by the `security definer` trigger `handle_new_user` on `auth.users` (username from signup metadata, GitHub `user_name` or email local part, sanitized, numeric suffix on collision). RLS: public select, no client writes. `scores` has no `user_id` yet.
- Auth: server actions in `app/auth/actions.ts` (`signUp`, `signIn`, `signInWithOAuth`); `safeNext()` in `lib/auth-redirect.ts` validates every redirect target (internal paths only). Client side, `useCurrentUser()` in `lib/auth-client.ts` (nav, `ScoreForm` prefill); sign-out runs in the browser client from `components/nav.tsx` so `onAuthStateChange` updates the nav. Supabase dashboard setup (redirect URLs, providers, confirm-signup template) is in SPEC 12 §3.
- Three clients in `lib/supabase/`: `server.ts` (cookies, Server Components and actions), `client.ts` (browser), `static.ts` (no cookies, build-time only, used by `generateStaticParams`). `database.types.ts` is generated with `supabase gen types`; regenerate it after schema changes.
- `proxy.ts` (Next 16 name for middleware) refreshes the Supabase session cookies. It does not protect or redirect routes.
- `lib/games.ts` and `lib/scores.ts` are server-only reads (`getCatalog`, `getGame`, `getGameIds`, `getTopScores`, `getLatestScores`). Client components import types from `lib/games-types.ts` / `lib/scores-types.ts` and write through `saveScore` in `lib/scores-client.ts`.

### Game pattern

Five playable games: `asteroids`, `blocks`, `paddle-duel`, `rompebloques`, `snake`. Each one has the same pieces (exception: `blocks` has no skins yet — no `skins.ts`, no `SkinPicker`):

1. `lib/<slug>/engine.ts` — no global DOM access. Drives frames with `createGameLoop` from `lib/game-loop.ts` (SPEC 11: sleeps when idle, `wake()` on state change). `create<Game>(canvas, callbacks, { skin, mode }?)` returns a controller (`togglePause`, `restart`, `end`, `destroy`, `setSkin(skin, mode)`). `setSkin` swaps the palette in place without touching the match. State lives in the closure, not in module variables. No color literals: every color comes from the active palette. Callbacks: `onStats`, `onGameOver`, `onPauseChange`. Optional `sprites.ts` for sprite atlases.
2. `lib/<slug>/skins.ts` — `Palette` type and `SKIN_PALETTES: Record<SkinId, Record<ColorMode, Palette>>` for skins `classic` (default, the original look) / `neon` / `retro`, each in `dark` and `light`. Shared types and hooks (`useSkin(gameId)`, `useColorMode()`, `SKINS`) live in `lib/skins.ts`. Contract and contrast rules: `.claude/agents/skin-designer.md`.
3. `components/<slug>-player.tsx` — client component: platform HUD (`.player-hud`) with `<SkinPicker>` (`components/skin-picker.tsx`, persisted in `av:skin:<slug>`), canvas inside `.crt.crt-game`, and `ScoreForm` when the match ends with `score > 0`. Calls `game.setSkin(skin, mode)` when skin or color mode changes. `destroy()` on unmount clears rAF and listeners.
4. A migration that inserts the row in `games` (`on conflict (id) do nothing`). No new tables.
5. `.cover-<slug>` in `app/globals.css` (base, `::before`, `::after`), pure CSS cover art.
6. An entry in `GAME_PLAYERS` in `app/jugar/[id]/page.tsx`.
7. Assets, if any, in `public/games/<slug>/`.

Library, detail, hall of fame and landing read `games`/`scores`, so a new game shows up there with no extra code.

### Styling

Tailwind v4 is imported in `app/globals.css`, but almost all UI uses the hand-written classes defined there (theme variables in `:root`, `.btn`, `.crt`, `.player-hud`, `.cover-*`, one section per screen). Reuse those classes before adding utilities.

Light/dark: `data-theme="dark" | "light"` on `<html>` (default `dark`, persisted in `localStorage` key `av:theme`). An inline script in `app/layout.tsx` applies it before paint; the toggle lives in `components/nav.tsx`. `:root[data-theme="light"]` in `app/globals.css` redefines the tokens; `.crt`, card covers and the terminal stay dark in both modes (dark tokens re-declared on them). Fix light-mode issues with tokens, not utilities.

### Other directories

- `references/` — read-only source material: `started-games/` (original JS games that were ported), `templates/` (the original visual design in JSX/CSS), `source-assets/`. Never modify it, except `games-suggestions-todo.md`, which the `game-planner` agent maintains.
- `demos/` — scratch component, not used by the app.
