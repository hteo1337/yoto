# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale

- Branch: hteo1337/th1-1999-self-host-yoto-sync-on-docker-tailscale; fork hteo1337/yoto; steps 1–8 implemented in order.
- Done: isolated scratch, Node shims/server/build, multiarch image, private compose, install metadata and setup docs.
- Verification: focused step 1 29/29, step 2 11/11; composite regression covers restart SSE, retries, shell/HTTP deadlines and status reads.
- Verification: both builds/typecheck exit 0; local OAuth origin/Secure-cookie control passed; headless Chrome manifest/icon metadata passed.
- Verification: multiarch OCI amd64+arm64; arm64 container UID1000, health200, yt-dlp2026.10.26, ffmpeg5.1.9, supported Node22.23.4; compose config exit0.
- Next: final six local gates, final-source multiarch/amd64 WSL smoke, draft fork PR, required exact-head reviews.
- Open: Teo Yoto client/callback and Tailscale HTTPS/auth key; real ts.net video/playlist/reload/restart/outside-tailnet and iOS install checks unverified.
- decided: hteo-pc-wsl primary amd64 target (SSH verified Docker29.9.2/systemd); Docker Desktop at sign-in; never start sidecar without Teo’s key.
- decided: legacy handoff retained; Node shims preserve Cloudflare routes/workers and upstream plan.md.
