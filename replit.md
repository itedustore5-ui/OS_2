# Workspace

## Overview

pnpm workspace monorepo using TypeScript. The primary user-facing artifact is **Srpski Kviz**, a Serbian quiz web app with login, student dashboard, quiz flow, scoreboard, and admin panel.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: JWT-style bearer tokens signed with `SESSION_SECRET`; passwords hashed with bcryptjs while admin-visible plaintext password field is stored to satisfy the requested admin panel behavior
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Srpski Kviz Notes

- Default accounts:
  - Admin: `admin` / `Admin2024!`
  - Student: `student1` / `kviz2024`
- Quiz images are manually uploaded to `artifacts/srpski-kviz/public/images/`.
- Image files should be named by question number, e.g. `102.png`, `103.png`, and referenced as `/images/102.png`.
- Questions used by the API live in `artifacts/api-server/src/data/questions.ts`.
- A frontend format example is kept in `artifacts/srpski-kviz/src/data/questions.ts` for replacing quiz content later.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
