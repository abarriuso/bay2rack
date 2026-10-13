#!/usr/bin/env bash
# Export every parameter set in src/bay2rack.json to stl/<set>/.
# Usage: scripts/build.sh [set-name ...]      (default: all sets)
# Set OPENSCAD to override the binary location.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
scad="$root/src/bay2rack.scad"
sets_file="$root/src/bay2rack.json"

if [[ -z "${OPENSCAD:-}" ]]; then
    if command -v openscad >/dev/null 2>&1; then OPENSCAD=openscad
    elif [[ -x "/c/Program Files/OpenSCAD/openscad.com" ]]; then OPENSCAD="/c/Program Files/OpenSCAD/openscad.com"
    elif [[ -x "/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD" ]]; then OPENSCAD="/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD"
    else echo "OpenSCAD not found - set OPENSCAD=/path/to/openscad" >&2; exit 1
    fi
fi

if [[ $# -gt 0 ]]; then
    sets=("$@")
else
    mapfile -t sets < <(grep -oE '^        "[^"]+": \{' "$sets_file" | sed -E 's/^ *"([^"]+)".*/\1/')
fi

export_part() {   # set part outfile
    local out
    if out=$("$OPENSCAD" -o "$3" -p "$sets_file" -P "$1" -D "part=\"$2\"" "$scad" 2>&1); then
        echo "  ok   $2 -> ${3#$root/}"
    else
        rm -f "$3"
        if grep -q "top level object is empty" <<<"$out"; then
            echo "  --   $2 (not used in this set)"
        else
            echo "$out" >&2; return 1
        fi
    fi
    grep -E "WARNING" <<<"$out" | sed 's/^/       /' || true
}

for s in "${sets[@]}"; do
    echo "[$s]"
    dir="$root/stl/$s"
    mkdir -p "$dir"
    if [[ "$s" == panel-* ]]; then
        export_part "$s" rack_panel "$dir/$s.stl"
    else
        export_part "$s" adapter  "$dir/$s-adapter.stl"
        export_part "$s" filler   "$dir/$s-filler.stl"
        export_part "$s" filler_2 "$dir/$s-filler-2.stl"
    fi
done
