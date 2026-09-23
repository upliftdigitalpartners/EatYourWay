#!/usr/bin/env bash
#
# Curbside — watch the game's log while it runs on the phone.
#
#   ./unreal/Tools/phone_log.sh            # follow live; Ctrl-C to stop
#   ./unreal/Tools/phone_log.sh --errors   # only warnings and errors
#   ./unreal/Tools/phone_log.sh --save     # follow, and write it to a file too
#
# There is no console on a phone and no window to read, so this is the only
# way to see what the game thinks is happening. Leave it running, then launch
# Curbside on the device.

set -uo pipefail

ERRORS_ONLY="no"
SAVE=""
for arg in "$@"; do
    case "$arg" in
        --errors) ERRORS_ONLY="yes" ;;
        --save)   SAVE="$HOME/Desktop/curbside-phone-$(date +%H%M%S).log" ;;
        *) echo "unknown option: $arg"; sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
    esac
done

# The NDK lives under ~/Library/Android/sdk on this machine, so adb usually
# does too — but check the usual suspects rather than assuming.
ADB=""
for candidate in \
    "$(command -v adb 2>/dev/null)" \
    "${ANDROID_HOME:-}/platform-tools/adb" \
    "${ANDROID_SDK_ROOT:-}/platform-tools/adb" \
    "$HOME/Library/Android/sdk/platform-tools/adb"
do
    [[ -n "$candidate" && -x "$candidate" ]] && { ADB="$candidate"; break; }
done

if [[ -z "$ADB" ]]; then
    echo "No adb found. Looked on PATH, in \$ANDROID_HOME, \$ANDROID_SDK_ROOT," >&2
    echo "and ~/Library/Android/sdk/platform-tools/." >&2
    exit 1
fi

if ! "$ADB" get-state >/dev/null 2>&1; then
    echo "No device. Plug the phone in, unlock it, and approve the USB debugging prompt." >&2
    exit 1
fi

# Start from now, not from whatever is already in the ring buffer.
"$ADB" logcat -c 2>/dev/null

echo "Watching. Launch Curbside on the phone now. Ctrl-C to stop."
[[ -n "$SAVE" ]] && echo "Also writing to $SAVE"
echo

# UE tags everything as "UE"; the debug tag carries the earliest startup lines,
# before the log system is up, which is where a launch failure shows itself.
# A function rather than a string holding a command: an unquoted variable of
# shell words gets split and the regex parens parsed as syntax.
sieve() {
    if [[ "$ERRORS_ONLY" == "yes" ]]; then
        grep -E "Error|Warning|Fatal|signal|Curbside"
    else
        cat
    fi
}

if [[ -n "$SAVE" ]]; then
    "$ADB" logcat -v time UE:V UE4:V DEBUG:V AndroidRuntime:E '*:S' | sieve | tee "$SAVE"
else
    "$ADB" logcat -v time UE:V UE4:V DEBUG:V AndroidRuntime:E '*:S' | sieve
fi
