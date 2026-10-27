# TH1-1999 checklist

PASEO_AGENT_ID is unset; suffix uses verified dispatch run 52077c4e0180434287cb3ce64921af2d from STATUS.

- [x] Step 1: isolate scratch paths; one regression demonstrates disjoint ids and fails on old code.
- [ ] Step 2 (in progress): bounded Node shims run workflow/progress logic, retries, timeouts and restart recovery.
- [ ] Step 3: Node entry rewrites origin, validates env and serves health/static/SSR.
- [ ] Step 4: both build configurations and CI wiring verified.
- [ ] Step 5: non-root multiarch image builds and tools/health run.
- [ ] Step 6: private Tailscale compose config validates.
- [ ] Step 7: manifest and icon served with install metadata.
- [ ] Step 8: README and CLAUDE document tested commands and prerequisites.
- [ ] Required local gates recorded with exact results; external ts.net checks left explicitly open.
- [ ] Draft fork PR linked to issue; required reviews inspected or concrete blocker recorded; handoff committed and pushed.
