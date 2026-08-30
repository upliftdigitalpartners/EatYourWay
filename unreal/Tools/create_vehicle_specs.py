"""
Create UCurbsideVehicleSpec DataAssets from unreal/Data/vehicle_specs.json.

Run inside the Unreal Editor (Tools > Execute Python Script, or the Output Log
Python console). Requires the "Python Editor Script Plugin" enabled.

    py "<repo>/unreal/Tools/create_vehicle_specs.py"

Re-running updates existing assets in place rather than duplicating them.
"""

import json
import os
import unreal

# Where the DataAssets land in the content browser.
PACKAGE_PATH = "/Game/Curbside/Vehicles"

DOMAIN = {
    "Ground": unreal.CurbsideDomain.GROUND,
    "Water": unreal.CurbsideDomain.WATER,
    "Air": unreal.CurbsideDomain.AIR,
}

DRIVE = {
    "Foot": unreal.CurbsideDrive.FOOT,
    "Wheeled": unreal.CurbsideDrive.WHEELED,
    "Boat": unreal.CurbsideDrive.BOAT,
    "Helicopter": unreal.CurbsideDrive.HELICOPTER,
    "Plane": unreal.CurbsideDrive.PLANE,
}

# JSON key -> UPROPERTY name in Python (snake_case).
SCALARS = {
    "VehicleId": "vehicle_id",
    "MaxSpeedMps": "max_speed_mps",
    "MassKg": "mass_kg",
    "AccelScale": "accel_scale",
    "BrakeScale": "brake_scale",
    "Seats": "seats",
    "LiftRatio": "lift_ratio",
    "PitchRate": "pitch_rate",
    "RollRate": "roll_rate",
    "YawRate": "yaw_rate",
    "StallSpeedMps": "stall_speed_mps",
    "TakeoffRollMeters": "takeoff_roll_meters",
    "Buoyancy": "buoyancy",
    "WaterDrag": "water_drag",
    "WaterLevelZ": "water_level_z",
}


def data_path():
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(os.path.dirname(here), "Data", "vehicle_specs.json")


def create_or_load(asset_name):
    full = "{}/{}".format(PACKAGE_PATH, asset_name)
    if unreal.EditorAssetLibrary.does_asset_exist(full):
        return unreal.EditorAssetLibrary.load_asset(full)

    factory = unreal.DataAssetFactory()
    factory.set_editor_property("data_asset_class", unreal.CurbsideVehicleSpec)
    return unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name, PACKAGE_PATH, unreal.CurbsideVehicleSpec, factory
    )


def run():
    with open(data_path(), "r") as handle:
        specs = json.load(handle)

    made = 0
    for spec in specs:
        # 'foot' is not a vehicle you get into; it exists in the web build only
        # so the distance log has something to key on.
        if spec["Drive"] == "Foot":
            continue

        asset_name = "DA_Vehicle_{}".format(spec["VehicleId"])
        asset = create_or_load(asset_name)
        if asset is None:
            unreal.log_error("[Curbside] could not create {}".format(asset_name))
            continue

        for json_key, prop in SCALARS.items():
            if json_key in spec:
                asset.set_editor_property(prop, spec[json_key])

        asset.set_editor_property("display_name", spec["DisplayName"])
        asset.set_editor_property("description", spec["Description"])
        asset.set_editor_property("domain", DOMAIN[spec["Domain"]])
        asset.set_editor_property("drive", DRIVE[spec["Drive"]])

        unreal.EditorAssetLibrary.save_loaded_asset(asset)
        made += 1

    unreal.log("[Curbside] wrote {} vehicle spec assets to {}".format(made, PACKAGE_PATH))


run()
