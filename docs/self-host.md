# Self-host plan: Docker + Tailscale

Goal: run Yoto Sync as one Docker container on a home machine, reachable only
over the tailnet at `https://<host>.<tailnet>.ts.net`, with no Cloudflare
account. The Cloudflare deployment keeps working unchanged, and upstream
(`bradgarropy/yoto`) changes keep merging with few conflicts.

Status: implemented on TH1-1999's feature branch; local and container gates
are recorded in `handoffs/STATUS.md`. Real ts.net/iOS acceptance remains open
until Teo supplies the Yoto client and Tailscale HTTPS/auth prerequisites.
Primary deployment target: **hteo-pc-wsl**, amd64 WSL2 with systemd and Docker
Desktop 29.9.2. Docker Desktop must start at Windows sign-in for containers
to resume after Windows reboots. Multiarch builds also cover arm64.

## Why self-host

- YouTube increasingly blocks yt-dlp from datacenter IPs; a home box downloads
  from a residential IP.
- Cloudflare Containers need the paid Workers plan plus usage charges.
- The tailnet keeps the app private without a public login surface.

A native Apple app was ruled out: yt-dlp and ffmpeg cannot run on iOS, so a
server is needed regardless. Step 7 adds a web app manifest so the site can be
installed from Safari's "Add to Home Screen".

## Design: shim the bindings, do not refactor the app

Most Cloudflare-coupled files only read `context.get(cloudflareContext).env`.
The Node entry sets that same context key, with an `env` built from
`process.env` plus fake bindings, so routes, middleware and `lib/` stay
untouched. Only these shapes need a Node implementation:

| Used by the code                                         | Shim must provide                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `getSandbox(env.SANDBOX, id)` from `@cloudflare/sandbox` | `exec(cmd, {env?})` returning `{success, stdout, stderr}`, and `destroy()`                                                         |
| `env.IMPORT_WORKFLOW.create({id, params})`               | start `ImportWorkflow.run` in-process, concurrency-limited                                                                         |
| `WorkflowEntrypoint` from `cloudflare:workers`           | `this.env`, `run(event, step)` with `event.payload`, `event.timestamp`, and `step.do(name, {retries, timeout}, fn)` honouring both |
| `env.IMPORT_PROGRESS.getByName(id)`                      | one `ImportProgress` instance per id with `reportProgress/Complete/Error` and `fetch(Request)` (SSE)                               |
| `DurableObject` from `cloudflare:workers`                | `this.ctx.storage.get/put`, persisted so reattach after a reload works                                                             |

A separate Vite config for the Node build aliases `cloudflare:workers` and
`@cloudflare/sandbox` to shim modules, so `workers/import-workflow.ts`,
`workers/import-progress.ts` and `app/lib/sandbox.server.ts` run unmodified.
`waitUntil` and `ctx` are not used by app code, so `ctx` can be a no-op stub.

## Prerequisites only Teo can do

1. Register a Yoto developer client (the `YOTO_CLIENT_ID` in `wrangler.jsonc`
   belongs to upstream) and add
   `https://<host>.<tailnet>.ts.net/auth/callback` as an allowed callback URL.
2. Enable MagicDNS and HTTPS certificates for the tailnet, and create a
   tagged, reusable Tailscale auth key if the sidecar option is used.
3. Host decided: hteo-pc-wsl (x86_64). Enable Docker Desktop at Windows sign-in and WSL integration. The sidecar gets its own tailnet identity; use its actual HTTPS origin.

Secrets (`YOTO_AUTH_SECRET`, `RESEND_API_KEY`, `TS_AUTHKEY`) live in an
untracked `.env` next to `compose.yaml`; nothing secret is committed.

## Steps

Each step is a small, independently revertible commit.

### 1. Per-import working directory (upstreamable)

`sandbox.server.ts` writes to `/tmp/<file>`, which was safe because each import
had its own container. On one host, concurrent imports of the same video
collide.

- Derive a working dir from the sandbox id (`/tmp/yoto/<sandboxId>/`) for every
  path in `sandbox.server.ts`, created on first use.
- Acceptance: existing tests pass; a new test asserts two sandbox ids produce
  disjoint paths. Harmless on Cloudflare, so it can also go upstream.

### 2. Shims (`selfhost/shims/`)

- `sandbox.ts`: `getSandbox(_, id)` returns an object whose `exec` runs
  `bash -c` via `child_process.spawn` with the given env merged over a minimal
  base env, a timeout, and an output cap; `destroy()` removes
  `/tmp/yoto/<id>/`. Never pass user input outside the existing
  `escapeShellArg` paths.
- `workers.ts`: `WorkflowEntrypoint` and `DurableObject` base classes;
  `step.do` retries with the configured limit/delay/backoff and aborts on
  timeout.
- `bindings.ts`: `IMPORT_WORKFLOW` (in-memory registry, `p-limit(3)` to mirror
  `max_instances: 3`) and `IMPORT_PROGRESS` (instance per id, storage backed by
  SQLite via `better-sqlite3`, or a JSON file per import if a native dependency
  is undesirable).
- On boot, any import whose last stored event is not terminal is rewritten to
  `{type: "error", error: "Import interrupted by server restart"}`, so
  reattaching clients get a closed stream instead of a hang. Resuming
  interrupted imports is out of scope.
- Acceptance: unit tests for `step.do` retry/timeout and for the restart
  rewrite; `workers/import-workflow.test.ts` and
  `workers/import-progress.test.ts` pass against the shims.

### 3. Node server entry (`selfhost/server.ts`)

- Use `@react-router/express` (or `@react-router/node` with a plain HTTP
  listener) to serve `build/client` statics and the server build.
- Build `env` from `process.env`: `YOTO_CLIENT_ID`, `YOTO_AUTH_SECRET`,
  `RESEND_API_KEY`, plus the shim bindings. Fail fast at boot if a required
  variable is missing.
- **Origin rewrite (required).** `redirect_uri` is
  `new URL(request.url).origin + "/auth/callback"` and cookie `Secure` is
  `request.url` protocol `=== "https:"` (`auth.server.ts:66`,
  `oauth-state-cookie.server.ts:51`). Behind `tailscale serve` the app sees
  `http://localhost:3000`, which breaks both. The entry rewrites every
  request URL to `PUBLIC_ORIGIN` (e.g. `https://yoto.tail1234.ts.net`) rather
  than trusting forwarded headers.
- Add `/healthz` returning 200 for the container health check.
- Acceptance: login round-trip works through the ts.net URL with `Secure`
  cookies set.

### 4. Build wiring

- `vite.selfhost.config.ts`: same plugins minus `@cloudflare/vite-plugin`, plus
  the aliases from the design section; outputs to `build-selfhost/`.
- `package.json` scripts: `build:selfhost`, `start:selfhost`. Existing scripts
  are unchanged.
- Add a CI step that runs `build:selfhost`.
- Acceptance: `npm run build` and `npm run typecheck:ci` still pass (the
  Cloudflare build is untouched), and `npm run build:selfhost` passes.

### 5. Image (`Dockerfile.selfhost`)

- Base `node:22-bookworm-slim`; install `python3`, `pipx` or a venv with
  `yt-dlp[default]`, `ffmpeg` and `curl` from Debian packages so the image builds
  on both amd64 and arm64. `Dockerfile.sandbox` hardcodes x86_64 downloads and
  cannot be reused as-is.
- yt-dlp needs a JavaScript runtime for YouTube. Verify whether Node in the
  image satisfies it (`yt-dlp --js-runtimes node`); otherwise install deno for
  the target architecture.
- Multi-stage build, run as a non-root user, `HEALTHCHECK` on `/healthz`.
- Replace the dead root `Dockerfile` (it runs a nonexistent `npm run start`)
  with this one, or delete it.
- Acceptance: `docker buildx build --platform linux/amd64,linux/arm64` succeeds;
  `yt-dlp --version` and `ffmpeg -version` run in the image.

### 6. Tailscale and compose (`compose.yaml`)

- Recommended: a `tailscale/tailscale` sidecar with `TS_AUTHKEY`, a persistent
  state volume, and `TS_SERVE_CONFIG` proxying HTTPS 443 to `127.0.0.1:3000`. The app
  container shares the sidecar's network namespace and publishes no host port.
- Alternative: run the app with `127.0.0.1:3000` published and
  `tailscale serve --bg 3000` on the host.
- Volumes: progress store and `/tmp/yoto` scratch space. Restart policy
  `unless-stopped`.
- Keep Tailscale state in a named volume; both services use `restart: unless-stopped`. Do not start the sidecar without Teo’s auth key.
- Acceptance: the app is reachable at the ts.net URL from a tailnet device,
  and not reachable from the LAN or the public internet.

### 7. Installable web app

- Add `public/manifest.webmanifest`, an `apple-touch-icon`, and the matching
  `<link>`/`<meta>` tags in `app/root.tsx` (`display: standalone`).
- Acceptance: "Add to Home Screen" in iOS Safari opens it full screen with the
  app icon.

### 8. Docs

- `README.md`: a "Self-host with Docker + Tailscale" section covering the
  prerequisites, `.env` keys and `docker compose up -d`.
- Update `CLAUDE.md` with the self-host build commands and the shim layout.

## Verification at PR-ready

- `npm run format`, `npm run lint`, `npm run typecheck:ci` and `npm test` are
  green, and both `npm run build` and `npm run build:selfhost` succeed.
- Real path, once, through the ts.net URL from a phone: log in, import one
  short video and one small playlist into a test card, reload mid-import and
  confirm the progress stream reattaches, restart the container mid-import and
  confirm the client gets the interruption error.
- Negative control: the same URL from a non-tailnet network does not resolve
  or connect.

## Out of scope

- Resuming interrupted imports after a restart.
- Multi-user hosting or public exposure (Tailscale Funnel).
- A native iOS/macOS app.
