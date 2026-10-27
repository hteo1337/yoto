# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale

- Branch: hteo1337/th1-1999-self-host-yoto-sync-on-docker-tailscale; draft PR https://github.com/hteo1337/yoto/pull/1; Linear In Review, project Yoto Sync.
- Done: source fix 76427de pushed; both adversarial findings fixed; exactly one new regression. Real cap probe: small succeeds, oversized fails, retained 8388608 bytes, no uncaught error. Built Node startup: health200, interrupted scratch removed, replay and outside sentinel preserved.
- Verification: regression baseline 4a72f76 exit 1 (scratch survives); format/lint/typecheck:ci/test/build/build:selfhost each exit 0, once; 26 files/280 tests passed. Baseline and actual-path logs: handoffs/TH1-1999/.
- Next: lead routes brief fix confirmation to same adversarial reviewer task 98a88e14a3cd449bb4e8510fcc103a29 after writer stops; PR body and Linear updated with exact verification; keep PR draft.
- CI: live GitHub API reports zero workflows/runs/checks; unavailable, never green. No merge, ready transition, sidecar start or account changes authorized.
- Open: real ts.net video/playlist/reload/restart/outside-tailnet and iOS acceptance still need Teo's Yoto client/callback and Tailscale HTTPS/auth prerequisites; primary host remains hteo-pc-wsl.
- decided: only fix the two reviewed findings; leave unrelated Zod plan item open. Prior primary Sol CONFIRMED 4a72f76; Jev yes 0.995; adversarial fix confirmation pending.
- Dispatcher provenance: prior task dd88428ad36e4ef3ae8d2821c22b091e/run 0c79ce3b26b14180aaf3b47bb3a2f70f; current retry c24e19aa1a76430fa1d470d24cf9eb78/run 721fd5c10e534bd08eff1e026c9816c2; workspace wks_ddcda2c4ec2dae38; prior image/live verification belongs to earlier handoff commits; generated artifacts removed, tree retained for janitor.
