# TH1-1999 adversarial fixes

PASEO_AGENT_ID is unset (checked this session); suffix uses the dispatcher task ID c24e19aa1a76430fa1d470d24cf9eb78 recorded in the launch handoff.
Scope: only the two adversarial findings; the unrelated Zod plan item remains open.

- [x] Read repository rules, issue, complete adversarial PR comment, and reviewer repro at the named branch.
- [x] Add exactly one recovery regression and demonstrate it fails on unchanged 4a72f76 source (exit 1; scratch still exists; recovery-baseline.log).
- [x] Fix interrupted scratch recovery and callback kill failures; regression passed in full suite (replay records and outside sentinel preserved); real cap probe also passed without an uncaught error.
- [x] Run the six required gates once: format/lint/typecheck:ci/test/build/build:selfhost all exit 0; 26 files/280 tests passed. Real cap/startup path exit 0 (actual-path-fix.log).
- [x] Updated legacy handoffs/STATUS.md and issue blocker; pushed fix 76427de, verified matching remote/draft PR head, updated PR body and Linear (In Review/Yoto Sync), and left same-reviewer confirmation to lead. This final handoff commit preserves the evidence.
