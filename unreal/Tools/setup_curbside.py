"""
Curbside — one-shot editor setup.

Creates everything the game needs that can be made from script: the vendor
Blueprint, Enhanced Input assets and mapping contexts, Blueprint subclasses of
the pawns with their specs and input wired up, a GameMode, and the level actors.

Run inside the Unreal Editor:
    Tools > Execute Python Script...  ->  this file

Safe to re-run. Existing assets are updated in place rather than duplicated.

WHAT THIS CANNOT DO
  The Chaos wheeled vehicle needs a skeletal mesh with named wheel bones and a
  physics asset. That is art authoring, not scripting, so BP_Car is skipped.
  Everything else below is created for you.

Each step is independent and wrapped, so one failure does not abort the rest.
Read the summary at the end: it lists exactly what worked and what did not.
"""

import unreal

# ---------------------------------------------------------------- configuration

SCRIPT_VERSION = "2026-09-23.2"

ROOT = "/Game/Curbside"
P_BLUEPRINTS = ROOT + "/Blueprints"
P_INPUT = ROOT + "/Input"
P_VEHICLES = ROOT + "/Vehicles"

# Placeholder mesh from the Third Person template. Swap for real art later.
PLACEHOLDER_CUBE = "/Game/LevelPrototyping/Meshes/SM_Cube"

# The ground slab, sized to catch every vendor from Jackson Heights to Flushing.
# Vendors span x 478-5543 m and y -325 to +245 m; this covers it with margin.
GROUND_LOCATION = (300000.0, -5000.0, -100.0)
GROUND_SCALE = (6000.0, 700.0, 1.0)

# Set False to leave your level untouched and only create assets.
MODIFY_LEVEL = True

_OK = []
_FAIL = []


def ok(msg):
    _OK.append(msg)
    unreal.log("[Curbside] OK   " + msg)


def fail(msg, err=None):
    detail = "{}{}".format(msg, ": {}".format(err) if err else "")
    _FAIL.append(detail)
    unreal.log_error("[Curbside] FAIL " + detail)


def step(fn):
    """Run one setup step; never let a failure kill the whole script."""
    def wrapped(*a, **kw):
        try:
            return fn(*a, **kw)
        except Exception as exc:
            fail(fn.__name__, exc)
            return None
    wrapped.__name__ = fn.__name__
    return wrapped


# ---------------------------------------------------------------------- helpers

def asset_tools():
    return unreal.AssetToolsHelpers.get_asset_tools()


def load(path):
    return unreal.EditorAssetLibrary.load_asset(path) if unreal.EditorAssetLibrary.does_asset_exist(path) else None


def ensure_asset(name, package_path, asset_class, factory):
    """Load the asset if it exists, otherwise create it."""
    full = "{}/{}".format(package_path, name)
    existing = load(full)
    if existing:
        return existing
    return asset_tools().create_asset(name, package_path, asset_class, factory)


def make_blueprint(name, parent_class, package_path=P_BLUEPRINTS):
    """Create (or load) a Blueprint whose parent is a C++ class."""
    full = "{}/{}".format(package_path, name)
    existing = load(full)
    if existing:
        return existing
    factory = unreal.BlueprintFactory()
    factory.set_editor_property("parent_class", parent_class)
    return asset_tools().create_asset(name, package_path, unreal.Blueprint, factory)


def cdo_of(blueprint):
    """The Class Default Object — where inherited C++ properties are edited."""
    return unreal.get_default_object(blueprint.generated_class())


def save(asset):
    unreal.EditorAssetLibrary.save_loaded_asset(asset)


def make_key(name):
    """Build an FKey by name, e.g. 'W', 'SpaceBar', 'LeftShift', 'Mouse2D'."""
    try:
        k = unreal.Key()
        k.set_editor_property("key_name", name)
        return k
    except Exception:
        return getattr(unreal.InputCoreKeys, name)


def new_modifier(cls):
    return unreal.new_object(cls)


def find_class(*candidates):
    """First of these that exists on the unreal module, or None."""
    for name in candidates:
        found = getattr(unreal, name, None)
        if found is not None:
            return found
    return None


def resolve_enum(enum_candidates, member_label):
    """Look up an enum member by human label, tolerating Unreal's renaming.

    Unreal's Python bindings uppercase and underscore enum members, and exactly
    where the underscores land has changed between versions: "Axis2D" has been
    AXIS2_D, AXIS2D and AXIS_2D. Matching on the letters alone survives all of
    them, and is why this is resolved at runtime instead of hard-coded.
    """
    enum = find_class(*enum_candidates)
    if enum is None:
        return None
    want = member_label.upper().replace("_", "")
    for attr in dir(enum):
        if attr.startswith("_"):
            continue
        if attr.upper().replace("_", "") == want:
            return getattr(enum, attr)
    return None


@step
def probe_api():
    """Log what this engine version exposes for the parts most likely to differ.

    Written because this script could not be tested before you ran it: even if
    a later step fails, this output names the real symbols so the next pass is
    a fix rather than another guess.
    """
    def members(obj):
        return sorted(a for a in dir(obj) if not a.startswith("_"))

    for enum_name in ("InputActionValueType", "EInputActionValueType",
                      "InputAxisSwizzle", "EInputAxisSwizzle"):
        e = getattr(unreal, enum_name, None)
        unreal.log("[Curbside] api enum unreal.{}: {}".format(
            enum_name, members(e) if e is not None else "MISSING"))

    for cls_name in ("InputAction", "InputMappingContext", "EnhancedActionKeyMapping",
                     "InputModifierSwizzleAxis", "InputModifierNegate",
                     "InputActionFactory", "InputMappingContextFactory",
                     "DataAssetFactory", "BlueprintFactory", "EditorActorSubsystem"):
        unreal.log("[Curbside] api class unreal.{}: {}".format(
            cls_name, "present" if hasattr(unreal, cls_name) else "MISSING"))

    ok("api probe logged")


# ------------------------------------------------------------------ input assets

# name -> value type, as a plain label. Unreal's Python bindings rename enum
# members between versions (AXIS2_D vs AXIS2D vs ...), so these are resolved at
# runtime by resolve_enum rather than hard-coded.
INPUT_ACTIONS = {
    "IA_Move":     "Axis2D",
    "IA_Look":     "Axis2D",
    "IA_Cyclic":   "Axis2D",
    "IA_Throttle": "Axis1D",
    "IA_Steer":    "Axis1D",
    "IA_Yaw":      "Axis1D",
    "IA_Lift":     "Axis1D",
    "IA_Jump":     "Boolean",
    "IA_Sprint":   "Boolean",
    "IA_Brake":    "Boolean",
    "IA_Interact": "Boolean",
    "IA_Exit":     "Boolean",
}


@step
def create_input_actions():
    made = {}
    factory = None
    # The factory class name has moved around between versions; try the likely
    # ones and fall back to a plain create, which works for simple assets.
    for candidate in ("InputActionFactory", "InputActionFactory1"):
        if hasattr(unreal, candidate):
            factory = getattr(unreal, candidate)()
            break

    for name, label in INPUT_ACTIONS.items():
        asset = ensure_asset(name, P_INPUT, unreal.InputAction, factory)
        if not asset:
            fail("create " + name)
            continue
        value_type = resolve_enum(
            ("InputActionValueType", "EInputActionValueType"), label)
        if value_type is None:
            fail("no enum member for value type '{}' (see api probe)".format(label))
        else:
            asset.set_editor_property("value_type", value_type)
        save(asset)
        made[name] = asset

    ok("input actions: {}/{}".format(len(made), len(INPUT_ACTIONS)))
    return made


def mapping(action, key_name, negate=False, swizzle=False):
    """One key -> action binding, with the modifiers Enhanced Input needs.

    A keyboard key produces a 1D value on X. To drive the Y axis of an Axis2D
    (W/S for forward/back) it must be swizzled; to drive the negative direction
    (S, A) it must be negated.
    """
    m = unreal.EnhancedActionKeyMapping()
    m.set_editor_property("action", action)
    m.set_editor_property("key", make_key(key_name))
    mods = []
    if swizzle:
        swizzle_cls = find_class("InputModifierSwizzleAxis")
        if swizzle_cls is not None:
            sw = new_modifier(swizzle_cls)
            order = resolve_enum(("InputAxisSwizzle", "EInputAxisSwizzle"), "YXZ")
            if order is not None:
                sw.set_editor_property("order", order)
            mods.append(sw)
    if negate:
        negate_cls = find_class("InputModifierNegate")
        if negate_cls is not None:
            mods.append(new_modifier(negate_cls))
    if mods:
        m.set_editor_property("modifiers", mods)
    return m


@step
def create_mapping_contexts(actions):
    factory = None
    for candidate in ("InputMappingContextFactory", "InputMappingContext_Factory"):
        if hasattr(unreal, candidate):
            factory = getattr(unreal, candidate)()
            break

    A = actions

    layouts = {
        "IMC_OnFoot": [
            mapping(A["IA_Move"], "W", swizzle=True),
            mapping(A["IA_Move"], "S", swizzle=True, negate=True),
            mapping(A["IA_Move"], "D"),
            mapping(A["IA_Move"], "A", negate=True),
            mapping(A["IA_Look"], "Mouse2D"),
            mapping(A["IA_Jump"], "SpaceBar"),
            mapping(A["IA_Sprint"], "LeftShift"),
            mapping(A["IA_Interact"], "F"),
        ],
        "IMC_Flight": [
            # Cyclic: W/S pitch, A/D roll.
            mapping(A["IA_Cyclic"], "W", swizzle=True),
            mapping(A["IA_Cyclic"], "S", swizzle=True, negate=True),
            mapping(A["IA_Cyclic"], "D"),
            mapping(A["IA_Cyclic"], "A", negate=True),
            mapping(A["IA_Yaw"], "E"),
            mapping(A["IA_Yaw"], "Q", negate=True),
            # Collective for helicopters, also the plane's climb input.
            mapping(A["IA_Lift"], "SpaceBar"),
            mapping(A["IA_Lift"], "LeftShift", negate=True),
            mapping(A["IA_Throttle"], "Up"),
            mapping(A["IA_Throttle"], "Down", negate=True),
            mapping(A["IA_Exit"], "F"),
        ],
        "IMC_Boat": [
            mapping(A["IA_Throttle"], "W"),
            mapping(A["IA_Throttle"], "S", negate=True),
            mapping(A["IA_Steer"], "D"),
            mapping(A["IA_Steer"], "A", negate=True),
            mapping(A["IA_Exit"], "F"),
        ],
    }

    made = {}
    for name, maps in layouts.items():
        ctx = ensure_asset(name, P_INPUT, unreal.InputMappingContext, factory)
        if not ctx:
            fail("create " + name)
            continue
        ctx.set_editor_property("mappings", maps)
        save(ctx)
        made[name] = ctx

    ok("mapping contexts: {}/{}".format(len(made), len(layouts)))
    return made


# -------------------------------------------------------------------- blueprints

@step
def create_vendor_blueprint():
    bp = make_blueprint("BP_Vendor", unreal.CurbsideVendorActor)
    if not bp:
        fail("create BP_Vendor")
        return None

    cube = load(PLACEHOLDER_CUBE)
    if not cube:
        fail("placeholder mesh missing at " + PLACEHOLDER_CUBE)
    else:
        cdo = cdo_of(bp)
        # These components come from C++, so they live on the CDO rather than
        # in the Blueprint's construction script.
        stall = cdo.get_editor_property("stall_mesh")
        stall.set_static_mesh(cube)
        stall.set_relative_scale3d(unreal.Vector(3.0, 3.0, 2.6))

        pin = cdo.get_editor_property("pin_mesh")
        pin.set_static_mesh(cube)
        pin.set_relative_scale3d(unreal.Vector(0.6, 0.6, 0.6))

    save(bp)
    ok("BP_Vendor")
    return bp


PAWNS = [
    # (blueprint name, C++ class, vehicle spec asset or None)
    ("BP_CurbsideCharacter", "CurbsideCharacter",   None),
    ("BP_Helicopter",        "CurbsideAircraftPawn", "DA_Vehicle_helicopter"),
    ("BP_Plane",             "CurbsideAircraftPawn", "DA_Vehicle_cessna"),
    ("BP_Speedboat",         "CurbsideBoatPawn",     "DA_Vehicle_speedboat"),
]

# Which input properties each C++ class exposes, as Python (snake_case) names.
INPUT_WIRING = {
    "CurbsideCharacter": {
        "on_foot_context": "IMC_OnFoot",
        "move_action": "IA_Move",
        "look_action": "IA_Look",
        "jump_action": "IA_Jump",
        "sprint_action": "IA_Sprint",
        "interact_action": "IA_Interact",
    },
    "CurbsideAircraftPawn": {
        "flight_context": "IMC_Flight",
        "throttle_action": "IA_Throttle",
        "cyclic_action": "IA_Cyclic",
        "yaw_action": "IA_Yaw",
        "lift_action": "IA_Lift",
        "exit_action": "IA_Exit",
    },
    "CurbsideBoatPawn": {
        "boat_context": "IMC_Boat",
        "throttle_action": "IA_Throttle",
        "steer_action": "IA_Steer",
        "exit_action": "IA_Exit",
    },
}


@step
def create_pawn_blueprints(actions, contexts):
    assets = dict(actions)
    assets.update(contexts)
    made = {}

    for bp_name, cls_name, spec_name in PAWNS:
        parent = getattr(unreal, cls_name, None)
        if parent is None:
            fail("C++ class not found: " + cls_name)
            continue

        bp = make_blueprint(bp_name, parent)
        if not bp:
            fail("create " + bp_name)
            continue

        cdo = cdo_of(bp)

        if spec_name:
            spec = load("{}/{}".format(P_VEHICLES, spec_name))
            if spec:
                cdo.set_editor_property("spec", spec)
            else:
                fail("spec missing for {}: {}".format(bp_name, spec_name))

        for prop, asset_name in INPUT_WIRING.get(cls_name, {}).items():
            target = assets.get(asset_name)
            if target is None:
                continue
            try:
                cdo.set_editor_property(prop, target)
            except Exception as exc:
                fail("{}.{}".format(bp_name, prop), exc)

        # Aircraft and boats need a visible hull and working physics.
        cube = load(PLACEHOLDER_CUBE)
        if cube and cls_name in ("CurbsideAircraftPawn", "CurbsideBoatPawn"):
            hull = cdo.get_editor_property("hull")
            hull.set_static_mesh(cube)
            hull.set_relative_scale3d(unreal.Vector(2.0, 1.0, 0.8))

        save(bp)
        made[bp_name] = bp
        ok(bp_name)

    return made


@step
def create_game_mode(pawns):
    bp = make_blueprint("BP_CurbsideGameMode", unreal.GameModeBase)
    if not bp:
        fail("create BP_CurbsideGameMode")
        return None

    cdo = cdo_of(bp)
    cdo.set_editor_property("player_state_class", unreal.CurbsidePlayerState)

    character = pawns.get("BP_CurbsideCharacter")
    if character:
        cdo.set_editor_property("default_pawn_class", character.generated_class())

    save(bp)
    ok("BP_CurbsideGameMode (PlayerState = CurbsidePlayerState)")
    return bp


# ------------------------------------------------------------------- level setup

@step
def setup_level(vendor_bp):
    if not MODIFY_LEVEL:
        ok("level untouched (MODIFY_LEVEL is False)")
        return

    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    existing = eas.get_all_level_actors()

    # Ground slab, so vendors have something to snap onto.
    ground = next((a for a in existing if a.get_actor_label() == "Curbside_Ground"), None)
    if ground is None:
        ground = eas.spawn_actor_from_class(
            unreal.StaticMeshActor, unreal.Vector(*GROUND_LOCATION), unreal.Rotator(0, 0, 0))
        ground.set_actor_label("Curbside_Ground")
    cube = load(PLACEHOLDER_CUBE)
    if cube:
        ground.static_mesh_component.set_static_mesh(cube)
    ground.set_actor_scale3d(unreal.Vector(*GROUND_SCALE))
    ground.set_actor_location(unreal.Vector(*GROUND_LOCATION), False, False)
    ok("ground slab (6 km x 700 m)")

    # Point any existing spawner at the vendor Blueprint, or make one.
    spawner = next((a for a in existing
                    if isinstance(a, unreal.CurbsideVendorSpawner)), None)
    if spawner is None:
        spawner = eas.spawn_actor_from_class(
            unreal.CurbsideVendorSpawner, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
        spawner.set_actor_label("CurbsideVendorSpawner")

    table = load("/Game/ThirdPerson/Blueprints/DT_Vendors") or load(ROOT + "/DT_Vendors")
    if table:
        spawner.set_editor_property("vendor_table", table)
    else:
        fail("DT_Vendors not found; set Vendor Table by hand")

    if vendor_bp:
        spawner.set_editor_property("vendor_class", vendor_bp.generated_class())
    ok("vendor spawner wired to BP_Vendor")


# --------------------------------------------------------------------------- run

def main():
    unreal.log("[Curbside] ================================================")
    unreal.log("[Curbside] setup_curbside.py  version {}".format(SCRIPT_VERSION))
    unreal.log("[Curbside] ================================================")

    probe_api()

    actions = create_input_actions() or {}
    contexts = create_mapping_contexts(actions) or {}
    vendor_bp = create_vendor_blueprint()
    pawns = create_pawn_blueprints(actions, contexts) or {}
    create_game_mode(pawns)
    setup_level(vendor_bp)

    unreal.log("[Curbside] ---- summary ----")
    unreal.log("[Curbside] succeeded: {}".format(len(_OK)))
    for line in _OK:
        unreal.log("[Curbside]   + " + line)
    if _FAIL:
        unreal.log_warning("[Curbside] failed: {}".format(len(_FAIL)))
        for line in _FAIL:
            unreal.log_warning("[Curbside]   - " + line)
    else:
        unreal.log("[Curbside] no failures.")
    unreal.log("[Curbside] Set World Settings > GameMode Override to "
               "BP_CurbsideGameMode, then press Play.")


main()
