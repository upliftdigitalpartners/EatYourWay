#!/usr/bin/env bash
#
# Curbside — build an Android APK, and optionally push it to the phone.
#
#   ./unreal/Tools/package_android.sh              # build only
#   ./unreal/Tools/package_android.sh --install    # build, then install by USB
#   ./unreal/Tools/package_android.sh --shipping   # smaller, faster, no console
#
# Expect the FIRST run to take a long time — half an hour is normal and an hour
# is not alarming. It is compiling every shader in the project a second time for
# the phone's GPU. Later runs reuse that and take minutes.
#
# Override any of these if your paths differ:
#   PROJECT=... ENGINE=... OUT=... ./unreal/Tools/package_android.sh

set -uo pipefail

PROJECT="${PROJECT:-/Users/fahimdotfm/UE_Projects/Eat Your Way/EatYourWay/EatYourWay.uproject}"
ENGINE="${ENGINE:-/Users/Shared/Epic Games/UE_5.7}"
OUT="${OUT:-$HOME/Desktop/Curbside-Android}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

CONFIG="Development"
INSTALL="no"
for arg in "$@"; do
    case "$arg" in
        --install)  INSTALL="yes" ;;
        --shipping) CONFIG="Shipping" ;;
        *) echo "unknown option: $arg"; sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
    esac
done

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m!!! %s\033[0m\n\n' "$*" >&2; exit 1; }

# --- the editor must be closed ----------------------------------------------
# configure_android.py rewrites a config file the editor has already read, and
# the editor would write its own copy back over ours on exit.
if pgrep -x UnrealEditor >/dev/null 2>&1; then
    die "Unreal Editor is running. Quit it completely (Cmd-Q), then run this again."
fi

[[ -f "$PROJECT" ]] || die "No .uproject at: $PROJECT"
[[ -d "$ENGINE" ]]  || die "No engine at: $ENGINE"

UAT="$ENGINE/Engine/Build/BatchFiles/RunUAT.command"
[[ -x "$UAT" ]] || die "No RunUAT.command at: $UAT"

# --- 1. settings -------------------------------------------------------------
say "Applying the Android settings"
python3 "$REPO/unreal/Tools/configure_android.py" "$PROJECT" || die "Config step failed."

# --- 2. package --------------------------------------------------------------
say "Packaging ${CONFIG} for Android — go and make a coffee, this takes a while"
mkdir -p "$OUT"

"$UAT" -ScriptsForProject="$PROJECT" BuildCookRun \
    -project="$PROJECT" \
    -platform=Android -cookflavor=ASTC \
    -clientconfig="$CONFIG" \
    -build -cook -stage -package -pak -compressed \
    -archive -archivedirectory="$OUT" \
    -nocompileeditor -skipbuildeditor \
    -nop4 -utf8output -unattended
STATUS=$?

if [[ $STATUS -ne 0 ]]; then
    printf '\n\033[1;31m'
    echo "================================================================"
    echo "  PACKAGING FAILED"
    echo "================================================================"
    printf '\033[0m\n'
    echo "The full log is at:"
    echo "  $HOME/Library/Logs/Unreal Engine/LocalBuildLogs/"
    echo
    echo "Send me the last 40 lines of the newest .txt in there."
    exit 1
fi

APK="$(find "$OUT" -name '*.apk' -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)"

printf '\n\033[1;32m'
echo "================================================================"
echo "  PACKAGED"
echo "================================================================"
printf '\033[0m\n'
[[ -n "$APK" ]] && echo "APK: $APK" || echo "Built, but no .apk found under $OUT — look there yourself."

# --- 3. install --------------------------------------------------------------
if [[ "$INSTALL" != "yes" ]]; then
    cat <<'NEXT'

To put it on the phone:
  1. On the phone: Settings > About > tap "Build number" seven times,
     then Settings > Developer options > USB debugging ON.
  2. Plug it in and approve the "Allow USB debugging?" prompt.
  3. Re-run this with --install.
NEXT
    exit 0
fi

say "Installing on the device"

# Unreal generates an installer next to the APK that also handles the OBB, if
# there is one. Prefer it; fall back to a plain adb install.
INSTALLER="$(find "$OUT" -name 'Install_*.command' -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)"
if [[ -n "$INSTALLER" ]]; then
    chmod +x "$INSTALLER"
    "$INSTALLER" || die "Install script failed. Is the phone plugged in with USB debugging on?"
else
    ADB=""
    for candidate in \
        "$(command -v adb 2>/dev/null)" \
        "${ANDROID_HOME:-}/platform-tools/adb" \
        "${ANDROID_SDK_ROOT:-}/platform-tools/adb" \
        "$HOME/Library/Android/sdk/platform-tools/adb"
    do
        [[ -n "$candidate" && -x "$candidate" ]] && { ADB="$candidate"; break; }
    done
    [[ -n "$ADB" ]] || die "No adb found, and no Install_*.command was generated."
    [[ -n "$APK" ]] || die "No APK to install."
    "$ADB" install -r "$APK" || die "adb install failed. Is the phone plugged in with USB debugging on?"
fi

printf '\n\033[1;32mInstalled. Look for "Curbside" in the app drawer.\033[0m\n\n'
