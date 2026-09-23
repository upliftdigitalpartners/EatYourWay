#!/usr/bin/env bash
#
# Stage the Curbside module into an existing Unreal project module.
#
#   ./unreal/Tools/stage_module.sh <module-dir> <MODULENAME> [--with-chaos]
#
# Example, for a project whose module lives at Source/EatYourWay:
#   ./unreal/Tools/stage_module.sh ~/dev/eatyourway/Source/EatYourWay EatYourWay
#
# By default the Chaos wheeled vehicle is LEFT OUT. It is the only file that
# needs the ChaosVehicles module, and Chaos APIs drift between engine versions,
# so omitting it removes the likeliest cause of a failed first build. Everything
# else still compiles and is playable — including cars, since
# CurbsideRoadVehicle does its own raycast suspension and needs no Chaos.
# Re-run with --with-chaos once that build is green.

set -euo pipefail

if [[ $# -lt 2 ]]; then
    sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
fi

MODULE_DIR="$1"
MODULE_NAME="$2"
WITH_CHAOS="no"
[[ "${3:-}" == "--with-chaos" ]] && WITH_CHAOS="yes"

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../Source/Curbside" && pwd)"
API_MACRO="$(printf '%s' "$MODULE_NAME" | tr '[:lower:]' '[:upper:]')_API"

if [[ ! -d "$MODULE_DIR" ]]; then
    echo "error: module directory not found: $MODULE_DIR" >&2
    exit 1
fi

mkdir -p "$MODULE_DIR/Public" "$MODULE_DIR/Private"

copy() {
    local from="$1" to="$2"
    cp "$from" "$to"
    # sed -i differs between GNU and BSD; do it portably.
    sed "s/CURBSIDE_API/${API_MACRO}/g" "$to" > "$to.tmp" && mv "$to.tmp" "$to"
}

COPIED=0
SKIPPED=0
for f in "$SRC"/Public/*.h; do
    base="$(basename "$f")"
    if [[ "$WITH_CHAOS" == "no" && "$base" == "CurbsideWheeledVehicle.h" ]]; then
        SKIPPED=$((SKIPPED + 1)); continue
    fi
    copy "$f" "$MODULE_DIR/Public/$base"
    COPIED=$((COPIED + 1))
done
for f in "$SRC"/Private/*.cpp; do
    base="$(basename "$f")"
    if [[ "$WITH_CHAOS" == "no" && "$base" == "CurbsideWheeledVehicle.cpp" ]]; then
        SKIPPED=$((SKIPPED + 1)); continue
    fi
    copy "$f" "$MODULE_DIR/Private/$base"
    COPIED=$((COPIED + 1))
done

echo "Staged $COPIED files into $MODULE_DIR"
echo "  export macro : CURBSIDE_API -> ${API_MACRO}"
if [[ "$WITH_CHAOS" == "no" ]]; then
    echo "  skipped      : $SKIPPED (Chaos wheeled vehicle — re-run with --with-chaos to include)"
fi

echo
echo "Add to ${MODULE_NAME}.Build.cs -> PublicDependencyModuleNames:"
echo '    "EnhancedInput",'
echo '    "PhysicsCore",'
[[ "$WITH_CHAOS" == "yes" ]] && echo '    "ChaosVehicles",'

echo
echo "Enable in your .uproject:"
echo '    { "Name": "PythonScriptPlugin", "Enabled": true }'
[[ "$WITH_CHAOS" == "yes" ]] && echo '    { "Name": "ChaosVehiclesPlugin", "Enabled": true }'

echo
echo "Then: Generate Project Files, and build from your IDE."
