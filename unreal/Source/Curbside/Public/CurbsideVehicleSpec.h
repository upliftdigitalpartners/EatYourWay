// Curbside — vehicle specifications.
//
// One DataAsset per vehicle, mirroring src/vehicles/specs.ts. Handling lives in
// data so adding a vehicle is an asset, not a code change.
//
// UNITS: metres and m/s throughout, converted to Unreal units at the point of
// use. See CurbsideUnits in CurbsideTypes.h.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "CurbsideTypes.h"
#include "CurbsideVehicleSpec.generated.h"

UCLASS(BlueprintType)
class CURBSIDE_API UCurbsideVehicleSpec : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    /** Stable id used for the distance-travelled log ("sedan", "helicopter"). */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    FString VehicleId;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    FText DisplayName;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside", meta = (MultiLine = true))
    FText Description;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    ECurbsideDomain Domain = ECurbsideDomain::Ground;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    ECurbsideDrive Drive = ECurbsideDrive::Wheeled;

    /** Top speed, m/s. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Handling")
    float MaxSpeedMps = 40.0f;

    /** Mass, kg. Also set on the physics body so collisions read right. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Handling")
    float MassKg = 1500.0f;

    /** Thrust/engine scale. Tuned per drive type, not a physical quantity. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Handling")
    float AccelScale = 70.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Handling")
    float BrakeScale = 26.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Seats")
    int32 Seats = 4;

    // ---- air ---------------------------------------------------------------

    /** Available vertical thrust as a multiple of gravity. Helicopters only. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Air")
    float LiftRatio = 1.4f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Air")
    float PitchRate = 0.85f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Air")
    float RollRate = 1.4f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Air")
    float YawRate = 0.5f;

    /** Below this airspeed a fixed-wing loses lift. m/s. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Air")
    float StallSpeedMps = 24.0f;

    /** Ground roll required before rotation, metres. Fixed-wing only. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Air")
    float TakeoffRollMeters = 240.0f;

    // ---- water -------------------------------------------------------------

    /** Buoyancy multiplier applied to displaced volume. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Water")
    float Buoyancy = 1.7f;

    /** Lateral resistance. High values are what make a hull carve a turn. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Water")
    float WaterDrag = 1.2f;

    /** Height of the water plane in the level, Unreal units. Boats float here.
     *  Cesium georeferenced levels usually put mean sea level at Z=0. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Water")
    float WaterLevelZ = 0.0f;

    UFUNCTION(BlueprintPure, Category = "Curbside")
    float GetMaxSpeedUU() const { return CurbsideUnits::MpsToUU(MaxSpeedMps); }
};
