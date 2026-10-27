# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale

- Branch: hteo1337/th1-1999-self-host-yoto-sync-on-docker-tailscale; fork hteo1337/yoto; steps 1–8 committed in order.
- Done: isolated scratch, Node shims/server/build, multiarch image, private compose, install metadata and WSL setup docs.
- Verification: format/lint/typecheck:ci/test/build/build:selfhost exit0; Vitest 25 files, 279 tests. Format normalized ignored local Paseo JSON only.
- Verification: final-source OCI amd64+arm64 built exit0; arm64 container UID1000, health200, yt-dlp2026.10.26, ffmpeg5.1.9, supported Node22.23.4.
- Verification: local OAuth origin/Secure cookie ignores forged proxy headers; headless Chrome install metadata/icons pass; compose config exit0.
- PR: https://github.com/hteo1337/yoto/pull/1 (draft, fork main); primary review launch HTTP409 because writer active; see handoffs/TH1-1999/BLOCKED.md.
- Open: Teo Yoto client/callback and Tailscale HTTPS/auth key; real ts.net video/playlist/reload/restart/outside-tailnet and iOS install checks unverified.
- decided: hteo-pc-wsl primary amd64 target (SSH verified Docker29.9.2/systemd); Docker Desktop at sign-in; sidecar never started.
- Next: finish optional WSL smoke/cleanup, push stop handoff; lead dispatches primary review after worker stops, then adversarial decision/review. Legacy handoff retained; Cloudflare workers/app.ts, wrangler.jsonc and upstream plan.md unchanged; no account mutations.
