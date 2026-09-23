"""
Curbside — put the vehicles in the city.

Run AFTER build_world.py (which places the city) and setup_curbside.py
(which makes the pawn Blueprints):

    Tools > Execute Python Script...  ->  this file

Every vehicle goes somewhere it makes sense: cars and bikes parked along the
roads nearest the player start, boats on Flushing Bay, the two planes on the
LaGuardia runways, the helicopter on the tarmac beside them.

The positions are read out of unreal/Data/world_instances.json rather than
written down here, so if the generator moves a runway the aircraft move with it.

Safe to re-run: it deletes the vehicles it placed last time first.
"""

import json
import math
import os
import unreal

SCRIPT_VERSION = "2026-09-23.10"

BLUEPRINTS = "/Game/Curbside/Blueprints"
LABEL_PREFIX = "Curbside_Vehicle_"

# Blueprint -> where it belongs. Anything not listed is parked on a road.
ON_RUNWAY = ("BP_Plane", "BP_Jet")
ON_APRON = ("BP_Helicopter",)
ON_WATER = ("BP_Jetski", "BP_Speedboat", "BP_Ferry")

_OK, _FAIL = [], []


def ok(msg):
    _OK.append(msg)
    unreal.log("[Curbside] OK   " + msg)


def fail(msg, err=None):
    detail = "{}{}".format(msg, ": {}".format(err) if err else "")
    _FAIL.append(detail)
    unreal.log_error("[Curbside] FAIL " + detail)


def note(msg):
    unreal.log("[Curbside]      " + msg)


def vehicle_sizes():
    """
    Blueprint name -> (length, width, height) in metres.

    Mirrors the naming rule in setup_curbside.py. Without the height a bus and
    a jetski spawn with their centres at the same Z, which buries one and
    floats the other.
    """
    overrides = {"helicopter": "BP_Helicopter",
                 "cessna": "BP_Plane",
                 "speedboat": "BP_Speedboat"}
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(os.path.dirname(here), "Data", "vehicle_specs.json")
    sizes = {}
    try:
        with open(path, "r") as handle:
            for spec in json.load(handle):
                size = spec.get("SizeMeters")
                if not size or len(size) != 3:
                    continue
                vid = spec["VehicleId"]
                name = overrides.get(vid, "BP_" + vid[:1].upper() + vid[1:])
                # web [width, height, length] -> (length, width, height)
                sizes[name] = (size[2], size[0], size[1])
    except Exception as exc:
        note("could not read vehicle sizes ({}); using 1.5 m".format(exc))
    return sizes


def world_data():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(os.path.dirname(here), "Data", "world_instances.json")
    with open(path, "r") as handle:
        return json.load(handle)


def load_asset(path):
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.EditorAssetLibrary.load_asset(path)
    return None


def all_actors():
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    return [a for a in eas.get_all_level_actors() if a is not None]


def reference_point(actors):
    """
    Where the player starts. Cars are parked near here so the first thing you
    see on pressing Play is something you can get into.
    """
    for actor in actors:
        if isinstance(actor, unreal.PlayerStart):
            loc = actor.get_actor_location()
            return (loc.x, loc.y)
    note("no PlayerStart found; parking relative to the world origin")
    return (0.0, 0.0)


def clear_previous(actors):
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    removed = 0
    for actor in actors:
        try:
            label = actor.get_actor_label()
        except Exception:
            continue
        if label.startswith(LABEL_PREFIX):
            eas.destroy_actor(actor)
            removed += 1
    if removed:
        ok("cleared {} vehicle(s) from a previous run".format(removed))


def rest_z(surface_z, height_m):
    """Sit the body on the surface with the suspension extended."""
    return surface_z + height_m * 50.0 + 40.0


def road_slots(world, origin, wanted):
    """
    Parking spaces along the roads nearest the player, one per road so the
    vehicles are spread across the neighbourhood rather than in a stack.

    A road instance is a long thin box: `s[0]` is its length in cube-widths and
    `r` its yaw. Parking sits one lane-width off the centreline, which for a
    22 m-wide road means roughly where a kerb would be.
    """
    roads = world.get("roads", [])
    if not roads:
        return []

    def distance(entry):
        return math.hypot(entry["l"][0] - origin[0], entry["l"][1] - origin[1])

    slots = []
    for road in sorted(roads, key=distance):
        yaw = road["r"]
        rad = math.radians(yaw)
        length = road["s"][0] * 100.0
        width = road["s"][1] * 100.0
        cx, cy, cz = road["l"]

        # Along the road, then out to the kerb.
        for along in (-0.22, 0.10, 0.34):
            if len(slots) >= wanted:
                return slots
            offset = along * length
            kerb = width * 0.34
            x = cx + math.cos(rad) * offset - math.sin(rad) * kerb
            y = cy + math.sin(rad) * offset + math.cos(rad) * kerb
            # Road boxes are 0.3 cube-heights tall, so the surface is cz + 15.
            slots.append(((x, y, cz + 15.0), yaw))
    return slots


def runway_slots(world):
    """Line the aircraft up on the runway threshold, pointing down it."""
    out = []
    for runway in world.get("runways", []):
        yaw = runway["r"]
        rad = math.radians(yaw)
        length = runway["s"][0] * 100.0
        cx, cy, cz = runway["l"]
        # A third of the way back from the centre, so there is room to roll.
        offset = -length * 0.34
        out.append((((cx + math.cos(rad) * offset),
                     (cy + math.sin(rad) * offset),
                     cz + 15.0), yaw))
    return out


def water_slots(world, origin, wanted):
    """
    Moorings, on the nearest stretch of water to the player.

    The map has two bodies of water four kilometres apart, so picking tiles
    straight off the list put one boat in Flushing Bay and another off the far
    west edge. Sort by distance first, then spread across the nearest quarter:
    close enough to walk to, far enough apart not to spawn inside each other.
    """
    tiles = world.get("water", [])
    if not tiles or wanted <= 0:
        return []

    def distance(tile):
        return math.hypot(tile["l"][0] - origin[0], tile["l"][1] - origin[1])

    near = sorted(tiles, key=distance)[:max(wanted, len(tiles) // 4)]
    step = max(1, len(near) // (wanted + 1))
    out = []
    for i in range(wanted):
        tile = near[min(len(near) - 1, (i + 1) * step)]
        x, y, _z = tile["l"]
        # Boats float against Spec->WaterLevelZ; the surface is Z = 0.
        out.append(((x, y, 0.0), (i * 37) % 360))
    return out


def blueprint_class(name):
    asset = load_asset("{}/{}".format(BLUEPRINTS, name))
    if asset is None:
        return None
    try:
        return asset.generated_class()
    except Exception:
        return None


def place(name, cls, slot):
    (x, y, z), yaw = slot
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actor = eas.spawn_actor_from_class(
        cls, unreal.Vector(x, y, z), unreal.Rotator(0.0, 0.0, yaw))
    if actor is None:
        return False
    actor.set_actor_label(LABEL_PREFIX + name.replace("BP_", ""))
    return True


def build():
    unreal.log("[Curbside] ================================================")
    unreal.log("[Curbside] place_vehicles.py  version {}".format(SCRIPT_VERSION))
    unreal.log("[Curbside] ================================================")

    try:
        world = world_data()
    except Exception as exc:
        fail("read world_instances.json", exc)
        return

    # Every pawn Blueprint setup_curbside.py made, minus the character.
    names = []
    for asset in unreal.EditorAssetLibrary.list_assets(BLUEPRINTS, recursive=False):
        short = asset.split("/")[-1].split(".")[0]
        if short.startswith("BP_") and short not in ("BP_Vendor",
                                                     "BP_CurbsideCharacter",
                                                     "BP_CurbsideGameMode"):
            names.append(short)
    names.sort()

    if not names:
        fail("no vehicle Blueprints in {} — run setup_curbside.py first".format(BLUEPRINTS))
        return
    note("found {} vehicle blueprint(s): {}".format(len(names), ", ".join(names)))

    actors = all_actors()
    clear_previous(actors)
    origin = reference_point(actors)

    runway = [n for n in names if n in ON_RUNWAY]
    apron = [n for n in names if n in ON_APRON]
    water = [n for n in names if n in ON_WATER]
    road = [n for n in names if n not in runway + apron + water]

    runways = runway_slots(world)
    waters = water_slots(world, origin, len(water))
    roads = road_slots(world, origin, len(road) + len(apron))

    placed = 0
    plans = []
    for i, name in enumerate(runway):
        plans.append((name, runways[i] if i < len(runways) else None))
    for i, name in enumerate(water):
        plans.append((name, waters[i] if i < len(waters) else None))
    # The helicopter gets a road slot too — it can lift off from anywhere, and
    # parking it next to the cars means you do not have to walk to LaGuardia.
    for i, name in enumerate(apron + road):
        plans.append((name, roads[i] if i < len(roads) else None))

    sizes = vehicle_sizes()
    for name, slot in plans:
        if slot is None:
            fail("{}: nowhere to put it".format(name))
            continue
        cls = blueprint_class(name)
        if cls is None:
            fail("{}: could not load the Blueprint class".format(name))
            continue
        height = sizes.get(name, (4.0, 2.0, 1.5))[2]
        (sx, sy, surface), yaw = slot
        slot = ((sx, sy, rest_z(surface, height)), yaw)
        if place(name, cls, slot):
            placed += 1
            ok("{} at ({:.0f}, {:.0f}, {:.0f}) yaw {:.0f}".format(
                name, slot[0][0], slot[0][1], slot[0][2], slot[1]))
        else:
            fail("{}: spawn failed".format(name))

    unreal.log("[Curbside] ---- summary ----")
    unreal.log("[Curbside] {} vehicle(s) placed".format(placed))
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
