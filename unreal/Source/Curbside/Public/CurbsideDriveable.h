// Curbside — the contract for anything the player can get into.
//
// The three vehicle pawns cannot share a base class: wheeled vehicles must
// derive from AWheeledVehiclePawn for Chaos, while aircraft and boats are
// plain APawns with custom physics. An interface gives the character one way
// to talk to all of them.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "CurbsideDriveable.generated.h"

class UCurbsideVehicleSpec;

UINTERFACE(MinimalAPI, BlueprintType)
class UCurbsideDriveable : public UInterface
{
    GENERATED_BODY()
};

class CURBSIDE_API ICurbsideDriveable
{
    GENERATED_BODY()

public:
    /** The spec driving this vehicle's handling and HUD readout. */
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Curbside")
    UCurbsideVehicleSpec* GetVehicleSpec() const;

    /** Where to place the player when they get out. Should be clear of the
     *  vehicle's own collision, or they will be pushed through the floor. */
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Curbside")
    FTransform GetExitTransform() const;

    /** False while the vehicle is unusable — a boat beached on land, say. */
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Curbside")
    bool CanBeEntered() const;
};
