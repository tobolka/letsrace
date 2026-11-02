# LetsRace Monitor

Native AppKit menubar utility. The default popover shows one overall state, the latest completed result and an honest account of pending review. Technical lanes and manual controls are behind “Zobrazit podrobnosti”, with a return button. The pause explicitly affects only the Mac. No completion estimates and no third-party UI dependency.

“Co systém dělá” opens a plain-language map of the four workstreams: finding new websites, finding races in known sources, enriching existing races, and reviewing uncertain findings. It distinguishes configured automatic work from unfinished automation; it is not a fabricated per-lane live progress display. Technical controls are available via “Zobrazit průběh a nástroje”.

Build with the installed Swift toolchain:

```sh
mkdir -p tmp/macos-monitor-build
xcrun swiftc -swift-version 6 -default-isolation MainActor -parse-as-library -O -framework AppKit macos/LetsRaceMonitor/main.swift -o tmp/macos-monitor-build/LetsRaceMonitor
node scripts/with-node.cjs scripts/install-local-runner.cjs
```

Installation copies a private runtime and installs the runner and monitor login agents. It preserves durable state and credentials. See [the operating guide](../../docs/keep-fresh.md).

Validation: `node scripts/test-local-runner.cjs` and `node scripts/with-node.cjs scripts/test-local-runner-integration.cjs`. The integration test uses isolated temporary data and a fake job; it never calls race sources or paid APIs.

Owner-overview validation after compiling the binary: `node scripts/test-monitor-overview.cjs`. It executes the production Swift presentation model against 14 isolated snapshot scenarios, including stale/unknown state, reader limitations, local pause, incomplete work and avoiding double counting. It never starts collection or paid AI.

Offscreen visual checks: `tmp/macos-monitor-build/LetsRaceMonitor --render-preview /absolute/output.png [optional-snapshot.json] [--details]`. Optional snapshots are read-only test inputs; previewing does not issue collector controls.

Use `--workstreams` instead of `--details` to preview the workstream explanation.
