#include "CurbsideVendorActor.h"

#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/DataTable.h"
#include "Engine/World.h"
#include "TimerManager.h"

ACurbsideVendorActor::ACurbsideVendorActor()
{
    PrimaryActorTick.bCanEverTick = false;

    Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);

    StallMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("StallMesh"));
    StallMesh->SetupAttachment(Root);
    StallMesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);

    PinMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PinMesh"));
    PinMesh->SetupAttachment(Root);
    PinMesh->SetRelativeLocation(FVector(0.0f, 0.0f, 720.0f));
    PinMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    InteractSphere = CreateDefaultSubobject<USphereComponent>(TEXT("InteractSphere"));
    InteractSphere->SetupAttachment(Root);
    InteractSphere->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    InteractSphere->SetCollisionResponseToAllChannels(ECR_Overlap);
    InteractSphere->SetSphereRadius(CurbsideUnits::MetersToUU(9.0f));
}

void ACurbsideVendorActor::InitialiseFromRow(const FCurbsideVendorRow& InRow)
{
    Row = InRow;
    InteractSphere->SetSphereRadius(CurbsideUnits::MetersToUU(InteractRangeMeters));

    bRevealed = !Row.bHidden;
    SetActorHiddenInGame(!bRevealed);
    // A hidden vendor still needs its collision live, or the player walks
    // through the stall before it appears.
    StallMesh->SetVisibility(bRevealed);
    PinMesh->SetVisibility(bRevealed);
}

void ACurbsideVendorActor::Reveal()
{
    if (bRevealed)
    {
        return;
    }
    bRevealed = true;
    SetActorHiddenInGame(false);
    StallMesh->SetVisibility(true);
    PinMesh->SetVisibility(true);
    OnVendorRevealed();
}

// ---------------------------------------------------------------------------

ACurbsideVendorSpawner::ACurbsideVendorSpawner()
{
    PrimaryActorTick.bCanEverTick = false;
    VendorClass = ACurbsideVendorActor::StaticClass();
}

void ACurbsideVendorSpawner::BeginPlay()
{
    Super::BeginPlay();
    SpawnVendors();
}

void ACurbsideVendorSpawner::SpawnVendors()
{
    if (!VendorTable || !VendorClass)
    {
        UE_LOG(LogTemp, Warning, TEXT("[Curbside] VendorSpawner is missing its table or class; no vendors spawned."));
        return;
    }

    Spawned.Reset();

    static const FString Context(TEXT("CurbsideVendorSpawner"));
    TArray<FCurbsideVendorRow*> Rows;
    VendorTable->GetAllRows(Context, Rows);

    for (const FCurbsideVendorRow* RowPtr : Rows)
    {
        if (!RowPtr)
        {
            continue;
        }

        const FVector LocalOffset = RowPtr->GetLocalOffset();
        const FVector WorldLocation = GeoreferenceOrigin.TransformPosition(LocalOffset);

        FActorSpawnParameters Params;
        Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

        ACurbsideVendorActor* Vendor = GetWorld()->SpawnActor<ACurbsideVendorActor>(
            VendorClass, FTransform(GeoreferenceOrigin.GetRotation(), WorldLocation), Params);
        if (!Vendor)
        {
            continue;
        }

        Vendor->InitialiseFromRow(*RowPtr);
        Spawned.Add(Vendor);
    }

    UE_LOG(LogTemp, Log, TEXT("[Curbside] Spawned %d vendors."), Spawned.Num());

    if (bSnapToGround)
    {
        SnapAttempts = 0;
        RetrySnapToGround();
    }
}

void ACurbsideVendorSpawner::RetrySnapToGround()
{
    ++SnapAttempts;
    int32 Remaining = 0;

    for (const TObjectPtr<ACurbsideVendorActor>& Vendor : Spawned)
    {
        if (!IsValid(Vendor.Get()))
        {
            continue;
        }

        const FVector Origin = Vendor->GetActorLocation();
        const FVector Start = Origin + FVector(0.0f, 0.0f, CurbsideUnits::MetersToUU(400.0f));
        const FVector End = Origin - FVector(0.0f, 0.0f, CurbsideUnits::MetersToUU(400.0f));

        FHitResult Hit;
        FCollisionQueryParams Params;
        Params.AddIgnoredActor(Vendor.Get());
        Params.AddIgnoredActor(this);

        if (GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_WorldStatic, Params))
        {
            Vendor->SetActorLocation(Hit.ImpactPoint);
        }
        else
        {
            ++Remaining;
        }
    }

    // Cesium tiles stream in over the first few seconds; give them time before
    // leaving vendors floating at their authored height.
    if (Remaining > 0 && SnapAttempts < 10)
    {
        GetWorld()->GetTimerManager().SetTimer(
            SnapTimer, this, &ACurbsideVendorSpawner::RetrySnapToGround, 1.0f, false);
    }
    else if (Remaining > 0)
    {
        UE_LOG(LogTemp, Warning,
            TEXT("[Curbside] %d vendors never found ground after %d attempts; check the georeference origin."),
            Remaining, SnapAttempts);
    }
}
