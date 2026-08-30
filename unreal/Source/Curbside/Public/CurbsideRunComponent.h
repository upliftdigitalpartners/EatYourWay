// Curbside — the crawl rules.
//
// A direct port of src/core/rules.ts. Kept as an ActorComponent so it can live
// on the PlayerState (multiplayer) or the GameMode (single player) without the
// rules themselves caring which.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "CurbsideTypes.h"
#include "CurbsideRunComponent.generated.h"

UENUM(BlueprintType)
enum class ECurbsideRunStatus : uint8
{
    Title, Playing, Ordering, Ended
};

UENUM(BlueprintType)
enum class ECurbsideOrderResult : uint8
{
    Ok, TooExpensive, Closed
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCurbsideRunEnded, const FCurbsideRunResult&, Result);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FCurbsideAte, const FCurbsideMenuItem&, Item, int32, FlavorGained, bool, bComboLeveled);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCurbsideDistrictUnlocked, const FString&, District);

UCLASS(ClassGroup = (Curbside), meta = (BlueprintSpawnableComponent))
class CURBSIDE_API UCurbsideRunComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UCurbsideRunComponent();

    // ---- tuning ------------------------------------------------------------

    /** Starting cash. Higher than the 2D game because the map is bigger. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Tuning")
    int32 StartingCash = 120;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Tuning")
    float StartingHunger = 80.0f;

    /** Length of one crawl, seconds. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Tuning")
    float RunDurationSeconds = 720.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Tuning")
    float HungerDecayPerSecond = 1.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Tuning")
    float ComaDecayPerSecond = 1.2f;

    /** Distinct cuisines needed before the combo multiplier kicks in. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Tuning")
    int32 ComboThreshold = 3;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Tuning")
    float ComboMultiplier = 1.5f;

    /** Added to the multiplier per district beyond the first. This is what
     *  makes taking a vehicle across the city pay better than one block. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside|Tuning")
    float DistrictBonus = 0.12f;

    // ---- live state --------------------------------------------------------

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    ECurbsideRunStatus Status = ECurbsideRunStatus::Title;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    int32 Cash = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    float Hunger = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    float Coma = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    float Flavor = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    float Elapsed = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "Curbside")
    int32 ComboMax = 0;

    // ---- events ------------------------------------------------------------

    UPROPERTY(BlueprintAssignable, Category = "Curbside")
    FCurbsideRunEnded OnRunEnded;

    UPROPERTY(BlueprintAssignable, Category = "Curbside")
    FCurbsideAte OnAte;

    UPROPERTY(BlueprintAssignable, Category = "Curbside")
    FCurbsideDistrictUnlocked OnDistrictUnlocked;

    // ---- API ---------------------------------------------------------------

    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void StartRun();

    /** Advance survival stats. Call from Tick while Status == Playing. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void TickRun(float DeltaSeconds);

    UFUNCTION(BlueprintCallable, Category = "Curbside")
    ECurbsideOrderResult Order(const FCurbsideVendorRow& Vendor, const FCurbsideMenuItem& Item, int32& OutFlavorGained);

    /** Log distance travelled, in METRES, against a vehicle id. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void AddDistance(const FString& ModeId, float Meters);

    UFUNCTION(BlueprintPure, Category = "Curbside")
    ECurbsideTimeOfDay GetTimeOfDay() const;

    /** 0..1 through the run, for driving a time-of-day sky. */
    UFUNCTION(BlueprintPure, Category = "Curbside")
    float GetDayProgress() const;

    UFUNCTION(BlueprintPure, Category = "Curbside")
    float GetFlavorMultiplier() const;

    UFUNCTION(BlueprintPure, Category = "Curbside")
    int32 GetComboCount() const { return CuisinesTried.Num(); }

    UFUNCTION(BlueprintPure, Category = "Curbside")
    int32 GetDistrictCount() const { return DistrictsVisited.Num(); }

    UFUNCTION(BlueprintPure, Category = "Curbside")
    bool IsVendorOpenNow(const FCurbsideVendorRow& Vendor) const;

    UFUNCTION(BlueprintPure, Category = "Curbside")
    static FString ComputeRank(int32 InFlavor, int32 InComboMax, int32 InDistricts);

    /** Marks a hidden vendor as found. Returns false if already known. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    bool Discover(const FString& VendorId);

    UFUNCTION(BlueprintPure, Category = "Curbside")
    bool IsDiscovered(const FString& VendorId) const { return Discovered.Contains(VendorId); }

private:
    /** Returns true and broadcasts if a terminal condition was hit. */
    bool CheckEnd();

    TSet<ECurbsideCuisine> CuisinesTried;
    TSet<FString> DistrictsVisited;
    TSet<FString> Discovered;
    TArray<FCurbsideEatenItem> Eaten;
    TMap<FString, float> DistanceByMode;
};
