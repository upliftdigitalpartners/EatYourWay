"""
Curbside — build the city.

Reads unreal/Data/world_instances.json and places it as Instanced Static Mesh
components: 3,019 buildings, the road grid, the elevated 7 train, Flushing Bay,
Flushing Meadows and the LaGuardia runways.

Run inside the Unreal Editor:
    Tools > Execute Python Script...  ->  this file

Safe to re-run: it replaces what the last run built rather than stacking on it.

REQUIRES a rebuilt C++ module. Unreal's Python API cannot add a component to an
actor — AddComponentByClass is not exposed — so the InstancedStaticMeshComponent
has to come from C++. That is ACurbsideWorldChunk. Stage and build the module
first; this script checks and tells you if it is missing.

All the geometry was computed in Node by tools/export-unreal-world.mjs, where it
could be verified. This script only marshals transforms, which keeps the part
that cannot be tested from outside the editor as small as possible.
"""

import json
import os
import unreal

SCRIPT_VERSION = "2026-09-23.3"

CUBE_PATH = "/Game/LevelPrototyping/Meshes/SM_Cube"
MATERIAL_PATH = "/Game/Curbside/Materials"

# category key -> (actor label, base colour, roughness)
CATEGORIES = [
    ("buildings", "Curbside_Buildings", (0.42, 0.40, 0.37), 0.85),
    ("roads",     "Curbside_Roads",     (0.08, 0.08, 0.09), 0.92),
    ("rails",     "Curbside_Rails",     (0.20, 0.17, 0.15), 0.60),
    ("water",     "Curbside_Water",     (0.02, 0.09, 0.20), 0.12),
    ("parks",     "Curbside_Parks",     (0.06, 0.20, 0.08), 0.95),
    ("runways",   "Curbside_Runways",   (0.55, 0.55, 0.56), 0.80),
]

_OK, _FAIL = [], []


def ok(msg):
    _OK.append(msg)
    unreal.log("[Curbside] OK   " + msg)


def fail(msg, err=None):
    detail = "{}{}".format(msg, ": {}".format(err) if err else "")
    _FAIL.append(detail)
    unreal.log_error("[Curbside] FAIL " + detail)


def data_path():
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(os.path.dirname(here), "Data", "world_instances.json")


def load(path):
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.EditorAssetLibrary.load_asset(path)
    return None


# ---------------------------------------------------------------------------
# unreal.Transform construction
#
# The Python bindings have changed how this struct is constructed more than
# once, and there is no way to test it from outside the editor. So rather than
# guess, build one transform every plausible way, keep the first that reads back
# correctly, and log which one it was.
# ---------------------------------------------------------------------------

def _to_quat(rotator):
    for attempt in (
        lambda: rotator.quaternion(),
        lambda: unreal.MathLibrary.conv_rotator_to_quaternion(rotator),
    ):
        try:
            return attempt()
        except Exception:
            continue
    return None


def _by_keyword(loc, rot, scale):
    return unreal.Transform(location=loc, rotation=rot, scale=scale)


def _by_position(loc, rot, scale):
    return unreal.Transform(loc, rot, scale)


def _by_property(loc, rot, scale):
    t = unreal.Transform()
    t.set_editor_property("translation", loc)
    t.set_editor_property("scale3d", scale)
    quat = _to_quat(rot)
    if quat is not None:
        t.set_editor_property("rotation", quat)
    return t


def _reads_back(t, loc, scale):
    """Did translation and scale actually land where we put them?"""
    try:
        got_loc = t.get_editor_property("translation")
        got_scale = t.get_editor_property("scale3d")
    except Exception:
        return False
    close = lambda a, b: abs(a - b) < 0.01
    return (close(got_loc.x, loc.x) and close(got_loc.y, loc.y) and close(got_loc.z, loc.z)
            and close(got_scale.x, scale.x) and close(got_scale.y, scale.y))


def pick_transform_builder():
    probe_loc = unreal.Vector(123.0, -456.0, 78.0)
    probe_rot = unreal.Rotator(0.0, 0.0, 33.0)
    probe_scale = unreal.Vector(2.0, 3.0, 4.0)

    for name, builder in (("keyword", _by_keyword),
                          ("positional", _by_position),
                          ("property", _by_property)):
        try:
            t = builder(probe_loc, probe_rot, probe_scale)
        except Exception as exc:
            unreal.log("[Curbside] transform probe: {} unusable ({})".format(name, exc))
            continue
        if _reads_back(t, probe_loc, probe_scale):
            ok("transform construction: {}".format(name))
            return builder
        unreal.log("[Curbside] transform probe: {} built but read back wrong".format(name))
    return None


# ---------------------------------------------------------------------------


def make_material(name, rgb, roughness):
    """A flat coloured material. Without these the whole city is one grey."""
    full = "{}/{}".format(MATERIAL_PATH, name)
    existing = load(full)
    if existing:
        return existing
    try:
        mat = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            name, MATERIAL_PATH, unreal.Material, unreal.MaterialFactoryNew())
        lib = unreal.MaterialEditingLibrary

        colour = lib.create_material_expression(
            mat, unreal.MaterialExpressionVectorParameter, -400, 0)
        colour.set_editor_property("parameter_name", "BaseColour")
        colour.set_editor_property(
            "default_value", unreal.LinearColor(rgb[0], rgb[1], rgb[2], 1.0))
        lib.connect_material_property(colour, "", unreal.MaterialProperty.MP_BASE_COLOR)

        rough = lib.create_material_expression(
            mat, unreal.MaterialExpressionScalarParameter, -400, 200)
        rough.set_editor_property("parameter_name", "Roughness")
        rough.set_editor_property("default_value", roughness)
        lib.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)

        lib.recompile_material(mat)
        unreal.EditorAssetLibrary.save_loaded_asset(mat)
        return mat
    except Exception as exc:
        fail("material " + name, exc)
        return None


def clear_orphans(labels):
    """
    Delete the empty placeholder Actors an earlier, broken run left behind.

    The chunks themselves are cleared by DestroyWorldChunks; this only catches
    plain AActors wearing a chunk's label, which is what version 2026-09-23.1
    produced before it hit AddComponentByClass and gave up.
    """
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    removed = 0
    for actor in eas.get_all_level_actors():
        if actor is None:
            continue
        if isinstance(actor, unreal.CurbsideWorldChunk):
            continue
        try:
            label = actor.get_actor_label()
        except Exception:
            continue
        if label in labels:
            eas.destroy_actor(actor)
            removed += 1
    if removed:
        ok("removed {} empty placeholder actor(s) from an earlier run".format(removed))


def instance_count(chunk):
    """Read the count back off the component, however this build exposes it."""
    for attempt in (
        lambda: chunk.instances.get_instance_count(),
        lambda: chunk.get_editor_property("instances").get_instance_count(),
        lambda: chunk.get_component_by_class(
            unreal.InstancedStaticMeshComponent).get_instance_count(),
    ):
        try:
            return attempt()
        except Exception:
            continue
    return -1


def editor_world():
    subsystem = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
    return subsystem.get_editor_world()


def require_module():
    """The C++ side has to be built before any of this can work."""
    missing = [n for n in ("CurbsideWorldChunk", "CurbsideWorldBuilder")
               if not hasattr(unreal, n)]
    if not missing:
        return True

    unreal.log_error("[Curbside] The C++ module is not built with the world builder in it.")
    unreal.log_error("[Curbside] Missing from the Python API: {}".format(", ".join(missing)))
    unreal.log_error("[Curbside] Close the editor, then in Terminal:")
    unreal.log_error("[Curbside]   ~/EatYourWay/unreal/Tools/stage_module.sh \\")
    unreal.log_error("[Curbside]     \"/Users/fahimdotfm/UE_Projects/Eat Your Way/EatYourWay/Source/EatYourWay\" \\")
    unreal.log_error("[Curbside]     EatYourWay --with-chaos")
    unreal.log_error("[Curbside] then rebuild, reopen the level, and run this script again.")
    return False


def build():
    unreal.log("[Curbside] ================================================")
    unreal.log("[Curbside] build_world.py  version {}".format(SCRIPT_VERSION))
    unreal.log("[Curbside] ================================================")

    if not require_module():
        return

    path = data_path()
    if not os.path.exists(path):
        fail("world_instances.json not found at " + path)
        return
    with open(path, "r") as handle:
        world = json.load(handle)

    cube = load(CUBE_PATH)
    if cube is None:
        fail("placeholder mesh missing at " + CUBE_PATH)
        return

    make_transform = pick_transform_builder()
    if make_transform is None:
        fail("could not construct an unreal.Transform by any known means")
        return

    context = editor_world()
    if context is None:
        fail("no editor world — open a level first")
        return

    clear_orphans({label for _, label, _, _ in CATEGORIES})
    gone = unreal.CurbsideWorldBuilder.destroy_world_chunks(context)
    if gone:
        ok("cleared {} chunk(s) from a previous run".format(gone))

    total = 0
    for key, label, rgb, roughness in CATEGORIES:
        entries = world.get(key, [])
        if not entries:
            continue
        try:
            material = make_material("M_" + key.capitalize(), rgb, roughness)

            transforms = []
            for e in entries:
                loc = unreal.Vector(e["l"][0], e["l"][1], e["l"][2])
                rot = unreal.Rotator(0.0, 0.0, e["r"])  # (roll, pitch, yaw)
                scale = unreal.Vector(e["s"][0], e["s"][1], e["s"][2])
                transforms.append(make_transform(loc, rot, scale))

            chunk = unreal.CurbsideWorldBuilder.spawn_world_chunk(
                context, key, label, cube, material, transforms)
            if chunk is None:
                fail("{}: chunk did not spawn".format(label))
                continue

            placed = instance_count(chunk)
            if placed < 0:
                # Could not read the component back; trust the C++ log line.
                total += len(entries)
                ok("{}: {} instances (count not readable from Python)".format(label, len(entries)))
            elif placed != len(entries):
                fail("{}: asked for {} instances, got {}".format(label, len(entries), placed))
            else:
                total += placed
                ok("{}: {} instances".format(label, placed))
        except Exception as exc:
            fail(label, exc)

    unreal.log("[Curbside] ---- summary ----")
    try:
        verified = unreal.CurbsideWorldBuilder.count_world_instances(context)
    except Exception:
        verified = total
    unreal.log("[Curbside] {} instances placed; {} counted back from the level".format(total, verified))
    for line in _OK:
        unreal.log("[Curbside]   + " + line)
    if _FAIL:
        unreal.log_warning("[Curbside] failed: {}".format(len(_FAIL)))
        for line in _FAIL:
            unreal.log_warning("[Curbside]   - " + line)
    else:
        unreal.log("[Curbside] no failures.")
    unreal.log("[Curbside] Save the level to keep this.")


build()
