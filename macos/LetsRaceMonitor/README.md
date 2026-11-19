# LetsRace Monitor

The menu-bar panel shows the Mac's current activity, the work waiting at each step,
and catalogue writes recorded by the Mac in the last 24 hours. Source and Codex
counts show when they were measured. The 2027 progress bar measures the share of
previous-year races that have a matched next edition. A server status error is
shown separately from the Mac's activity.

The Mac reads structured race documents without paid AI. The existing Race Finder
task in Codex handles harder cases through the desk, and a new answer or website
submission wakes an idle collector. The Mac verifies the evidence before passing it
to the existing publication checks. Set `LETSRACE_PAID_DETAILS=1` in the runner's
environment to opt into the older paid detail steps and their existing caps.

Build with the installed Swift toolchain:

```sh
mkdir -p tmp/macos-monitor-build
xcrun swiftc -swift-version 6 -default-isolation MainActor -parse-as-library -O -framework AppKit macos/LetsRaceMonitor/main.swift -o tmp/macos-monitor-build/LetsRaceMonitor
node scripts/with-node.cjs scripts/install-local-runner.cjs
```

Installation copies a private runtime and installs the runner and monitor login agents. It preserves durable state and credentials. See [the operating guide](../../docs/keep-fresh.md).

Validation: `node scripts/test-local-runner.cjs` and `node scripts/with-node.cjs scripts/test-local-runner-integration.cjs`. The integration test uses isolated temporary data and a fake job; it never calls race sources or paid APIs.

Owner-overview validation after compiling the binary: `node scripts/test-monitor-overview.cjs`. It executes the production Swift presentation model against isolated snapshot scenarios, including stale/unknown state, reader limitations, local pause, incomplete work and avoiding double counting. It never starts collection or paid AI.

Offscreen visual checks: `tmp/macos-monitor-build/LetsRaceMonitor --render-preview /absolute/output.png [optional-snapshot.json] [--details]`. Optional snapshots are read-only test inputs; previewing does not issue collector controls.

Use `--workstreams` instead of `--details` to preview the workstream explanation.
