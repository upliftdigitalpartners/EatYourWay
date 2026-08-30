# Curbside — Unreal Engine module

A drop-in C++ module that ports Curbside's gameplay to Unreal Engine 5.7:
the crawl rules, 27 vendors, and driveable/flyable/sailable vehicles.

## Status — read this first

**None of this C++ has been compiled.** It was written without an Unreal
install available, so treat the first build as a real integration step, not a
formality. The logic is a direct port of the web build (which *was* tested), but
expect to fix include paths or API details for your exact engine version.

What is included, and what you still have to make in the editor:

| Included (text) | You create (editor) |
| --- | --- |
| All gameplay C++ | Blueprint subclasses of each pawn |
| Vendor DataTable JSON | Input Actions + Mapping Contexts |
| Vehicle spec JSON + generator script | Meshes for vehicles and stalls |
| `Build.cs` dependency list | The level and Cesium georeference |
| Cesium setup values | Order/HUD widgets |

---

## 1. Rename the module macro

Every class is exported with `CURBSIDE_API`. Change it to your module's
uppercased name, or the build will not link:

```bash
# from the repo root — replace YOURMODULE with your actual module name
grep -rl 'CURBSIDE_API' unreal/Source \
  | xargs sed -i 's/CURBSIDE_API/YOURMODULE_API/g'
```

Then copy `unreal/Source/Curbside/Public/*` and `Private/*` into your module's
corresponding folders. Do **not** copy `Curbside.Build.cs` — merge its
dependency list into your own (step 2).

## 2. Build dependencies

Add to your module's `Build.cs`:

```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "EnhancedInput",   // all pawns bind through it
    "ChaosVehicles",   // ACurbsideWheeledVehicle
    "PhysicsCore",     // aircraft and boat forces
});
```

And enable in your `.uproject`:

```json
{ "Name": "ChaosVehiclesPlugin", "Enabled": true },
{ "Name": "EnhancedInput",       "Enabled": true },
{ "Name": "PythonScriptPlugin",  "Enabled": true }
```

Regenerate project files and build.

> Cesium is deliberately **not** a build dependency. No file here includes a
> Cesium header — the georeference reaches the code as a plain `FTransform` on
> the vendor spawner. The module compiles with or without the plugin.

## 3. Import the vendors

1. Content Browser → **Import** → `unreal/Data/DT_Vendors.json`
2. Pick **DataTable**, row struct **`CurbsideVendorRow`**
3. You should get **27 rows / 74 menu items / 12 gems / 5 hidden**

Positions are **metres** east (`LocationXMeters`) and south
(`LocationYMeters`) of the georeference origin. Unreal is centimetres —
`FCurbsideVendorRow::GetLocalOffset()` does the conversion, so never apply a
scale factor yourself.

## 4. Generate the vehicle specs

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

## 5. Cesium — real Queens

Install **Cesium for Unreal** from Fab (free, Apache 2.0), then:

1. Place a **CesiumGeoreference** and set its origin to Roosevelt Ave,
   Jackson Heights:

   | Field | Value |
   | --- | --- |
   | Origin Longitude | `-73.8896` |
   | Origin Latitude | `40.7466` |
   | Origin Height | `0` |

2. Add **Cesium World Terrain** and **Cesium OSM Buildings** tilesets.
3. Place a `CurbsideVendorSpawner`, assign the vendor DataTable, and leave
   `GeoreferenceOrigin` at identity — Cesium already makes that lat/lon the
   level origin.

This puts all 27 vendors on the real streets they are named after. The world
extends roughly 6.6 km east to Flushing and 3.2 km north to LaGuardia, which is
the area the web build's procedural generator covers.

**Licensing.** Cesium OSM Buildings is OpenStreetMap data under ODbL. Rendering
it in a game is a *Produced Work* — attribution only, and your game keeps its
own licence. Credit OpenStreetMap contributors on a title or credits screen.
Google Photorealistic 3D Tiles is a different matter: its terms forbid caching,
rehosting or deriving geometry, so it is not viable as a shipped game world.

## 6. Blueprint wiring

Create Blueprint subclasses and fill in the exposed slots:

- `BP_Character` ← `ACurbsideCharacter` — mesh, `OnFootContext`, `MoveAction`,
  `LookAction`, `JumpAction`, `SprintAction`, `InteractAction`
- `BP_Car` ← `ACurbsideWheeledVehicle` — skeletal mesh + wheel setup (standard
  Chaos vehicle work), `Spec`, `DrivingContext`, throttle/steer/brake/exit
- `BP_Helicopter`, `BP_Plane` ← `ACurbsideAircraftPawn` — `Hull` mesh,
  `RotorMesh`, `Spec`, `FlightContext`, throttle/cyclic/yaw/lift/exit
- `BP_Boat` ← `ACurbsideBoatPawn` — `Hull` mesh, `Spec`, `BoatContext`
- Set `ACurbsidePlayerState` as your GameMode's Player State class

Each vehicle's `OnRequestExit` event should call `ExitVehicle(self)` on the
character that entered it.

### Suggested bindings

| Input | On foot | Ground vehicle | Helicopter | Fixed-wing | Boat |
| --- | --- | --- | --- | --- | --- |
| `W`/`S` | walk | throttle | cyclic pitch | throttle | throttle |
| `A`/`D` | strafe | steer | cyclic roll | roll | rudder |
| `Space` | jump | brake | collective up | wheel brake | — |
| `Shift` | sprint | — | collective down | — | — |
| `Q`/`E` | — | — | tail rotor | rudder | — |
| `F` | order / get in | get out | get out | get out | get out |

## 7. How the rules work

`UCurbsideRunComponent` (on the PlayerState) owns one crawl:

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

- **Not compiled.** See the status note above.
- **No AI traffic.** Vehicles are parked props until entered.
- **No water volume.** Boats float against `Spec->WaterLevelZ`, a flat plane.
  Cesium terrain has no water body, so set this per level.
- **Enter/exit is teleport-based.** No animation.
- **Fixed-wing needs real runways.** LaGuardia exists in the OSM data but you
  will want a flat landing surface; `TakeoffRollMeters` gates rotation
  (240 m for the light plane, 900 m for the jet).
