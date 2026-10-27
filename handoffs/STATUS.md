# TH1-1999 — Self-host Yoto Sync on Docker + Tailscale
- Reviewer branch: review/TH1-1999-ab97fd0bc203; source branch: hteo1337/th1-1999-self-host-yoto-sync-on-docker-tailscale; source head 4a72f760d09c1a64335d4deccd8bfaf35a715ce7.
- Issue: https://linear.app/th1337/issue/TH1-1999/self-host-yoto-sync-on-docker-tailscale (Yoto Sync, In Review); draft PR https://github.com/hteo1337/yoto/pull/1.
- Done: single adversarial latest-Sol (codex-auto/gpt-6.1-sol, task_status inspected) review.txt and one byte-matched BLOCKING comment https://github.com/hteo1337/yoto/pull/1#issuecomment-6452163581; primary 19:46Z review not repeated.
- Finding: startup marks imports interrupted but permanently retains persistent scratch; recovery repro failed. Additional uncaught kill EPERM observed on macOS; Linux impact unverified.
- Verification: npm ci/build:selfhost exit0; npm test exactly once, 25 files/279 passed; composite adversarial test once, 1 failed cleanup assertion + 1 unhandled EPERM; separate parent/child env control exit0.
- Evidence: handoffs/TH1-1999/{adversarial.test.ts,adversarial-repro.log,npm-test-adversarial.log,build-selfhost-adversarial.log,env-control.mjs,env-control.log,comment-receipt.json}; initial dirty dispatcher handoff preserved in dispatch-launch.txt.
- Next: author fixes blocking scratch reclamation; same adversarial reviewer confirms only that fix. Blocker in handoffs/TH1-1999/BLOCKED.md. Product source/feature head unchanged; review artifacts pushed only to reviewer branch and review outcome recorded on Linear.
- CI unavailable: zero workflows/checks; never green. Open: real ts.net imports/reload/restart/outside-tailnet and iOS checks need Teo prerequisites; no sidecar/accounts/merge/ready transition.
- decided: Jev yes (0.995), security/concurrency/installers/restarts; bounded one composite regression plus narrow env control; temporary dependencies/build/scratch artifacts cleaned before reviewer-branch push.
