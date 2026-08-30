#include "CurbsidePlayerState.h"

#include "CurbsideRunComponent.h"

ACurbsidePlayerState::ACurbsidePlayerState()
{
    PrimaryActorTick.bCanEverTick = true;
    Run = CreateDefaultSubobject<UCurbsideRunComponent>(TEXT("Run"));
}

void ACurbsidePlayerState::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    // The rules component does not tick itself, so that whoever owns it
    // controls when the clock runs (paused menus, cutscenes, and so on).
    if (Run)
    {
        Run->TickRun(DeltaSeconds);
    }
}
