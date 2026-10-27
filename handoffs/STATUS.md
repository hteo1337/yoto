# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale

- Branch: hteo1337/th1-1999-self-host-yoto-sync-on-docker-tailscale; fork hteo1337/yoto.
- Done: step 1 isolates scratch paths under /tmp/yoto/<sandboxId>.
- Verification: focused Vitest 29/29; new regression failed on unchanged implementation (same-video collision), then passed.
- Next: step 2 binding shims; continue docs/self-host.md steps 2–8 in order.
- Open: Teo-only Yoto client, HTTPS/tailnet key/host prerequisites; ts.net real path remains unverified.
- decided: retain existing legacy handoff for this issue; use separate Node build without route refactor.
