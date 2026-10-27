# TH1-1999 checklist

PASEO_AGENT_ID is unset; suffix uses verified dispatch run 52077c4e0180434287cb3ce64921af2d from STATUS.

- [x] Step 1: isolate scratch paths; one regression demonstrates disjoint ids and fails on old code.
- [x] Step 2: bounded Node shims run workflow/progress logic, retries, timeouts and restart recovery.
- [x] Step 3: Node entry rewrites origin, validates env and serves health/static/SSR.
- [x] Step 4: both build configurations and CI wiring verified.
- [x] Step 5: non-root multiarch image builds and tools/health run.
- [x] Step 6: private Tailscale compose config validates.
- [x] Step 7: manifest and icon served with install metadata.
- [x] Step 8: README and CLAUDE document tested commands and prerequisites.
- [x] Required local gates recorded with exact results; external ts.net checks left explicitly open.
- [x] Draft fork PR linked to issue; required reviews inspected or concrete blocker recorded; handoff committed and pushed.

- [x] Cleanup: remove temporary local/WSL containers, images, task cache and generated output while preserving pre-existing artifacts.
