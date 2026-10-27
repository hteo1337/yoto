# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale

- Review branch: review/TH1-1999-945a9ef2ee5e; source hteo1337/th1-1999-self-host-yoto-sync-on-docker-tailscale at 4a72f760d09c1a64335d4deccd8bfaf35a715ce7; PR https://github.com/hteo1337/yoto/pull/1; Linear In Review, project Yoto Sync.
- Done: primary PR-ready review by inspected codex-auto/gpt-6.1-sol; review.txt byte-matches the single verdict comment https://github.com/hteo1337/yoto/pull/1#issuecomment-6451923159 (CONFIRMED; no blocking findings).
- Verification: npm ci/format/lint/typecheck:ci/test/build/build:selfhost all exit0 on macOS Node26.12.1; full suite once, 25 files/279 tests; logs in handoffs/TH1-1999/. Initial format exit1 isolated to dispatcher artifacts, preserved before checking committed source.
- Verification: built Node health200/login302 with spoofed Host/Forwarded headers, correct PUBLIC_ORIGIN callback and Secure/HttpOnly/SameSite=Lax cookie; no external OAuth request. GitHub zero workflows/runs/checks: CI unavailable, never green.
- decided: adversarial required (default yes) — actual diff/plan rejected by semif HTTP422 at 26,384 > 4,096 tokens; credentials, concurrency/deadlines and restarts match rubric.
- Next: lead reconcile dispatcher stage/attempt and launch exactly one adversarial latest-Sol review after this primary stops; corrected review-labelled request refused with idempotency conflict, no extra task created. See handoffs/TH1-1999/BLOCKED.md.
- Open: live ts.net video/playlist/reload/restart/outside-tailnet and iOS checks still require Teo's Yoto client/callback and Tailscale HTTPS/auth key; image/multiarch claims not rerun in review.
- Boundaries: source branch untouched; PR remains draft; no merge/ready/account/sidecar actions. Dispatcher launch record preserved in handoffs/TH1-1999/dispatcher-status.log; review artifacts pushed at 4f31d20 with final checklist checkpoint after remote verification; Linear acceptance updated with review result.
