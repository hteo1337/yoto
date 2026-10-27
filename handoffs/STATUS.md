# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale

- Branch: hteo1337/th1-1999-self-host-yoto-sync-on-docker-tailscale; fork hteo1337/yoto.
- Done: steps 1–4 implemented: isolated scratch, Node binding shims, fixed-origin HTTP entry and separate build/CI wiring.
- Verification: step 1 29/29; step 2 11/11 focused tests. Node health/SSR/static 200; OAuth origin and Secure cookie ignore forged forwarded headers.
- Verification: Cloudflare build, self-host build and typecheck:ci exit 0; full final gates pending.
- Next: multiarch non-root image (step 5), private compose, manifest, docs; then final gates and draft PR/reviews.
- Open: Teo-only Yoto client/ts.net callback and HTTPS/tailnet key; real ts.net import and outside-tailnet controls remain open.
- decided: primary deploy target hteo-pc-wsl (amd64 WSL2); never start sidecar without Teo’s key. Retain legacy issue handoff; module-level env shim also required by auth helpers; shared sidecar namespace uses loopback Serve target.
