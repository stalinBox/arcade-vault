# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server (Turbopack)
- `npm run build` — production build (also the closest thing to a type check; there is no separate `tsc` script)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, Next core-web-vitals + TypeScript rules)

There is no test runner configured. No test command exists to run a single test.

## Non-obvious setup

- `AGENTS.md` mandates reading the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. This is Next 16.4.x, which has breaking changes from earlier versions. Heed deprecation notices.
- `next.config.ts` enables experimental/canary-style flags: `experimental.agentFeedback`, `cacheComponents`, `partialPrefetching`, and a custom Turbopack CSS rule that routes `*.css` through `@tailwindcss/turbopack`. Check these against the Next docs before changing routing, caching, or styling setup.
- `AGENTS.md` contains a `BEGIN/END:nextjs-agent-rules` block that `next dev` rewrites. Keep it intact.
- `next-env.d.ts` is generated and git-ignored; do not edit it.

## Skills
Usa tiempre /frontend-desing para diseñar una interfaz de usuario.

## Architecture

Current state: early scaffold. The App Router lives in `app/` (`layout.tsx` root layout with Geist fonts and Tailwind v4 via `globals.css`; `page.tsx` is still the stock Create Next App home page). The `@/*` path alias maps to the repo root. There is no data layer, auth, API routes, or game logic yet.

The README describes the product as an online game platform where players compete for points, and says the project follows Spec Driven Design with `/spec` and `/spec-impl` directories. Neither directory exists yet. Treat those as intended structure, not existing code, and check with the user before creating them.

Documentation and UI copy in the README are in Spanish; the code is currently in English.
