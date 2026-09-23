"""
Curbside — build the city.

Reads unreal/Data/world_instances.json and spawns it as Instanced Static Mesh
components: 3,019 buildings, the road grid, the elevated 7 train, Flushing Bay,
Flushing Meadows and the LaGuardia runways.

Run inside the Unreal Editor:
    Tools > Execute Python Script...  ->  this file

Safe to re-run: it deletes the actors it made last time before rebuilding.

All the geometry was computed in Node by tools/export-unreal-world.mjs, where it
could be verified. This script only places transforms, which keeps the part that
cannot be tested from outside the editor as simple as possible.

One instanced component per category means six draw calls for the whole city
rather than four thousand actors.
"""

import json
import os
import unreal

SCRIPT_VERSION = "2026-09-23.1"

CUBE_PATH = "/Game/LevelPrototyping/Meshes/SM_Cube"
MATERIAL_PATH = "/Game/Curbside/Materials"

# category -> (actor label, base colour, roughness)
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


def clear_previous(eas, labels):
    """Remove what a previous run built, so re-running rebuilds rather than stacks."""
    removed = 0
    for actor in eas.get_all_level_actors():
        if actor.get_actor_label() in labels:
            eas.destroy_actor(actor)
            removed += 1
    if removed:
        ok("cleared {} actor(s) from a previous run".format(removed))


def build():
    unreal.log("[Curbside] ================================================")
    unreal.log("[Curbside] build_world.py  version {}".format(SCRIPT_VERSION))
    unreal.log("[Curbside] ================================================")

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

    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    clear_previous(eas, {label for _, label, _, _ in CATEGORIES})

    origin = unreal.Vector(0.0, 0.0, 0.0)
    no_rot = unreal.Rotator(0.0, 0.0, 0.0)
    total = 0

    for key, label, rgb, roughness in CATEGORIES:
        entries = world.get(key, [])
        if not entries:
            continue
        try:
            actor = eas.spawn_actor_from_class(unreal.Actor, origin, no_rot)
            actor.set_actor_label(label)

            ism = actor.add_component_by_class(
                unreal.InstancedStaticMeshComponent, False, unreal.Transform(), False)
            ism.set_static_mesh(cube)
            # Static mobility lets the renderer cull and batch these properly;
            # nothing in the city moves.
            ism.set_mobility(unreal.ComponentMobility.STATIC)

            material = make_material("M_" + key.capitalize(), rgb, roughness)
            if material:
                ism.set_material(0, material)

            for e in entries:
                loc = unreal.Vector(e["l"][0], e["l"][1], e["l"][2])
                rot = unreal.Rotator(0.0, 0.0, e["r"])
                scale = unreal.Vector(e["s"][0], e["s"][1], e["s"][2])
                ism.add_instance(unreal.Transform(loc, rot, scale))

            total += len(entries)
            ok("{}: {} instances".format(label, len(entries)))
        except Exception as exc:
            fail(label, exc)

    unreal.log("[Curbside] ---- summary ----")
    unreal.log("[Curbside] {} instances placed across {} categories".format(total, len(_OK)))
    for line in _OK:
        unreal.log("[Curbside]   + " + line)
    if _FAIL:
        unreal.log_warning("[Curbside] failed: {}".format(len(_FAIL)))
        for line in _FAIL:
            unreal.log_warning("[Curbside]   - " + line)
    else:
        unreal.log("[Curbside] no failures.")
    unreal.log("[Curbside] Save the level to keep this. Fly east along +X to see Queens.")


build()
