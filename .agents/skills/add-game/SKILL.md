---
name: add-game
description: Designs the spec for a new game (ported from references/started-games/ or designed from scratch) with its leaderboard, catalog row and platform integration. Builds on /spec and the pattern of SPEC 05/06/07. Only writes the spec; never code.
disable-model-invocation: true
argument-hint: "<slug | folder in references/started-games | one-sentence idea>"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /add-game — Spec designer for a new game + leaderboard

## Session context

Today's date (use this for the spec header, never guess it):
!`date +%F`

Existing specs:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist yet"`

Reference games available:
!`ls references/started-games/ 2>/dev/null || echo "none"`

Migrations, game engines and shared components already in the repo:
!`ls supabase/migrations lib components 2>/dev/null`

---

`/add-game` is `/spec` specialised for **adding one game to the platform**. It asks the game-specific questions, then writes a spec that already carries the integration pattern settled in SPEC 05, 06 and 07. **You never write code, run migrations or touch the database.** Implementation is done later by `/spec-impl NN-slug`.

## Step 0 — Read `/spec` first (mandatory)

Before anything else, read these two files completely:

1. `.agents/skills/spec/SKILL.md`
2. `.agents/skills/spec/template.md`

Follow them as the base: phases, how to ask questions (blocks of 3–5, `AskUserQuestion`, recommendation first), when to stop asking, section order, numbering, date source, `Borrador` state, `specs/.spec-config.yml` seeding, and the hard rules. This skill only **adds** the game-specific knowledge below. If anything here conflicts with `/spec`, `/spec` wins. Do not copy its text into the spec; apply it.

Never skip the questions phase, even if the user's argument looks complete.

## Phase 1 — Context

1. Read `CLAUDE.md` / `AGENTS.md` (project rules; Next.js docs in `node_modules/next/dist/docs/` are mandatory before Next code, so the spec must say so).
2. Read `specs/05-asteroids-jugable.md`, `specs/06-renombrar-asteroides.md` and `specs/07-leaderboard-y-juegos-bd.md`. They are the canonical pattern and the language/format model (Spanish, `**Estado:**` / `**Fecha:**` / `**Depende de:**` / `**Objetivo:**` header). If a newer game spec exists in `specs/`, read the latest one too.
3. Resolve `$ARGUMENTS`:
   - Folder in `references/started-games/` (full name, number or slug): read its `CLAUDE.md`, `README.md`, `game.js` (and `index.html`, `style.css`, `assets/`, `specs/` if present). Note state variables, controls, scoring, lives/levels, sounds, assets.
   - Free idea: no reference; the spec must define the mechanics itself (keep them small).
   - Empty: ask for a one-sentence description first (as `/spec` does).
4. Check whether the game already exists (`id` in `supabase/migrations/*.sql`, `lib/<slug>/`). If so, stop and tell the user.
5. Check the shared pieces to decide the spec's plan:
   - `components/score-form.tsx` exists? If not → the spec includes the refactor step (see below).
   - `app/jugar/[id]/page.tsx` selects the player by a fixed `if` on one id? If so → the spec includes replacing it with an `id → player component` map.

## Phase 2 — Game-specific questions

Cover what `/spec` asks, plus these. Ask in blocks; use what the reference already answers instead of asking it.

- **Identity:** `id`/slug (kebab-case, English like `asteroids`), `title` (uppercase Spanish like `ASTEROIDES`), `short` (one line), `long` (2–3 sentences, only mechanics the game really has).
- **Catalog fields** (constrained by `check` in `games`): `cat` ∈ `ARCADE | PUZZLE | SHOOTER | VERSUS`; `color` ∈ `cyan | magenta | green | yellow`; `cover` = `cover-<slug>` and a description of the CSS cover art (base, `::after`, `::before`).
- **Source:** port of the reference as-is, or changes? Mechanics from the reference to drop (power-ups, sound, assets). Anything to leave out goes in "NO incluido".
- **Controls:** keyboard only (touch is out unless the user insists, then it deserves its own spec).
- **HUD:** which of `score / lives / level` the game really has. Adapt the HUD labels; do not invent stats.
- **Scoring:** how score grows; realistic maximum. Hard cap is `1 000 000` (`scores.score` check). If the game can exceed it, ask how to clamp — do not change the check here.
- **Game over:** what ends a match; whether `FIN` button applies.
- **Assets/sound:** from the reference or none.

Stop asking when you can answer the three `/spec` questions (files, first/last step, verification).

**Split into another spec** (do not include it here) if the user asks for: a new table or column, RLS or policy changes, auth / `user_id`, per-game score rules enforced in the DB, rate limiting, moderation, Realtime, `service_role`. This skill reuses the existing `games` + `scores` tables unchanged.

## Phase 3 — Write the spec

Read `.agents/skills/add-game/template.md` and fill it with the answers. It already contains the invariants of the pattern; replace every `<placeholder>`, delete conditional blocks that do not apply, and keep the section order of `/spec`.

Rules:

- Language and header format of the existing specs in `specs/` (Spanish, `**Estado:** Borrador`).
- `Depende de:` lists SPEC 01, 04, 05 and 07 (platform, Supabase clients, engine pattern, `games`/`scores`) plus any later spec the game actually relies on. Verify each referenced file exists.
- Concrete names everywhere (`lib/<slug>/engine.ts`, `.cover-<slug>`, the migration file name pattern). No TODOs. No long code: snippets for signatures and the SQL row only.
- The acceptance criteria are boolean and include the standard set from the template.

## Phase 4 — Save

Follow `/spec` Phase 4: next `NN-` number from `specs/`, slug from the objective (the game slug is a good choice, e.g. `08-tetris-jugable`), write directly to `specs/NN-slug.md` without asking, state `Borrador`, create `specs/.spec-config.yml` only if missing.

Then confirm to the user:

- Path of the file; it is in `Borrador` — they change it to `Aprobado` after re-reading it.
- Whether the plan includes the shared refactor (`ScoreForm` + player map) and why.
- Next step: `/spec-impl NN-slug`.
- **Stop.** Do not propose implementing it or write any code.

## Hard rules

- Never write code, SQL files, migrations, or edit anything outside `specs/`.
- Never run `supabase` commands or touch the database.
- Never modify `references/`.
- Never mark the spec `Aprobado`.
- Never assume a decision the user did not confirm; ask in Phase 2.
- One game per spec. If the user lists several games, produce one spec per game (ask which first).
