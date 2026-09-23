# Curbside — Unreal Engine module

A drop-in C++ module that ports Curbside's gameplay to Unreal Engine 5.7:
the crawl rules, 27 vendors, and driveable/flyable/sailable vehicles.

## Status

**Compiles clean on UE 5.7 / macOS** (Apple silicon, Mac SDK 26.5), verified
2026-09-14 against a project module created from the Third Person template.
UnrealHeaderTool passes with `-WarningsAsErrors`. All files build, including the
Chaos wheeled vehicle against 5.7's classic Chaos Vehicles — both the minimal
stage and `--with-chaos` linked with no errors on the first attempt.

**Runs.** Verified 2026-09-23 in the editor: the six actor classes load, the
vendor DataTable imports its 27 rows, `UCurbsideVendorSpawner` spawns all 27 at
BeginPlay, and WASD movement works in Play. The 15 `DA_Vehicle_*` spec assets
generate from `create_vehicle_specs.py`, and `setup_curbside.py` completes all
11 of its steps.

Still unverified: **handling**. The numbers are ported from the web build, where
they were tuned, but they have not been re-tuned against Chaos/UE physics and
should be treated as starting points.

The default staging path below is deliberately minimal: it leaves out the one
file that needs Chaos Vehicles and does not involve Cesium at all, so the first
build has the smallest possible surface for something to go wrong.

---

## 1. Stage the module

```bash
./unreal/Tools/stage_module.sh <module-dir> <MODULENAME>

# e.g. for a project whose module lives at Source/EatYourWay:
./unreal/Tools/stage_module.sh ~/dev/eatyourway/Source/EatYourWay EatYourWay
```

This copies the sources into your module and rewrites the `CURBSIDE_API` export
macro to match (`EATYOURWAY_API` in the example). Get that macro wrong and the
code compiles but fails to link, so let the script do it.

It prints the exact `Build.cs` and `.uproject` lines to add. For the minimal
build that is:

```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "EnhancedInput",
    "PhysicsCore",
});
```

```json
{ "Name": "PythonScriptPlugin", "Enabled": true }
```

Then *Generate Project Files* and build from your IDE rather than Live Coding —
you want full error output on a first integration.

### What you get in the minimal build

| Included | Left out |
| --- | --- |
| Crawl rules (`UCurbsideRunComponent`) | Chaos wheeled vehicles |
| 27 vendors + spawner | Cesium / real-world map |
| On-foot character, enter/exit | |
| Helicopter and fixed-wing | |
| Boats | |
| 15 vehicle spec assets | |

That is still a complete playable loop — walk to a vendor, order, fly to another
district, order again, watch the run end. Enough to prove the port works.

**Gate:** the editor opens and your classes appear under
*Content Browser → C++ Classes*.

## 2. Import the vendors

1. Content Browser → **Import** → `unreal/Data/DT_Vendors.json`
2. Pick **DataTable**, row struct **`CurbsideVendorRow`**
3. You should get **27 rows / 74 menu items / 12 gems / 5 hidden**

A row count other than 27 means the struct didn't match — fix that before
moving on.

Positions are **metres** east (`LocationXMeters`) and south
(`LocationYMeters`) of the georeference origin. Unreal is centimetres;
`FCurbsideVendorRow::GetLocalOffset()` does the conversion, so never apply a
scale factor yourself.

## 3. Generate the vehicle specs

With the module compiled and the Python plugin on:

```
py "<repo>/unreal/Tools/create_vehicle_specs.py"
```

Writes 15 `UCurbsideVehicleSpec` assets to `/Game/Curbside/Vehicles`. Re-running
updates in place. Source of truth is `unreal/Data/vehicle_specs.json`.

| Domain | Vehicles |
| --- | --- |
| Ground | bicycle, motorcycle, sedan, taxi, sports, van, boxTruck, bus, foodTruck |
| Water | jetski, speedboat, ferry |
| Air | helicopter, cessna, jet |

The ground specs are generated even in the minimal build — they are just data,
and they are waiting for you when you add Chaos.

## 4. Blueprint wiring

Create Blueprint subclasses and fill in the exposed slots:

- `BP_Character` ← `ACurbsideCharacter` — mesh, `OnFootContext`, `MoveAction`,
  `LookAction`, `JumpAction`, `SprintAction`, `InteractAction`
- `BP_Helicopter`, `BP_Plane` ← `ACurbsideAircraftPawn` — `Hull` mesh,
  `RotorMesh`, `Spec`, `FlightContext`, throttle/cyclic/yaw/lift/exit
- `BP_Boat` ← `ACurbsideBoatPawn` — `Hull` mesh, `Spec`, `BoatContext`
- Set `ACurbsidePlayerState` as your GameMode's Player State class

Each vehicle's `OnRequestExit` event must call `ExitVehicle(self)` on the
character that entered it, or you get in and never get out.

### Input Actions to create

`IA_Move`, `IA_Look` (Axis2D); `IA_Throttle`, `IA_Steer`, `IA_Yaw`, `IA_Lift`
(Axis1D); `IA_Jump`, `IA_Sprint`, `IA_Brake`, `IA_Interact` (Digital). Then one
Mapping Context per mode.

| Input | On foot | Ground | Helicopter | Fixed-wing | Boat |
| --- | --- | --- | --- | --- | --- |
| `W`/`S` | walk | throttle | cyclic pitch | throttle | throttle |
| `A`/`D` | strafe | steer | cyclic roll | roll | rudder |
| `Space` | jump | brake | collective up | wheel brake | — |
| `Shift` | sprint | — | collective down | — | — |
| `Q`/`E` | — | — | tail rotor | rudder | — |
| `F` | order / get in | get out | get out | get out | get out |

## 5. Later: add Chaos wheeled vehicles

Once the minimal build is green:

```bash
./unreal/Tools/stage_module.sh <module-dir> <MODULENAME> --with-chaos
```

Add `"ChaosVehicles"` to `PublicDependencyModuleNames` and enable
`ChaosVehiclesPlugin`.

> **If it doesn't resolve.** `UChaosWheeledVehicleMovementComponent` has moved
> headers between releases, and 5.7 ships the newer *Chaos Modular Vehicles*
> alongside the classic system. This code targets classic Chaos Vehicles and
> compiles against 5.7 as shipped. If `SetTargetGear` or `SetThrottleInput`
> won't resolve on your version, check which of the two your include pulls in.

Setting up the vehicle itself is the fiddliest part of the whole port — it needs
a skeletal mesh with correctly named wheel bones, a physics asset, and wheel
setups. Start from Epic's Vehicle template content and retarget rather than
authoring from scratch. Get *one* car driving before making the other eight.

## 6. Later: add Cesium for real Queens

Install **Cesium for Unreal** from Fab (free, Apache 2.0), then:

1. Place a **CesiumGeoreference** and set its origin to Roosevelt Ave,
   Jackson Heights:

   | Field | Value |
   | --- | --- |
   | Origin Longitude | `-73.8896` |
   | Origin Latitude | `40.7466` |
   | Origin Height | `0` |

2. Add **Cesium World Terrain** and **Cesium OSM Buildings** tilesets.
3. Leave the vendor spawner's `GeoreferenceOrigin` at identity — Cesium already
   makes that lat/lon the level origin.

This puts all 27 vendors on the real streets they are named after.

**Nothing in this module includes a Cesium header.** The georeference reaches the
code as a plain `FTransform`, so the module compiles with or without the plugin,
and you can add or remove Cesium at any point without touching C++.

**Android note.** Cesium for Unreal is arm64-only on Android. If your project
currently packages with *Support armv7* enabled, adding Cesium will break that
build — untick armv7 in *Project Settings → Platforms → Android*.

**Licensing.** Cesium OSM Buildings is OpenStreetMap data under ODbL. Rendering
it in a game is a *Produced Work* — attribution only, and your game keeps its
own licence. Credit OpenStreetMap contributors on a title or credits screen.
Google Photorealistic 3D Tiles is a different matter: its terms forbid caching,
rehosting or deriving geometry, so it is not viable as a shipped game world.

## 6b. Build the city

The module ships six actor classes and 27 vendors, but no scenery — drop them
into an empty level and you get vendors standing on a void. `build_world.py`
fills that in with the procedural Queens from the web build: 3,019 buildings,
the road grid, the elevated 7 train, Flushing Bay, Flushing Meadows and the two
LaGuardia runways.

```bash
# 1. bake the geometry (Node, in this repo — already committed, only re-run
#    if you change the generator)
node tools/export-unreal-world.mjs

# 2. quit the editor, then pull + stage + build in one command
./unreal/Tools/rebuild.sh
```

`rebuild.sh` exists because doing those as three separate commands is two
chances to do one and not the others, and a half-done rebuild is indis&#8203;tinguishable
from a code bug once you are inside the editor — the script just reports
`C++ class not found`. It refuses to start while the editor is open (Unreal
holds the module dylib, so the build either fails or writes a binary the
running editor will never load), and it stops at the first failure with the
compiler errors rather than carrying on and looking like it worked.

Then in the editor: **Tools > Execute Python Script…** → `unreal/Tools/build_world.py`.

It places 4,352 instances across six `Curbside_*` chunk actors and prints a
count it reads back off the components, so the log says what actually landed
rather than what it tried to place. Re-running replaces the previous chunks.
Save the level afterwards.

### Then dress it

**Tools > Execute Python Script…** → `unreal/Tools/dress_world.py`

Geometry alone is a quarry, not a city. This adds the part that makes it read:

- **Lighting** — a movable sun low in the west, a real-time sky light,
  volumetric fog and a locked exposure. Movable throughout, because the city is
  generated and there is no baked lighting to generate it against.
- **`M_CurbsideBuilding`** — procedural windows on a world-space grid (so a
  tower and a row house get the same size windows), masked off roofs by the
  vertex normal, with wall colour lerped per building.
- **Per-instance custom data** — two floats per building, derived from its own
  position so the colours are the same every run. Index 0 tints the wall, index
  1 lights the windows; about a fifth of the city has its lights on.

No rebuild for this one: unlike adding a component, all of it is already exposed
to Python. Re-running `build_world.py` rebuilds the chunks and drops the custom
data, so run `dress_world.py` again after it.

### Why this needs C++

Unreal's Python API has no `AddComponentByClass` — you cannot add a component to
an actor from a script. So an `InstancedStaticMeshComponent` can only come from
a class that already has one. That class is `ACurbsideWorldChunk`
(`CurbsideWorldChunk.h`), and `UCurbsideWorldBuilder` is the
`BlueprintCallable` entry point the script calls.

The split is deliberate: every bit of geometry maths lives in
`tools/export-unreal-world.mjs`, where it runs under Node and can be checked.
The editor script — the part that cannot be tested from outside Unreal — only
marshals finished transforms.

One instanced component per category means six draw calls for the whole city
rather than 4,352 actors, which also matters on a phone.

The chunks collide (`BlockAll`), which is what gives the vendor spawner's ground
trace something to land on.

## 6c. Put the vehicles in it

Re-run `setup_curbside.py` (it now builds a Blueprint per vehicle), then:

**Tools > Execute Python Script…** → `unreal/Tools/place_vehicles.py`

Each vehicle goes somewhere it makes sense: cars and bikes along the roads
nearest the PlayerStart, boats on Flushing Bay, the two planes on the LaGuardia
runways, the helicopter parked with the cars so you don't have to walk to the
airport. The positions come out of `world_instances.json`, so moving a runway in
the generator moves the aircraft with it. Re-running replaces what it placed.

### The car problem, and the way round it

`ACurbsideWheeledVehicle` is the Chaos car and it is the better one — real
suspension, real tyre model. It also needs a skeletal mesh with wheel bones and
a physics asset, which is art, and there isn't any yet. So a cube cannot be a
Chaos car, and "drive around Queens" was blocked on a modelling job.

`ACurbsideRoadVehicle` is the way round it: a static-mesh hull on four raycast
springs, ported from `src/vehicles/controller.ts` where the handling was tuned
against Rapier's `DynamicRayCastVehicleController`. Four line traces per tick
for the springs and lateral grip, a forward force for the engine, a yaw torque
for the steering. It drives with a cube for a body.

Both implement `ICurbsideDriveable` and read the same `UCurbsideVehicleSpec`, so
when the art arrives, swapping one for the other is a change to which class the
Blueprint reparents to and nothing else.

`UCurbsideVehicleSpec::SizeMeters` carries the body size, so the placeholder
hulls scale themselves: a bus is 12 m long and a jetski is 3 m, which with one
cube per vehicle is the only thing telling them apart.

## 7. How the rules work

`UCurbsideRunComponent` (on the PlayerState, so it survives pawn swaps) owns one
crawl:

- **$120** and **12 minutes**. Hunger drains, coma decays.
- Three distinct cuisines → **×1.5** flavor.
- Each district past the first → **+0.12** to the multiplier. This is the whole
  point of the vehicles: spreading a crawl across Jackson Heights, Corona and
  Flushing pays far better than clearing one block.
- Hidden gems pay ×1.5 and only appear within 60 m.
- Run ends on coma 100, hangry-and-broke, or the clock.

Call `Order(Vendor.Row, Item, OutFlavor)` from your order widget; bind
`OnRunEnded`, `OnAte`, `OnDistrictUnlocked` for UI.

## 8. Known gaps

- **Handling is untuned.** See the status note above.
- **No touch controls.** Input is keyboard-shaped. For Android you need
  on-screen controls; `src/ui/` in the web build has a tested layout to
  reference, though the code doesn't port.
- **No AI traffic.** Vehicles are parked props until entered.
- **Cars are cubes.** `ACurbsideRoadVehicle` drives properly but has no
  model, and no wheels that turn — the wheels are raycasts, not meshes.
- **No water volume.** Boats float against `Spec->WaterLevelZ`, a flat plane.
- **Enter/exit is teleport-based.** No animation.
- **Fixed-wing needs a flat runway.** `TakeoffRollMeters` gates rotation
  (240 m for the light plane, 900 m for the jet).
