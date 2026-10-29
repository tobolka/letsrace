#!/bin/bash
# Launch through macOS so Finder, the menu bar, and app controls share one instance.
set -eu
DATA_DIR="${LETSRACE_DATA_DIR:-$HOME/Library/Application Support/LetsRace/data}"
mkdir -p "$DATA_DIR"
rm -f "$DATA_DIR/panel-quit"
/usr/bin/open -W -g "$HOME/Applications/LetsRace Monitor.app"
# An intentional close affects only the panel; unexpected exits are restarted.
if [ -f "$DATA_DIR/panel-quit" ]; then exit 0; fi
exit 1
