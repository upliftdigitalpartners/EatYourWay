#!/usr/bin/env bash
#
# Curbside — pull, stage and rebuild, in one command.
#
#   ./unreal/Tools/rebuild.sh
#
# Three separate steps is two chances to do one and not the others, and a
# half-done rebuild looks exactly like a code bug from inside the editor:
# "C++ class not found". So this does all three, refuses to start with the
# editor open, and stops at the first failure rather than carrying on.
#
# Override the paths with environment variables if yours differ:
#   PROJECT=... MODULE_DIR=... MODULE=... ENGINE=... ./unreal/Tools/rebuild.sh

set -uo pipefail

PROJECT="${PROJECT:-/Users/fahimdotfm/UE_Projects/Eat Your Way/EatYourWay/EatYourWay.uproject}"
MODULE_DIR="${MODULE_DIR:-/Users/fahimdotfm/UE_Projects/Eat Your Way/EatYourWay/Source/EatYourWay}"
MODULE="${MODULE:-EatYourWay}"
ENGINE="${ENGINE:-/Users/Shared/Epic Games/UE_5.7}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m!!! %s\033[0m\n\n' "$*" >&2; exit 1; }

# --- 0. the editor must be closed -------------------------------------------
# Unreal holds the module dylib open. Building over it either fails or writes a
# binary the running editor will never load, which is the confusing case.
if pgrep -x UnrealEditor >/dev/null 2>&1; then
    die "Unreal Editor is running. Quit it completely (Cmd-Q), then run this again."
fi

# --- 1. checks before anything is changed ------------------------------------
[[ -f "$PROJECT" ]]     || die "No .uproject at: $PROJECT"
[[ -d "$MODULE_DIR" ]]  || die "No module directory at: $MODULE_DIR"
[[ -d "$ENGINE" ]]      || die "No engine at: $ENGINE"

BUILD_SH="$ENGINE/Engine/Build/BatchFiles/Mac/Build.sh"
[[ -x "$BUILD_SH" ]]    || die "No Build.sh at: $BUILD_SH"

# --- 2. pull -----------------------------------------------------------------
say "Pulling $REPO"
git -C "$REPO" pull --ff-only || die "git pull failed."
printf '    now at: %s\n' "$(git -C "$REPO" log --oneline -1)"

# --- 3. stage ----------------------------------------------------------------
say "Staging the module into $MODULE_DIR"
"$REPO/unreal/Tools/stage_module.sh" "$MODULE_DIR" "$MODULE" --with-chaos \
    || die "Staging failed."

# --- 4. build ----------------------------------------------------------------
say "Building ${MODULE}Editor — this takes about half a minute"
LOG="$(mktemp -t curbside-build)"
"$BUILD_SH" "${MODULE}Editor" Mac Development \
    -Project="$PROJECT" -WaitMutex 2>&1 | tee "$LOG"
STATUS=${PIPESTATUS[0]}

echo
if [[ $STATUS -ne 0 ]] || ! grep -q "Result: Succeeded" "$LOG"; then
    printf '\033[1;31m'
    echo "================================================================"
    echo "  BUILD FAILED — do not open the editor yet."
    echo "================================================================"
    printf '\033[0m'
    echo
    echo "The errors, from $LOG:"
    grep -E "error|Error:" "$LOG" | head -25
    echo
    echo "Send me those lines."
    exit 1
fi

printf '\033[1;32m'
echo "================================================================"
echo "  BUILD SUCCEEDED"
echo "================================================================"
printf '\033[0m'
cat <<'NEXT'

Now open the project and run these three, in this order:
  Tools > Execute Python Script...

  1. unreal/Tools/create_vehicle_specs.py
  2. unreal/Tools/setup_curbside.py
  3. unreal/Tools/place_vehicles.py

Then File > Save Current Level.
NEXT
