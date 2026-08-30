// Curbside — shared gameplay types.
//
// PORTING NOTE: replace CURBSIDE_API with YOURMODULE_API (the uppercased name
// of the module you drop these files into). See unreal/README.md.
//
// UNITS: Unreal works in centimetres. All Curbside design data (vendor
// positions, vehicle dimensions, speeds) is authored in metres to match the
// web build, and converted on load via CurbsideUnits::MetersToUU. Never mix
// the two — every field below is documented with the unit it holds.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "CurbsideTypes.generated.h"

namespace CurbsideUnits
{
    /** Unreal is centimetres; design data is metres. */
    static constexpr float UUPerMeter = 100.0f;

    FORCEINLINE float MetersToUU(float Meters) { return Meters * UUPerMeter; }
    FORCEINLINE float UUToMeters(float UU) { return UU / UUPerMeter; }

    /** m/s -> cm/s, for anything handed to a movement component. */
    FORCEINLINE float MpsToUU(float Mps) { return Mps * UUPerMeter; }

    /** m/s -> km/h, for HUD readouts. */
    FORCEINLINE float MpsToKph(float Mps) { return Mps * 3.6f; }
    FORCEINLINE float MpsToMph(float Mps) { return Mps * 2.23694f; }
}

UENUM(BlueprintType)
enum class ECurbsideCuisine : uint8
{
    Indian, Bangladeshi, Tibetan, Nepali, Mexican, Colombian,
    Peruvian, Chinese, Sichuan, Taiwanese, Korean, Japanese,
    Malaysian, Thai, Greek, Italian, Caribbean, Polish
};

UENUM(BlueprintType)
enum class ECurbsideTimeOfDay : uint8
{
    Afternoon, Evening, LateNight
};

/** Which controller a vehicle uses. Mirrors the web build's `Drive` union. */
UENUM(BlueprintType)
enum class ECurbsideDrive : uint8
{
    Foot, Wheeled, Boat, Helicopter, Plane
};

UENUM(BlueprintType)
enum class ECurbsideDomain : uint8
{
    Ground, Water, Air
};

/** One orderable item on a vendor's menu. */
USTRUCT(BlueprintType)
struct CURBSIDE_API FCurbsideMenuItem
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FString Name;

    /** Short emoji or icon tag shown in the order UI. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FString Emoji;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside", meta = (ClampMin = "0"))
    int32 Price = 0;

    /** Hunger restored, 0-100 scale. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    int32 Hunger = 0;

    /** Coma added, 0-100 scale. Hit 100 and the run ends. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    int32 Coma = 0;

    /** Base flavor before gem and multiplier bonuses. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    int32 Flavor = 0;

    /** Hidden gems pay 1.5x flavor. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    bool bGem = false;
};

/**
 * A vendor, as a DataTable row.
 *
 * Import unreal/Data/DT_Vendors.json as a DataTable using this row struct.
 * Positions are METRES in the world frame (+X east, +Y south, Z up) relative
 * to the Cesium georeference origin — see README for the origin lat/lon.
 */
USTRUCT(BlueprintType)
struct CURBSIDE_API FCurbsideVendorRow : public FTableRowBase
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FString VendorId;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FString DisplayName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FString Blurb;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FString Emoji;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    ECurbsideCuisine Cuisine = ECurbsideCuisine::Indian;

    /** Neighbourhood. Distinct districts drive the flavor multiplier. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FString District;

    /** Marker/pin tint. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FLinearColor Color = FLinearColor::White;

    /** Metres east of the georeference origin. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    float LocationXMeters = 0.0f;

    /** Metres south of the georeference origin. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    float LocationYMeters = 0.0f;

    /** Hidden vendors stay off the map until the player gets close. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    bool bHidden = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    TArray<ECurbsideTimeOfDay> OpenAt;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    TArray<FCurbsideMenuItem> Items;

    /** World position in Unreal units, relative to the georeference origin. */
    FVector GetLocalOffset() const
    {
        return FVector(
            CurbsideUnits::MetersToUU(LocationXMeters),
            CurbsideUnits::MetersToUU(LocationYMeters),
            0.0f);
    }
};

/** A single eaten item, recorded for the end-of-run summary. */
USTRUCT(BlueprintType)
struct CURBSIDE_API FCurbsideEatenItem
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    FString Name;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    int32 Price = 0;

    /** Flavor actually awarded, after gem and multiplier bonuses. */
    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    int32 Flavor = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    ECurbsideCuisine Cuisine = ECurbsideCuisine::Indian;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    bool bGem = false;
};

/** Result of one completed crawl. */
USTRUCT(BlueprintType)
struct CURBSIDE_API FCurbsideRunResult
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    int32 Flavor = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    int32 Spent = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    int32 Bites = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    int32 Gems = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    int32 ComboMax = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    TArray<FString> DistrictsVisited;

    /** Metres travelled, keyed by vehicle id ("foot", "sedan", "helicopter"). */
    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    TMap<FString, float> DistanceByMode;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    FString Rank;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    FString EndedReason;
};
