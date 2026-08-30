// Curbside — carries the run across possession changes.
//
// The player swaps pawns constantly (foot -> car -> helicopter -> foot), so the
// run state cannot live on the pawn. PlayerState survives all of it, and every
// pawn's FindRunComponent() looks here.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "CurbsidePlayerState.generated.h"

class UCurbsideRunComponent;

UCLASS()
class CURBSIDE_API ACurbsidePlayerState : public APlayerState
{
    GENERATED_BODY()

public:
    ACurbsidePlayerState();

    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UCurbsideRunComponent> Run;
};
