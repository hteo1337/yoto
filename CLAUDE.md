# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Yoto Sync: a React Router v7 (framework mode, SSR) app that imports audio from YouTube videos/playlists onto Yoto cards. It runs on Cloudflare Workers; yt-dlp + ffmpeg run in a Cloudflare Container. This repo is a fork (`origin` = hteo1337/yoto, `upstream` = bradgarropy/yoto).

## Commands

```bash
npm run dev            # vite dev on http://localhost:3000 (needs Docker running for the Sandbox container)
npm run build          # react-router build
npm run deploy         # build + wrangler deploy
npm run build:selfhost # separate Node SSR/client build to build-selfhost/
npm run start:selfhost # Node server (requires PUBLIC_ORIGIN and app env vars)
npm test               # vitest run
npx vitest run app/lib/youtube.test.ts        # single file
npx vitest run -t "name of test"              # single test by name
npm run lint           # eslint (@bradgarropy/eslint-config)
npm run format         # prettier --check (format:fix to write)
npm run typecheck      # react-router typegen + wrangler types + tsc
npm run typecheck:ci   # same without wrangler types (what CI runs)
npm run typegen        # regenerate .react-router/ types and worker-configuration.d.ts
```

CI (`.github/workflows/ci.yml`, Node 22) runs format, lint, typecheck:ci, test in that order.

Secrets for local dev: copy `.env.example` to `.env` (`YOTO_AUTH_SECRET`, `RESEND_API_KEY`). `YOTO_CLIENT_ID` is a plain var in `wrangler.jsonc`. After changing bindings in `wrangler.jsonc`, run `npm run typegen`; `worker-configuration.d.ts` is generated, never edit or read it in full.

## Architecture

**Entry point.** `workers/app.ts` is the Worker `fetch` handler. It puts `{env, ctx}` into a `RouterContextProvider` under `cloudflareContext` (`app/lib/cloudflare-context.ts`) and also re-exports the Cloudflare classes `Sandbox`, `ImportWorkflow`, `ImportProgress`. Loaders/actions read bindings via `context.get(cloudflareContext).env`, never globals.

**Routes** are declared explicitly in `app/routes.ts` (not file-based). `/cards` and `/cards/:id` sit under `routes/layout.protected.tsx`, which applies `authMiddleware` (`app/middleware/auth.server.ts`) using React Router v8 middleware (`future.v8_middleware`); it exposes an authenticated Yoto SDK via `authContext` and appends any refreshed `Set-Cookie`. `api/*` routes do their own auth check.

**Auth.** OAuth 2.0 Authorization Code + PKCE against Yoto (`app/lib/auth.server.ts`). `redirect_uri` is derived from the request origin (`<origin>/auth/callback`), so every host the app is served from must be registered with the Yoto client. Tokens live only in an AES-256-GCM encrypted HTTP-only cookie (`auth-cookie.server.ts`, keyed by `YOTO_AUTH_SECRET`); OAuth state/verifier use a separate short-lived cookie (`oauth-state-cookie.server.ts`). There is no database. (README's "confirm the device code" login steps are stale.)

**Import pipeline** (the core, spans several files):

1. `POST /api/import/:cardId` (`routes/api.import.$cardId.tsx`) validates input (`app/schemas/import.ts`), encrypts the user's token into an import credential (`import-credential.server.ts`) and starts a Cloudflare Workflow via `env.IMPORT_WORKFLOW.create`. It also reattaches to an in-flight import for the card.
2. `workers/import-workflow.ts` (`ImportWorkflow`) runs durable steps: inspect video → check card capacity → process audio per track → update card. Step logic lives in `app/lib/import.server.ts`; container commands live in `app/lib/sandbox.server.ts` (`getSandbox(env.SANDBOX, id)` running yt-dlp/ffmpeg, image from `Dockerfile.sandbox`). The sandbox is destroyed at the end.
3. Progress is pushed to the `ImportProgress` Durable Object (`workers/import-progress.ts`, one per import id), which serves it as Server-Sent Events; `GET /api/imports/:importId` proxies that stream to the browser.

Pure helpers shared by client and server sit in non-`.server` modules (`import.ts`, `youtube.ts`, `card-utils.ts`); anything touching env, secrets or the SDK is `*.server.ts`.

**Self-host.** `vite.selfhost.config.ts` omits the Cloudflare plugin and aliases the two Cloudflare modules to `selfhost/shims/`. `selfhost/server.ts` serves static assets and SSR in one bundle, sets the same `cloudflareContext`, and rewrites URLs to `PUBLIC_ORIGIN` (never forwarded headers). The workers shim also exports module-level `env` for existing auth helpers. JSON progress storage is atomic per import, single-process only; queued/in-flight records become terminal errors on boot. `p-limit(3)` caps workflow execution. Step deadlines abort fetch, Node HTTP(S) requests (the Yoto SDK uses Axios), and sandbox process groups. These are cooperative I/O deadlines, not isolation for arbitrary JavaScript. Never refactor routes/lib just to accommodate this target.

**Deployment.** Primary host: `hteo-pc-wsl`, amd64 WSL2 with systemd and Docker Desktop 29.9.2. Enable Docker Desktop at Windows sign-in and its WSL integration. `compose.yaml` uses two `unless-stopped` services, named Tailscale state/progress/scratch volumes, userspace Tailscale Serve and no published ports. The sidecar is a separate tailnet identity. Do not start it without Teo's auth key or register clients/change accounts. Real ts.net/iOS checks remain Teo-dependent. See README for setup.

**Other pieces.** Icon search (`api/icons`) combines official Yoto icons and yotoicons.com scraping (`yoto-icons.server.ts`, `yotoicons-community.server.ts`). Feedback emails go through Resend with a react-email template (`FeedbackEmail.tsx`). UI is shadcn/ui (`app/components/ui/`, add via shadcn CLI per `components.json`) + Tailwind v4.

## Conventions

- Logging: only `app/lib/logger.server.ts` may call `console.*`. Use stable dotted message names (`yoto.audio.upload.completed`) and structured fields. Product events go through typed `telemetry.server.ts` (`EVENT`). See `docs/observability.md`.
- Validation: route input is validated with Zod schemas in `app/schemas/` via `app/lib/validation.server.ts`. Migrating the remaining route actions to Zod is the open item in `plan.md`.
- Tests are colocated `*.test.ts(x)` with vitest globals; build fake bindings with `createMockEnv` from `app/tests/mocks.ts`.
- Path alias `~/` → `app/`. Prettier config is in `.prettierrc` (4-space indent, no semicolons).
- `Dockerfile.selfhost` is the non-root multiarch Node image (yt-dlp with Node runtime + Debian ffmpeg). The dead root `Dockerfile` was removed. `Dockerfile.sandbox` remains exclusively the Cloudflare container image.
