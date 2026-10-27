# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale

- Branch: hteo1337/th1-1999-self-host-yoto-sync-on-docker-tailscale; draft fork PR https://github.com/hteo1337/yoto/pull/1; Linear In Review, project Yoto Sync.
- Done: docs/self-host.md steps 1–8 committed separately/in order; final SSE bridge cancels upstream on disconnect; Cloudflare workers/app.ts, wrangler.jsonc and upstream plan.md unchanged.
- Verification: format/lint/typecheck:ci/build/build:selfhost exit0; full Vitest once at b616af1: 25 files/279 passed; after stream fix, scoped composite regression 1/1 passed (full suite not repeated under cap).
- Verification: final OCI amd64+arm64 digest 09018229e23c93ed9970b88fda6904af394f34f84510df90450f9c6b79f96062; WSL amd64 build exit0, health200, UID1000, yt-dlp2026.10.26, ffmpeg5.1.9, supported Node22.23.4.
- Verification: local OAuth origin/Secure-cookie forged-header control, headless Chrome install metadata/icons, and compose config pass; every new text file <=300 lines; only env template tracked.
- Next: lead dispatches primary latest-Sol review after writer stops (HTTP409 active-task admission); then Jev/semif and required/default-yes adversarial review. No review launched/verdict; see handoffs/TH1-1999/BLOCKED.md.
- CI: GitHub reports zero registered workflows, no branch runs/PR checks; unverified, never green. PR remains draft; no merge or install performed.
- Open: Teo Yoto client/callback and Tailscale HTTPS/auth key; real ts.net video/playlist/reload/restart/outside-tailnet and iOS installation checks remain unverified.
- decided: primary host hteo-pc-wsl (amd64 WSL2/Docker29.9.2/systemd); Docker Desktop starts at Windows sign-in; sidecar never started. Temporary local/WSL artifacts cleaned; 12 older WSL cache records preserved.
