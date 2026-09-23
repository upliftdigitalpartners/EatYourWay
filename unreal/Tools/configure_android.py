#!/usr/bin/env python3
"""
Curbside — make the project packageable for Android.

Two jobs: merge unreal/Config/Android.ini into the project's DefaultEngine.ini,
and keep desktop-only plugins out of the Android target.

    python3 unreal/Tools/configure_android.py [path/to/Project.uproject]

Run from a terminal, NOT from inside the editor: it edits a config file the
running editor has already read, so the editor must be closed.

Why a script and not Project Settings: there are two dozen values across four
sections, several of them the kind that look right and silently package an
unplayable build. Setting them by hand once is fine; setting them again after a
fresh clone, or checking whether they are still right, is not.

Idempotent. Keys we own are overwritten, keys we do not are left alone, and the
original is copied to DefaultEngine.ini.bak the first time anything changes.
"""

import json
import os
import re
import shutil
import sys

DEFAULT_PROJECT = "/Users/fahimdotfm/UE_Projects/Eat Your Way/EatYourWay/EatYourWay.uproject"

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(os.path.dirname(HERE), "Config", "Android.ini")

# Plugins this project does not use, and which break the cook.
#
# These are switched OFF, not merely held back from Android. A PlatformDenyList
# is evaluated against the TARGET platform, but the cook commandlet runs on the
# host: UnrealEditor-Cmd on the Mac loads plugins for the Mac, so denying a
# plugin to Android never reaches the process that is failing.
#
# Cesium earns its place here twice over. It already logs errors in the editor
# ("EnumProperty FCesiumMetadataPropertyStatisticValue::Semantic is not
# initialized properly. Module:CesiumRuntime"), which the editor survives by
# warning and carrying on. A commandlet run with -unattended has nobody to warn,
# so the same broken module load becomes a hard exit and takes the cook with it.
# And nothing here uses it: no file in Source/Curbside includes a Cesium header,
# and the city is built from exported JSON, not Cesium tilesets.
#
# To put it back: set "Enabled": true for it in the .uproject, or delete the
# entry entirely, and it returns to whatever the engine default was.
UNUSED_PLUGINS = ["CesiumForUnreal"]


def parse_ini(text):
    """[(section, [(key, value), ...]), ...] — order preserved, comments dropped."""
    sections = []
    current = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(";") or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = (line, [])
            sections.append(current)
            continue
        if current is not None and "=" in line:
            key, _, value = line.partition("=")
            current[1].append((key.strip(), value.strip()))
    return sections


def merge(existing_text, wanted):
    """
    Return (new_text, changes). Keys in `wanted` are set in place where the
    section already exists, and the section is appended where it does not.
    """
    lines = existing_text.splitlines()
    changes = []

    for section, pairs in wanted:
        # Find the section's line range.
        start = None
        for i, line in enumerate(lines):
            if line.strip() == section:
                start = i
                break

        if start is None:
            lines.append("")
            lines.append(section)
            for key, value in pairs:
                lines.append("{}={}".format(key, value))
                changes.append("{} {}={}".format(section, key, value))
            continue

        end = len(lines)
        for i in range(start + 1, len(lines)):
            if lines[i].strip().startswith("[") and lines[i].strip().endswith("]"):
                end = i
                break

        for key, value in pairs:
            new_line = "{}={}".format(key, value)

            # A leading + means "add to this array", and Unreal allows the same
            # key many times. Replacing the first match would silently delete
            # whatever else the project had put there, so these are only ever
            # appended, and only if the exact line is not already present.
            if key.startswith("+"):
                if any(lines[i].strip() == new_line for i in range(start + 1, end)):
                    continue
                at = end
                while at - 1 > start and not lines[at - 1].strip():
                    at -= 1
                lines.insert(at, new_line)
                changes.append("{} {}  (added)".format(section, new_line))
                continue

            pattern = re.compile(r"^\s*" + re.escape(key) + r"\s*=")
            found = None
            for i in range(start + 1, end):
                if pattern.match(lines[i]):
                    found = i
                    break
            if found is None:
                # Insert at the end of the section, before any trailing blanks.
                at = end
                while at - 1 > start and not lines[at - 1].strip():
                    at -= 1
                lines.insert(at, new_line)
                end += 1
                changes.append("{} {}  (added)".format(section, new_line))
            elif lines[found].strip() != new_line:
                changes.append("{} {}  (was {})".format(
                    section, new_line, lines[found].strip()))
                lines[found] = new_line

    return "\n".join(lines) + "\n", changes


def disable_unused_plugins(project):
    """
    Switch off the plugins in UNUSED_PLUGINS in the .uproject. Returns a list
    of what changed.

    A plugin enabled by default at the engine level — a Fab or Marketplace
    install — is not listed in the .uproject at all, so an entry is added for
    it. An explicit "Enabled": false there overrides the engine default.
    """
    with open(project, "r") as handle:
        data = json.load(handle)

    plugins = data.setdefault("Plugins", [])
    changes = []

    for name in UNUSED_PLUGINS:
        entry = next((p for p in plugins if p.get("Name") == name), None)
        if entry is None:
            plugins.append({"Name": name, "Enabled": False})
            changes.append("{}: disabled".format(name))
            continue

        # Clear a PlatformDenyList an earlier version of this script added.
        # It never worked, and leaving it behind would suggest it did.
        entry.pop("PlatformDenyList", None)

        if entry.get("Enabled", True):
            entry["Enabled"] = False
            changes.append("{}: disabled".format(name))

    if changes:
        shutil.copyfile(project, project + ".bak")
        with open(project, "w") as handle:
            # Unreal writes .uproject with tabs; match it so the diff stays
            # small if the editor rewrites the file later.
            json.dump(data, handle, indent="\t")
            handle.write("\n")

    return changes


def main():
    project = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROJECT
    if not os.path.isfile(project):
        print("error: no .uproject at {}".format(project))
        print("usage: python3 unreal/Tools/configure_android.py [Project.uproject]")
        return 1

    if not os.path.isfile(SOURCE):
        print("error: settings not found at {}".format(SOURCE))
        return 1

    target = os.path.join(os.path.dirname(project), "Config", "DefaultEngine.ini")
    if not os.path.isfile(target):
        print("error: no DefaultEngine.ini at {}".format(target))
        return 1

    with open(SOURCE, "r") as handle:
        wanted = parse_ini(handle.read())
    with open(target, "r") as handle:
        existing = handle.read()

    merged, changes = merge(existing, wanted)

    if changes:
        shutil.copyfile(target, target + ".bak")
        with open(target, "w") as handle:
            handle.write(merged)

        print("Updated {}".format(target))
        print("  (previous version saved as DefaultEngine.ini.bak)")
        print()
        for change in changes:
            print("  {}".format(change))
        print()
        print("{} setting(s) changed.".format(len(changes)))
    else:
        print("Android settings already correct in:")
        print("  {}".format(target))

    try:
        plugin_changes = disable_unused_plugins(project)
    except (OSError, ValueError) as exc:
        print()
        print("warning: could not update the plugin list in the .uproject: {}".format(exc))
        print("         if the cook fails loading a plugin, set its")
        print("         \"Enabled\": false in the .uproject by hand.")
        return 0

    print()
    if plugin_changes:
        print("Unused plugins switched off (previous .uproject saved as .bak):")
        for change in plugin_changes:
            print("  {}".format(change))
        print()
        print("  These are off in the EDITOR too, not just on the phone.")
        print("  Nothing here uses them; set \"Enabled\": true in the .uproject")
        print("  to bring one back.")
    else:
        print("Unused plugins already switched off.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
