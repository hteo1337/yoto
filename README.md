# Yoto Sync

A web application for syncing YouTube content to Yoto cards. Download audio from YouTube videos or playlists and upload them directly to your Yoto cards. Deployed on Cloudflare Workers with Containers for YouTube downloading.

## Features

- Browse and manage your Yoto cards
- Import audio from YouTube videos and playlists
- Drag-and-drop track reordering
- Track deletion and card management
- Search and sort cards

## Prerequisites

- Node.js 20+
- [Docker Desktop](https://docs.docker.com/desktop/) (for local development)

## Installation

```bash
git clone https://github.com/bradgarropy/yoto.git
cd yoto
npm install
```

## Usage

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### First Time Setup

1. Click "Login" to authenticate with your Yoto account
2. Click "Continue to Yoto" and sign in on Yoto's website
3. Return automatically to your Yoto cards after authorizing access

### Syncing YouTube Content

1. Navigate to a card's detail page
2. Click "Add Tracks"
3. Paste a YouTube video or playlist URL
4. Click "Import" and wait for the sync to complete

## Self-host with Docker + Tailscale

The separate Node build runs without Cloudflare. The primary target is
**hteo-pc-wsl** (x86_64 WSL2, systemd enabled, Docker Desktop 29.9.2).
The image also supports Linux arm64. Keep the checkout in the WSL Linux
filesystem and enable Docker Desktop integration for that WSL distribution.
In Docker Desktop settings, enable **Start Docker Desktop when you sign in
to your computer**. After a Windows reboot, containers resume when Docker
Desktop starts at sign-in; this does not provide service before sign-in.

When building over SSH, if Docker reports that `docker-credential-desktop.exe`
is missing, include Docker Desktop's helper directory for that command:
`PATH="$PATH:/mnt/c/Program Files/Docker/Docker/resources/bin" docker compose up -d --build`.
This uses the existing Docker Desktop helper; no credential files need copying.

Before starting, Teo must register an own Yoto developer client, enable
MagicDNS/HTTPS on the tailnet, and supply a tagged reusable Tailscale auth
key. Register exactly `https://<sidecar-host>.<tailnet>.ts.net/auth/callback`.
The sidecar has its own tailnet identity (default hostname `yoto`), separate
from the existing `hteo-pc-wsl` node. Its HTTPS origin must match
`PUBLIC_ORIGIN`, with no trailing path. Never use upstream's Yoto client ID.

Copy `.env.example` to an untracked `.env` in the checkout. Supply:

| Key                | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| `PUBLIC_ORIGIN`    | `https://yoto.<tailnet>.ts.net` (actual sidecar HTTPS origin)   |
| `YOTO_CLIENT_ID`   | Your registered Yoto client ID                                  |
| `YOTO_AUTH_SECRET` | A long random secret, kept stable to preserve encrypted cookies |
| `RESEND_API_KEY`   | Your Resend API key for feedback                                |
| `TS_AUTHKEY`       | Teo-provided Tailscale auth key                                 |
| `TS_HOSTNAME`      | Optional sidecar hostname; defaults to `yoto`                   |

Once those prerequisites are complete, run:

```bash
docker compose up -d --build
docker compose exec app curl --fail http://127.0.0.1:3000/healthz
docker compose logs --tail 50 app
```

Compose publishes no host ports. Tailscale Serve terminates HTTPS and proxies
to the app through their shared network namespace; Funnel is disabled.
Both services use `restart: unless-stopped`. Named volumes keep Tailscale's
identity, import progress and scratch space across restarts. Do not run
`docker compose down -v` if you want to retain that state. A deliberately
stopped container stays stopped until you start it again.

Only run one app replica per progress volume. Imports run in-process, up to
three at a time. On restart, unfinished imports become a terminal
"Import interrupted by server restart" error; they do not resume. Queued
credentials are never persisted. Terminal progress files remain in the
volume so clients can reconnect. The image uses Node 22 for yt-dlp's JS
challenges (`--js-runtimes node` in `/etc/yt-dlp.conf`); rebuilding refreshes
yt-dlp and Debian ffmpeg. [yt-dlp runtime setup](https://github.com/yt-dlp/yt-dlp/wiki/EJS).

For an existing host-managed Tailscale installation instead of the sidecar,
build `Dockerfile.selfhost`, run the app with only
`-p 127.0.0.1:3000:3000`, supply the four application variables above, and use
`tailscale serve --bg 3000` on the host. Use that host's HTTPS origin and
callback registration. Do not run both serving options at once.

After startup, open the ts.net URL from a tailnet device. In iOS Safari use
**Share → Add to Home Screen** to install the standalone app. Verification
still required with real prerequisites: log in; import one short video and
one small playlist into a test card; reload during import to reconnect;
restart during import to receive the interruption error. From outside the
tailnet, the same URL must not connect. See [the implementation plan](docs/self-host.md).

## Development

```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run deploy      # Build and deploy to Cloudflare
npm run test        # Run tests
npm run lint        # Check for lint errors
npm run typecheck   # Check TypeScript types
npm run format      # Check code formatting
```

### Observability

The application uses structured diagnostic logs and typed product telemetry.
See [Observability](docs/observability.md) for event conventions, log levels,
privacy rules, testing guidance, and instructions for viewing logs.

### Local Development with Containers

This app uses [Cloudflare Containers](https://developers.cloudflare.com/containers/) for YouTube downloading via yt-dlp. For local development:

1. **Docker must be installed and running** - The Vite dev server uses Docker to run containers locally
2. **First run builds the container** - Takes 2-3 minutes; subsequent runs use cached layers
3. **Rebuild containers** - Press `r` + Enter in the terminal to rebuild after Dockerfile changes

The local development environment runs your Worker code in [workerd](https://github.com/cloudflare/workerd) (the same runtime as production) and containers in Docker, providing near-production behavior.

## Project Structure

```
yoto/
├── app/
│   ├── routes/           # React Router pages
│   │   ├── home.tsx      # Card grid dashboard
│   │   ├── login.tsx     # Start browser-based PKCE login
│   │   ├── auth.callback.tsx # Complete browser-based PKCE login
│   │   └── cards.$id.tsx # Card detail with tracks
│   ├── components/ui/    # shadcn/ui components
│   └── lib/              # Server-side utilities
│       ├── auth.server.ts
│       ├── youtube.server.ts
│       └── sync.server.ts
├── public/               # Static assets
└── images/               # Image assets
```

## Tech Stack

- [Cloudflare Workers](https://developers.cloudflare.com/workers/) - Edge runtime
- [Cloudflare Containers](https://developers.cloudflare.com/containers/) - Serverless containers for yt-dlp
- [React Router v7](https://reactrouter.com/) - Full-stack React framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube downloading (runs in container)
- [@yotoplay/yoto-sdk](https://www.npmjs.com/package/@yotoplay/yoto-sdk) - Yoto API client
