# TH1-1999 adversarial fix confirmation
- [x] Inspect original findings, exact-head fix diff and scoped repro (PR comment 6452163581, git diff 4a72f76..0dc1855).
- [x] Built Node boot + actual shim probe exit 0: scratch removed; complete/error replay byte-preserved; outside sentinel survives; cap retained 8388608 bytes, bounded failure, no unhandled exception (confirm-probe.log).
- [x] Same a.b.json fixture throws Invalid sandbox ID on 4a72f76 and 0dc1855 via read/filename; pre-existing local-state boot failure, no new regression (confirm-probe.log).
- [x] Run npm test once on exact source head: exit 0, 26 files / 280 tests; npm-test-confirm.log; no competing test processes before/after.
- [ ] Post one verdict comment; preserve review evidence and pushed review-branch handoff.
