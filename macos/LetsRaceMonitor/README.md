# LetsRace Monitor

Native AppKit menubar utility. One template bicycle symbol, white compact popover, live heartbeat, explicit federation scan, local AI budget and source outcomes. No third-party UI dependency.

Build with the installed Swift toolchain:

```sh
mkdir -p tmp/macos-monitor-build
xcrun swiftc -swift-version 6 -default-isolation MainActor -parse-as-library -O -framework AppKit macos/LetsRaceMonitor/main.swift -o tmp/macos-monitor-build/LetsRaceMonitor
node scripts/with-node.cjs scripts/install-local-runner.cjs
```

Installation copies a private runtime and installs the runner and monitor login agents. It preserves durable state and credentials. See [the operating guide](../../docs/keep-fresh.md).

Validation: `node scripts/test-local-runner.cjs` and `node scripts/with-node.cjs scripts/test-local-runner-integration.cjs`. The integration test uses isolated temporary data and a fake job; it never calls race sources or paid APIs.
