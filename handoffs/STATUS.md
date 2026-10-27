# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale

- Done: CLAUDE.md and docs/self-host.md (plan, steps 1-8) committed.
- Next: implement docs/self-host.md step 1 onward (dispatched lane).
- Verification: none yet; PR-ready gate is in the Linear issue and docs/self-host.md.
- Blocked on Teo for the real-path check only: own Yoto client ID + ts.net callback, Tailscale HTTPS + auth key, host choice.
- decided: shim Cloudflare bindings behind a separate Node Vite build — keeps upstream merges clean.
