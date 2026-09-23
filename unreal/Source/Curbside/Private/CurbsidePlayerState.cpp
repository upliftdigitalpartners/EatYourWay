#include "CurbsidePlayerState.h"

#include "CurbsideRunComponent.h"

ACurbsidePlayerState::ACurbsidePlayerState()
{
    PrimaryActorTick.bCanEverTick = true;
    Run = CreateDefaultSubobject<UCurbsideRunComponent>(TEXT("Run"));
}

void ACurbsidePlayerState::BeginPlay()
{
    Super::BeginPlay();

    // Nothing else was starting it, so the clock never ran and every Order()
    // was refused for an inactive run. The crawl begins when the player does.
    if (Run)
    {
        Run->StartRun();
    }
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
