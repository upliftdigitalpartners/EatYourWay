#include "CurbsideRunComponent.h"

UCurbsideRunComponent::UCurbsideRunComponent()
{
    // The owner drives TickRun explicitly, so this component does not tick.
    PrimaryComponentTick.bCanEverTick = false;
}

void UCurbsideRunComponent::StartRun()
{
    Status = ECurbsideRunStatus::Playing;
    Cash = StartingCash;
    Hunger = StartingHunger;
    Coma = 0.0f;
    Flavor = 0.0f;
    Elapsed = 0.0f;
    ComboMax = 0;

    CuisinesTried.Reset();
    DistrictsVisited.Reset();
    Discovered.Reset();
    Eaten.Reset();
    DistanceByMode.Reset();
}

void UCurbsideRunComponent::TickRun(float DeltaSeconds)
{
    if (Status != ECurbsideRunStatus::Playing)
    {
        return;
    }

    Hunger = FMath::Max(0.0f, Hunger - HungerDecayPerSecond * DeltaSeconds);
    Coma = FMath::Max(0.0f, Coma - ComaDecayPerSecond * DeltaSeconds);
    Elapsed += DeltaSeconds;

    CheckEnd();
}

ECurbsideTimeOfDay UCurbsideRunComponent::GetTimeOfDay() const
{
    const float T = (RunDurationSeconds > 0.0f) ? (Elapsed / RunDurationSeconds) : 0.0f;
    if (T < 0.4f) { return ECurbsideTimeOfDay::Afternoon; }
    if (T < 0.75f) { return ECurbsideTimeOfDay::Evening; }
    return ECurbsideTimeOfDay::LateNight;
}

float UCurbsideRunComponent::GetDayProgress() const
{
    return (RunDurationSeconds > 0.0f) ? FMath::Clamp(Elapsed / RunDurationSeconds, 0.0f, 1.0f) : 0.0f;
}

float UCurbsideRunComponent::GetFlavorMultiplier() const
{
    const float Combo = (CuisinesTried.Num() >= ComboThreshold) ? ComboMultiplier : 1.0f;
    const float Districts = 1.0f + FMath::Max(0, DistrictsVisited.Num() - 1) * DistrictBonus;
    return Combo * Districts;
}

bool UCurbsideRunComponent::IsVendorOpenNow(const FCurbsideVendorRow& Vendor) const
{
    return Vendor.OpenAt.Contains(GetTimeOfDay());
}

bool UCurbsideRunComponent::Discover(const FString& VendorId)
{
    bool bAlready = false;
    Discovered.Add(VendorId, &bAlready);
    return !bAlready;
}

ECurbsideOrderResult UCurbsideRunComponent::Order(
    const FCurbsideVendorRow& Vendor,
    const FCurbsideMenuItem& Item,
    int32& OutFlavorGained)
{
    OutFlavorGained = 0;

    if (!IsVendorOpenNow(Vendor))
    {
        return ECurbsideOrderResult::Closed;
    }
    if (Item.Price > Cash)
    {
        return ECurbsideOrderResult::TooExpensive;
    }

    Cash -= Item.Price;
    Hunger = FMath::Min(100.0f, Hunger + Item.Hunger);
    Coma += Item.Coma;

    const int32 CuisinesBefore = CuisinesTried.Num();
    CuisinesTried.Add(Vendor.Cuisine);
    const int32 CuisinesAfter = CuisinesTried.Num();
    ComboMax = FMath::Max(ComboMax, CuisinesAfter);
    const bool bComboLeveled = (CuisinesAfter > CuisinesBefore) && (CuisinesAfter >= ComboThreshold);

    const int32 DistrictsBefore = DistrictsVisited.Num();
    DistrictsVisited.Add(Vendor.District);
    const bool bNewDistrict = (DistrictsVisited.Num() > DistrictsBefore) && (DistrictsBefore > 0);

    float Gain = static_cast<float>(Item.Flavor);
    if (Item.bGem)
    {
        Gain *= 1.5f;
    }
    // Multiplier is evaluated after the new cuisine and district are recorded,
    // so the bite that completes a combo already benefits from it.
    Gain *= GetFlavorMultiplier();

    OutFlavorGained = FMath::RoundToInt(Gain);
    Flavor += OutFlavorGained;

    FCurbsideEatenItem Record;
    Record.Name = Item.Name;
    Record.Price = Item.Price;
    Record.Flavor = OutFlavorGained;
    Record.Cuisine = Vendor.Cuisine;
    Record.bGem = Item.bGem;
    Eaten.Add(Record);

    OnAte.Broadcast(Item, OutFlavorGained, bComboLeveled);
    if (bNewDistrict)
    {
        OnDistrictUnlocked.Broadcast(Vendor.District);
    }

    CheckEnd();
    return ECurbsideOrderResult::Ok;
}

void UCurbsideRunComponent::AddDistance(const FString& ModeId, float Meters)
{
    if (Meters <= 0.0f || !FMath::IsFinite(Meters))
    {
        return;
    }
    DistanceByMode.FindOrAdd(ModeId) += Meters;
}

FString UCurbsideRunComponent::ComputeRank(int32 InFlavor, int32 InComboMax, int32 InDistricts)
{
    if (InFlavor > 900 && InComboMax >= 6 && InDistricts >= 4) { return TEXT("Five Borough Legend"); }
    if (InFlavor > 600 && InComboMax >= 5)                     { return TEXT("Citywide Connoisseur"); }
    if (InFlavor > 380 && InDistricts >= 3)                    { return TEXT("Cross-Borough Crawler"); }
    if (InFlavor > 200)                                        { return TEXT("Neighbourhood Regular"); }
    if (InFlavor > 90)                                         { return TEXT("Curb Crawler"); }
    return TEXT("Snacker");
}

bool UCurbsideRunComponent::CheckEnd()
{
    if (Status != ECurbsideRunStatus::Playing)
    {
        return false;
    }

    FString Reason;
    if (Coma >= 100.0f)
    {
        Reason = TEXT("Food coma. You napped in the passenger seat.");
    }
    else if (Hunger <= 0.0f && Cash < 3)
    {
        Reason = TEXT("Hangry and broke. You went looking for an ATM.");
    }
    else if (Elapsed >= RunDurationSeconds)
    {
        Reason = TEXT("Last call. The city tapped out before you did.");
    }

    if (Reason.IsEmpty())
    {
        return false;
    }

    Status = ECurbsideRunStatus::Ended;

    FCurbsideRunResult Result;
    Result.Flavor = FMath::RoundToInt(Flavor);
    Result.Spent = StartingCash - Cash;
    Result.Bites = Eaten.Num();
    Result.ComboMax = ComboMax;
    Result.Rank = ComputeRank(Result.Flavor, ComboMax, DistrictsVisited.Num());
    Result.EndedReason = Reason;
    Result.DistanceByMode = DistanceByMode;

    for (const FCurbsideEatenItem& Item : Eaten)
    {
        if (Item.bGem)
        {
            ++Result.Gems;
        }
    }
    for (const FString& District : DistrictsVisited)
    {
        Result.DistrictsVisited.Add(District);
    }

    OnRunEnded.Broadcast(Result);
    return true;
}
