"""
Curbside — make the city look like a city.

Run this AFTER build_world.py has placed the geometry:
    Tools > Execute Python Script...  ->  this file

Three things, all of them things build_world.py deliberately left alone because
it had one job:

  1. Lighting. A movable sun, a real-time sky light, volumetric fog and a fixed
     exposure. Grey boxes under default lighting read as nothing; the same boxes
     with a low sun and haze read as a skyline.
  2. A building material with procedural windows and per-building colour, driven
     by per-instance custom data so 3,019 buildings are not one flat grey.
  3. The custom data itself, derived from each building's own position so it is
     stable across runs.

Safe to re-run. It reuses the assets and actors it made last time.

No C++ needed — unlike adding a component, everything here is already exposed to
Python. Re-running build_world.py rebuilds the chunks and drops the custom data,
so run this again after it.
"""

import math
import unreal

SCRIPT_VERSION = "2026-09-23.6"

MATERIAL_PATH = "/Game/Curbside/Materials"
BUILDING_MATERIAL = "M_CurbsideBuilding"

# Late afternoon, sun low in the west — long shadows down the avenues.
SUN_PITCH = -22.0
SUN_YAW = -125.0

# Window grid, in centimetres of world space. Windows tile in world space rather
# than per building, so a tower and a row house get the same size windows.
WINDOW_SPACING_H = 340.0
WINDOW_SPACING_V = 380.0

_OK, _FAIL = [], []


def ok(msg):
    _OK.append(msg)
    unreal.log("[Curbside] OK   " + msg)


def fail(msg, err=None):
    detail = "{}{}".format(msg, ": {}".format(err) if err else "")
    _FAIL.append(detail)
    unreal.log_error("[Curbside] FAIL " + detail)


def probe(obj, needle):
    """Log what this build actually calls things, so a miss is fixable once."""
    names = sorted(n for n in dir(obj) if needle in n.lower())
    note("{} API containing '{}': {}".format(
        type(obj).__name__, needle, ", ".join(names) if names else "(none)"))
    return names


def note(msg):
    unreal.log("[Curbside]      " + msg)


def prop(obj, name, value):
    """set_editor_property, but a missing property is a note rather than a stop."""
    try:
        obj.set_editor_property(name, value)
        return True
    except Exception as exc:
        note("skipped {}.{} ({})".format(type(obj).__name__, name, exc))
        return False


def prop_any(obj, names, value):
    """The same property, spelled the several ways Unreal has spelled it."""
    for name in names:
        try:
            obj.set_editor_property(name, value)
            return True
        except Exception:
            continue
    note("skipped {}.{} (no such property under any known name)".format(
        type(obj).__name__, names[0]))
    return False


# ---------------------------------------------------------------------------
# Lighting
# ---------------------------------------------------------------------------

def all_actors():
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    return [a for a in eas.get_all_level_actors() if a is not None]


def first_of(actors, cls):
    for a in actors:
        if isinstance(a, cls):
            return a
    return None


def ensure_actor(actors, cls, label):
    """Reuse the template level's actor if it has one, otherwise place ours."""
    found = first_of(actors, cls)
    if found is not None:
        return found, False
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    spawned = eas.spawn_actor_from_class(cls, unreal.Vector(0, 0, 1000),
                                         unreal.Rotator(0, 0, 0))
    if spawned is not None:
        spawned.set_actor_label(label)
    return spawned, True


def set_movable(comp):
    """Movable, so none of this waits on a lighting build."""
    try:
        comp.set_mobility(unreal.ComponentMobility.MOVABLE)
        return
    except Exception:
        pass
    prop(comp, "mobility", unreal.ComponentMobility.MOVABLE)


def component(actor, cls):
    try:
        return actor.get_component_by_class(cls)
    except Exception:
        return None


def light_the_city():
    actors = all_actors()

    # --- sun ---------------------------------------------------------------
    sun, made = ensure_actor(actors, unreal.DirectionalLight, "Curbside_Sun")
    if sun is None:
        fail("directional light")
    else:
        comp = component(sun, unreal.DirectionalLightComponent)
        if comp is not None:
            # Movable, so nothing here needs a lighting build. The city is
            # generated; there is no baked lighting to generate it against.
            set_movable(comp)
            prop(comp, "intensity", 8.0)
            prop(comp, "light_color", unreal.Color(255, 244, 224, 255))
            prop(comp, "dynamic_shadow_distance_movable_light", 60000.0)
            prop(comp, "cascade_distribution_exponent", 3.5)
            prop_any(comp, ["dynamic_shadow_cascades", "num_dynamic_shadow_cascades"], 4)
            prop(comp, "atmosphere_sun_light", True)
        sun.set_actor_rotation(unreal.Rotator(0.0, SUN_PITCH, SUN_YAW), False)
        ok("sun {} (pitch {:.0f}, yaw {:.0f})".format(
            "placed" if made else "retuned", SUN_PITCH, SUN_YAW))

    # --- sky ---------------------------------------------------------------
    atmosphere, made = ensure_actor(actors, unreal.SkyAtmosphere, "Curbside_SkyAtmosphere")
    if atmosphere is not None:
        ok("sky atmosphere {}".format("placed" if made else "already present"))

    sky, made = ensure_actor(actors, unreal.SkyLight, "Curbside_SkyLight")
    if sky is None:
        fail("sky light")
    else:
        comp = component(sky, unreal.SkyLightComponent)
        if comp is not None:
            set_movable(comp)
            prop(comp, "real_time_capture", True)
            prop(comp, "intensity", 1.0)
            try:
                comp.recapture_sky()
            except Exception:
                pass
        ok("sky light {} (real-time capture)".format("placed" if made else "retuned"))

    # --- haze --------------------------------------------------------------
    fog, made = ensure_actor(actors, unreal.ExponentialHeightFog, "Curbside_Fog")
    if fog is None:
        fail("height fog")
    else:
        comp = component(fog, unreal.ExponentialHeightFogComponent)
        if comp is not None:
            # This is what gives a flat grid of boxes depth. Without it every
            # building reads at the same distance.
            prop(comp, "fog_density", 0.012)
            prop(comp, "fog_height_falloff", 0.15)
            prop(comp, "start_distance", 1200.0)
            prop(comp, "fog_max_opacity", 0.85)
            prop_any(comp, ["enable_volumetric_fog", "volumetric_fog"], True)
            prop(comp, "volumetric_fog_distance", 40000.0)
        ok("height fog {}".format("placed" if made else "retuned"))

    clouds, made = ensure_actor(actors, unreal.VolumetricCloud, "Curbside_Clouds")
    if clouds is not None:
        ok("volumetric cloud {}".format("placed" if made else "already present"))

    # --- exposure ----------------------------------------------------------
    ppv = first_of(actors, unreal.PostProcessVolume)
    made = False
    if ppv is None:
        eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume,
                                         unreal.Vector(0, 0, 0),
                                         unreal.Rotator(0, 0, 0))
        if ppv is not None:
            ppv.set_actor_label("Curbside_PostProcess")
        made = True
    if ppv is None:
        fail("post process volume")
    else:
        prop(ppv, "unbound", True)
        try:
            settings = ppv.get_editor_property("settings")
            # Auto exposure makes a city of grey boxes pump as you turn. Lock it.
            for name, value in (
                ("override_auto_exposure_min_brightness", True),
                ("auto_exposure_min_brightness", 1.0),
                ("override_auto_exposure_max_brightness", True),
                ("auto_exposure_max_brightness", 1.0),
                ("override_bloom_intensity", True),
                ("bloom_intensity", 0.5),
                ("override_ambient_occlusion_intensity", True),
                ("ambient_occlusion_intensity", 0.55),
            ):
                prop(settings, name, value)
            ppv.set_editor_property("settings", settings)
            ok("post process {} (exposure locked)".format("placed" if made else "retuned"))
        except Exception as exc:
            fail("post process settings", exc)


# ---------------------------------------------------------------------------
# The building material
# ---------------------------------------------------------------------------

class Graph(object):
    """Thin wrapper so the graph below reads as maths rather than API calls."""

    def __init__(self, material):
        self.mat = material
        self.lib = unreal.MaterialEditingLibrary

    def node(self, cls, x, y, **props):
        expr = self.lib.create_material_expression(self.mat, cls, x, y)
        for name, value in props.items():
            prop(expr, name, value)
        return expr

    def const(self, value, x, y):
        return self.node(unreal.MaterialExpressionConstant, x, y, r=value)

    def link(self, src, dst, dst_input, src_output=""):
        self.lib.connect_material_expressions(src, src_output, dst, dst_input)

    def out(self, src, material_property, src_output=""):
        self.lib.connect_material_property(src, src_output, material_property)

    def mask(self, src, x, y, r=False, g=False, b=False):
        m = self.node(unreal.MaterialExpressionComponentMask, x, y,
                      r=r, g=g, b=b, a=False)
        self.link(src, m, "")
        return m

    def binary(self, cls, a, b, x, y):
        n = self.node(cls, x, y)
        self.link(a, n, "A")
        self.link(b, n, "B")
        return n

    def unary(self, cls, a, x, y):
        n = self.node(cls, x, y)
        self.link(a, n, "")
        return n


def set_usage_flags(mat):
    """Without these the first draw call logs a warning and recompiles."""
    prop(mat, "used_with_instanced_static_meshes", True)
    prop(mat, "used_with_nanite", True)


def load_asset(path):
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.EditorAssetLibrary.load_asset(path)
    return None


def build_building_material():
    """
    Wall colour varies per building; windows are a world-space grid.

        win  = saturate((0.55 - frac(u)) * 14) * saturate((0.62 - frac(v)) * 14)
               * (1 - |N.z|)
        base = lerp(lerp(ColourA, ColourB, cd0), Glass, win)

    The last term kills windows on roofs, where a world-space grid would
    otherwise tile across the top of every building.
    """
    full = "{}/{}".format(MATERIAL_PATH, BUILDING_MATERIAL)
    existing = load_asset(full)
    if existing is not None:
        set_usage_flags(existing)
        return existing

    mat = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        BUILDING_MATERIAL, MATERIAL_PATH, unreal.Material, unreal.MaterialFactoryNew())

    g = Graph(mat)

    # --- where am I, in world space ----------------------------------------
    wp = g.node(unreal.MaterialExpressionWorldPosition, -1900, 0)
    wx = g.mask(wp, -1700, -120, r=True)
    wy = g.mask(wp, -1700, 0, g=True)
    wz = g.mask(wp, -1700, 120, b=True)

    # u runs around the building, v runs up it.
    horiz = g.binary(unreal.MaterialExpressionAdd, wx, wy, -1520, -60)
    u = g.binary(unreal.MaterialExpressionDivide, horiz,
                 g.const(WINDOW_SPACING_H, -1520, 60), -1360, -60)
    v = g.binary(unreal.MaterialExpressionDivide, wz,
                 g.const(WINDOW_SPACING_V, -1520, 200), -1360, 140)

    def band(coord, width, x, y):
        """1 inside a window, 0 in the mullion, with a soft edge between."""
        f = g.unary(unreal.MaterialExpressionFrac, coord, x, y)
        d = g.binary(unreal.MaterialExpressionSubtract,
                     g.const(width, x, y + 80), f, x + 160, y)
        s = g.binary(unreal.MaterialExpressionMultiply, d,
                     g.const(14.0, x + 160, y + 80), x + 320, y)
        return g.unary(unreal.MaterialExpressionSaturate, s, x + 460, y)

    band_u = band(u, 0.55, -1200, -60)
    band_v = band(v, 0.62, -1200, 200)
    grid = g.binary(unreal.MaterialExpressionMultiply, band_u, band_v, -660, 60)

    # --- walls only, not roofs ---------------------------------------------
    normal = g.node(unreal.MaterialExpressionVertexNormalWS, -1200, 460)
    nz = g.mask(normal, -1040, 460, b=True)
    up = g.unary(unreal.MaterialExpressionAbs, nz, -900, 460)
    side = g.unary(unreal.MaterialExpressionOneMinus, up, -760, 460)
    win = g.binary(unreal.MaterialExpressionMultiply, grid, side, -520, 200)

    # --- per-building colour ------------------------------------------------
    colour_a = g.node(unreal.MaterialExpressionVectorParameter, -1200, -420,
                      parameter_name="WallA",
                      default_value=unreal.LinearColor(0.44, 0.40, 0.36, 1.0))
    colour_b = g.node(unreal.MaterialExpressionVectorParameter, -1200, -240,
                      parameter_name="WallB",
                      default_value=unreal.LinearColor(0.30, 0.21, 0.18, 1.0))
    tint = g.node(unreal.MaterialExpressionPerInstanceCustomData, -1200, -540,
                  data_index=0, const_default_value=0.5)
    lit = g.node(unreal.MaterialExpressionPerInstanceCustomData, -520, 620,
                 data_index=1, const_default_value=0.0)

    wall = g.node(unreal.MaterialExpressionLinearInterpolate, -900, -360)
    g.link(colour_a, wall, "A")
    g.link(colour_b, wall, "B")
    g.link(tint, wall, "Alpha")

    glass = g.node(unreal.MaterialExpressionVectorParameter, -900, -60,
                   parameter_name="Glass",
                   default_value=unreal.LinearColor(0.10, 0.14, 0.19, 1.0))

    base = g.node(unreal.MaterialExpressionLinearInterpolate, -260, -160)
    g.link(wall, base, "A")
    g.link(glass, base, "B")
    g.link(win, base, "Alpha")
    g.out(base, unreal.MaterialProperty.MP_BASE_COLOR)

    rough = g.node(unreal.MaterialExpressionLinearInterpolate, -260, 60)
    g.link(g.const(0.88, -420, 20), rough, "A")
    g.link(g.const(0.12, -420, 100), rough, "B")
    g.link(win, rough, "Alpha")
    g.out(rough, unreal.MaterialProperty.MP_ROUGHNESS)

    metal = g.binary(unreal.MaterialExpressionMultiply, win,
                     g.const(0.45, -420, 300), -260, 260)
    g.out(metal, unreal.MaterialProperty.MP_METALLIC)

    # Lit windows. cd1 is per building, so a whole block lights up at once —
    # crude, but at dusk it is the difference between a city and a quarry.
    glow_colour = g.node(unreal.MaterialExpressionVectorParameter, -520, 800,
                         parameter_name="Glow",
                         default_value=unreal.LinearColor(1.0, 0.82, 0.48, 1.0))
    glow_amount = g.binary(unreal.MaterialExpressionMultiply, win, lit, -260, 620)
    glow_scaled = g.binary(unreal.MaterialExpressionMultiply, glow_amount,
                           g.const(1.6, -420, 700), -100, 620)
    emissive = g.binary(unreal.MaterialExpressionMultiply, glow_scaled,
                        glow_colour, 60, 700)
    g.out(emissive, unreal.MaterialProperty.MP_EMISSIVE_COLOR)

    set_usage_flags(mat)
    unreal.MaterialEditingLibrary.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
    return mat


# ---------------------------------------------------------------------------
# Applying it
# ---------------------------------------------------------------------------

def buildings_chunk():
    for actor in all_actors():
        if isinstance(actor, unreal.CurbsideWorldChunk):
            try:
                if str(actor.get_editor_property("category")) == "buildings":
                    return actor
            except Exception:
                continue
    return None


def chunk_component(chunk):
    for attempt in (
        lambda: chunk.instances,
        lambda: chunk.get_editor_property("instances"),
        lambda: chunk.get_component_by_class(unreal.InstancedStaticMeshComponent),
    ):
        try:
            got = attempt()
            if got is not None:
                return got
        except Exception:
            continue
    return None


def instance_transform(ism, index):
    """The bindings hand back (bool, Transform) here; older ones hand back one."""
    got = ism.get_instance_transform(index, False)
    if isinstance(got, (tuple, list)):
        for item in reversed(got):
            if isinstance(item, unreal.Transform):
                return item
        return None
    return got


def variation(transform):
    """
    Two stable pseudo-random numbers from a building's own position.

    Position rather than index, so re-running build_world.py and re-running this
    gives every building the same colour it had before.
    """
    loc = transform.get_editor_property("translation")
    seed = loc.x * 0.0137 + loc.y * 0.0219 + loc.z * 0.0071
    tint = math.fmod(abs(math.sin(seed) * 43758.5453), 1.0)
    glow = math.fmod(abs(math.sin(seed * 1.7 + 4.2) * 24634.6345), 1.0)
    return tint, glow


def pick_custom_data_writer(ism):
    """
    SetCustomData is not exposed to Python in 5.7, but SetCustomDataValue is.
    Probe rather than guess, and log the real names so a miss is fixable once.
    """
    probe(ism, "custom")

    if hasattr(ism, "set_custom_data"):
        ok("custom data: set_custom_data")
        return lambda i, values: ism.set_custom_data(i, values, False)

    if hasattr(ism, "set_custom_data_value"):
        ok("custom data: set_custom_data_value")

        def write(i, values):
            for slot, value in enumerate(values):
                ism.set_custom_data_value(i, slot, value, False)

        return write

    return None


def dress_buildings(material):
    chunk = buildings_chunk()
    if chunk is None:
        fail("no buildings chunk in the level — run build_world.py first")
        return
    ism = chunk_component(chunk)
    if ism is None:
        fail("buildings chunk has no instanced mesh component")
        return

    count = ism.get_instance_count()
    if count == 0:
        fail("buildings chunk is empty — run build_world.py first")
        return

    if material is not None:
        ism.set_material(0, material)

    if not prop(ism, "num_custom_data_floats", 2):
        note("no per-instance custom data; buildings will all be the base colour")
        ok("buildings: material applied to {} instances".format(count))
        return

    write = pick_custom_data_writer(ism)
    if write is None:
        fail("no way to write per-instance custom data on this build")
        ok("buildings: material applied to {} instances".format(count))
        return

    written = 0
    for i in range(count):
        try:
            transform = instance_transform(ism, i)
        except Exception:
            continue
        if transform is None:
            continue
        tint, glow = variation(transform)
        # A fifth of the city has its lights on. Enough to read; not a runway.
        lit = 0.0 if glow > 0.20 else (0.35 + glow * 2.5)
        try:
            write(i, [tint, lit])
            written += 1
        except Exception as exc:
            if written == 0:
                fail("writing custom data", exc)
                break

    try:
        ism.mark_render_state_dirty()
    except Exception:
        pass

    ok("buildings: {} instances, {} with colour variation".format(count, written))


def build():
    unreal.log("[Curbside] ================================================")
    unreal.log("[Curbside] dress_world.py  version {}".format(SCRIPT_VERSION))
    unreal.log("[Curbside] ================================================")

    if not hasattr(unreal, "CurbsideWorldChunk"):
        fail("CurbsideWorldChunk missing — build the C++ module and run build_world.py first")
        return

    light_the_city()

    material = None
    try:
        material = build_building_material()
        ok("building material at {}/{}".format(MATERIAL_PATH, BUILDING_MATERIAL))
    except Exception as exc:
        fail("building material", exc)
        note("falling back to the flat colour material build_world.py made")
        # Do not leave a half-built graph on disk; the next run would load it.
        try:
            full = "{}/{}".format(MATERIAL_PATH, BUILDING_MATERIAL)
            if unreal.EditorAssetLibrary.does_asset_exist(full):
                unreal.EditorAssetLibrary.delete_asset(full)
                note("removed the half-built material")
        except Exception:
            pass

    dress_buildings(material)

    unreal.log("[Curbside] ---- summary ----")
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
