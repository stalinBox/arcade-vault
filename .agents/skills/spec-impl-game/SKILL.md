---
name: spec-impl-game
description: Implements an approved game spec with exactly the same flow as /spec-impl (state validation, spec-NN-slug branch, step by step with pauses, never commits) and, when the last step is done, launches the skin-designer agent on the new game so it ships with classic / neon / retro skins in dark and light mode.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — /spec-impl for a game spec + skins

`/spec-impl-game` is `/spec-impl` plus one final phase: after the implementation, the `skin-designer` agent adds the three skins to the game. It does **not** duplicate `/spec-impl`: it reads it and follows it.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

Games currently registered in `GAME_PLAYERS`:
!`grep -n -A12 "GAME_PLAYERS" "app/jugar/[id]/page.tsx" 2>/dev/null || echo "GAME_PLAYERS not found"`

---

## Instructions

### Phase 0 — Load /spec-impl (mandatory)

Read `.agents/skills/spec-impl/SKILL.md` with the Read tool. Follow its **Phases 1–4 exactly**, with these bindings:

- Its `$ARGUMENTS` is: `$ARGUMENTS`
- Its "session context" is the **Session context** block above (its own `!` lines do not run when the file is read).

Every rule of `/spec-impl` applies unchanged: the "Approved" state gate and its standard error message, the dirty-working-tree prompt, `AutoCreateBranch`, the spec summary, the explicit confirmation before Step 1, one step at a time with a pause after each, ambiguities stop the work, out-of-scope requests are not implemented, and **never commit**.

The only two differences are below.

### Difference 1 — It must be a game spec (right after /spec-impl Phase 1)

Once the spec file is located, check that it adds or modifies a playable game: it mentions `/jugar/<slug>` and/or `lib/<slug>/engine.ts` / `components/<slug>-player.tsx`. Derive `<slug>` from it (the id used in the database and URL).

- If it is not a game spec, stop:

  ```
  ❌ This spec does not describe a playable game.
  Use /spec-impl <NN-slug> for non-game specs.
  ```

- If the slug is ambiguous, ask the user. Do not guess.

Then continue with /spec-impl Phase 2.

### Difference 2 — Replace /spec-impl's closing message with Phase 5

When the user confirms the last step of the plan, do **not** print /spec-impl's final block. Go to Phase 5.

---

### Phase 5 — Skins with @skin-designer

1. Check that `<slug>` is now in `GAME_PLAYERS` (`app/jugar/[id]/page.tsx`) and that `lib/<slug>/engine.ts` and `components/<slug>-player.tsx` exist. If something is missing, stop, report what is missing and do not launch the agent.
2. Tell the user:

   ```
   ✅ All steps of the plan are implemented.
   🎨 Launching @skin-designer <slug> to add the classic / neon / retro skins…
   ```

3. Call the Agent tool with `subagent_type: "skin-designer"` and a prompt like:

   ```
   Mode: <slug>
   Game just implemented from specs/<NN-slug>.md on branch <current branch>.
   Implement the three skins (classic default, neon, retro) in dark and light mode
   following your contract. Do not commit. Finish with npm run lint and report
   the files you touched and anything left pending.
   ```

4. Relay the agent's report to the user, concise: files touched, lint result, pending issues. The agent's output is not shown to the user unless you relay it.
5. Close with:

   ```
   Next step: verify the spec's acceptance criteria one by one, and check the
   three skins in /jugar/<slug> in both dark and light mode.
   If everything passes, update the spec's state to "IMPLEMENTED" and make the
   final commit before merging this branch.
   ```

Still **never commit**, not even after the agent finishes.

---

## Summary of expected behavior

```
/spec-impl-game 11-pong   (state: Aprobado)

  Phase 0  →  Reads .agents/skills/spec-impl/SKILL.md
  1        →  Finds specs/11-pong.md → game spec, slug "pong"
  2        →  State "Aprobado" → ✅ continues
  3        →  git checkout -b spec-11-pong, shows summary
  4        →  Implements step by step with pauses
  5        →  Launches @skin-designer pong → relays report
              Reminds to verify criteria + skins, user commits

/spec-impl-game 03-acerca-contacto-resend

  1        →  Not a game spec → ❌ stops, suggests /spec-impl
```
