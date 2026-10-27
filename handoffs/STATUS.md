# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale

- Branch: hteo1337/th1-1999-self-host-yoto-sync-on-docker-tailscale; fork hteo1337/yoto.
- Done: steps 1–2: isolated scratch paths; bounded process shims, retry/deadline steps and atomic JSON progress recovery.
- Verification: step 1 Vitest 29/29; step 2 workflow/progress + composite regression 11/11, including retry exhaustion, real subprocess timeout, SSE restart error and terminal preservation.
- Done: step 3 Node entry written and typechecked; local runtime proof follows step 4 build wiring.
- Next: step 4 build wiring, then local origin/cookie/health checks and image.
- Open: Teo-only Yoto client, HTTPS/tailnet key/host prerequisites; ts.net real path remains unverified.
- decided: retain existing legacy handoff for this issue; use separate Node build without route refactor.
