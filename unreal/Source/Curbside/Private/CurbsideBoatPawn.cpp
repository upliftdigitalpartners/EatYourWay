#include "CurbsideBoatPawn.h"

#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "CurbsideCharacter.h"
#include "CurbsideRunComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"
#include "GameFramework/SpringArmComponent.h"

namespace
{
    constexpr float GravityCmS2 = 980.0f;
}

ACurbsideBoatPawn::ACurbsideBoatPawn()
{
    PrimaryActorTick.bCanEverTick = true;

    Hull = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Hull"));
    Hull->SetSimulatePhysics(true);
    Hull->SetEnableGravity(true);
    Hull->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    Hull->SetCollisionObjectType(ECC_Pawn);
    SetRootComponent(Hull);

    SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
    SpringArm->SetupAttachment(Hull);
    SpringArm->TargetArmLength = 1100.0f;
    SpringArm->SocketOffset = FVector(0.0f, 0.0f, 350.0f);
    SpringArm->bEnableCameraLag = true;
    SpringArm->CameraLagSpeed = 6.0f;
    SpringArm->bInheritRoll = false;
    SpringArm->bInheritPitch = false;

    ChaseCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("ChaseCamera"));
    ChaseCamera->SetupAttachment(SpringArm);
}

void ACurbsideBoatPawn::NotifyControllerChanged()
{
    Super::NotifyControllerChanged();

    if (const APlayerController* PC = Cast<APlayerController>(GetController()))
    {
        if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
                ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
        {
            if (BoatContext)
            {
                Subsystem->AddMappingContext(BoatContext, 0);
            }
        }
    }
}

void ACurbsideBoatPawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
    if (!Input)
    {
        return;
    }
    if (ThrottleAction)
    {
        Input->BindAction(ThrottleAction, ETriggerEvent::Triggered, this, &ACurbsideBoatPawn::HandleThrottle);
        Input->BindAction(ThrottleAction, ETriggerEvent::Completed, this, &ACurbsideBoatPawn::HandleThrottle);
    }
    if (SteerAction)
    {
        Input->BindAction(SteerAction, ETriggerEvent::Triggered, this, &ACurbsideBoatPawn::HandleSteer);
        Input->BindAction(SteerAction, ETriggerEvent::Completed, this, &ACurbsideBoatPawn::HandleSteer);
    }
    if (ExitAction)
    {
        Input->BindAction(ExitAction, ETriggerEvent::Started, this, &ACurbsideBoatPawn::HandleExit);
    }
}

void ACurbsideBoatPawn::HandleThrottle(const FInputActionValue& Value) { ThrottleInput = Value.Get<float>(); }
void ACurbsideBoatPawn::HandleSteer(const FInputActionValue& Value)    { SteerInput = Value.Get<float>(); }
void ACurbsideBoatPawn::HandleExit(const FInputActionValue& /*Value*/)
{
    ACurbsideCharacter::LeaveVehicle(this);
    OnRequestExit();
}

UCurbsideRunComponent* ACurbsideBoatPawn::FindRunComponent() const
{
    if (const AController* C = GetController())
    {
        if (UCurbsideRunComponent* Found = C->FindComponentByClass<UCurbsideRunComponent>())
        {
            return Found;
        }
        if (const APlayerController* PC = Cast<APlayerController>(C))
        {
            if (PC->PlayerState)
            {
                return PC->PlayerState->FindComponentByClass<UCurbsideRunComponent>();
            }
        }
    }
    return nullptr;
}

void ACurbsideBoatPawn::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (!Hull || !Spec)
    {
        return;
    }

    const FVector Extent = Hull->Bounds.BoxExtent;
    const float WaterZ = Spec->WaterLevelZ;

    // Four sample points near the corners of the hull. Applying buoyancy at
    // each is what lets the boat pitch into a wave instead of bobbing flat.
    const FVector Offsets[4] = {
        FVector( Extent.X * 0.7f,  Extent.Y * 0.7f, 0.0f),
        FVector( Extent.X * 0.7f, -Extent.Y * 0.7f, 0.0f),
        FVector(-Extent.X * 0.7f,  Extent.Y * 0.7f, 0.0f),
        FVector(-Extent.X * 0.7f, -Extent.Y * 0.7f, 0.0f),
    };

    const float Draft = Extent.Z * 0.65f;
    int32 SubmergedPoints = 0;

    for (const FVector& LocalOffset : Offsets)
    {
        const FVector WorldPoint = GetActorTransform().TransformPosition(LocalOffset);
        const float Depth = WaterZ - (WorldPoint.Z - Draft);
        if (Depth <= 0.0f)
        {
            continue;
        }
        ++SubmergedPoints;

        // Archimedes, capped so a deeply submerged hull does not launch.
        const float Lift = FMath::Min(Depth * Spec->Buoyancy * 12.0f, GravityCmS2 * 3.0f);
        Hull->AddForceAtLocation(FVector(0.0f, 0.0f, Lift) * Hull->GetMass() * 0.25f, WorldPoint);
    }

    bInWater = SubmergedPoints > 0;
    if (!bInWater)
    {
        // Out of the water it is just a heavy box falling.
        Hull->SetLinearDamping(0.1f);
        Hull->SetAngularDamping(0.6f);
        return;
    }

    const FVector Velocity = Hull->GetPhysicsLinearVelocity();

    // Vertical damping stops the hull pogoing on the surface.
    Hull->AddForce(FVector(0.0f, 0.0f, -Velocity.Z * 1.4f), NAME_None, /*bAccelChange=*/true);

    // Thrust and rudder only bite while wet.
    Hull->AddForce(GetActorForwardVector() * (ThrottleInput * Spec->AccelScale * 22.0f), NAME_None, true);

    // Rudder authority needs way on; a stationary boat cannot turn.
    const float ForwardMps = CurbsideUnits::UUToMeters(
        FVector::DotProduct(Velocity, GetActorForwardVector()));
    const float Way = FMath::Min(1.0f, FMath::Abs(ForwardMps) / 4.0f);
    Hull->AddTorqueInRadians(FVector::UpVector * (SteerInput * Spec->YawRate * 2.4f * Way), NAME_None, true);

    // Lateral resistance: the defining characteristic of a hull.
    const FVector Right = GetActorRightVector();
    const float Lateral = FVector::DotProduct(Velocity, Right);
    Hull->AddForce(-Right * (Lateral * Spec->WaterDrag), NAME_None, true);

    // Cap to the spec top speed.
    const float SpeedUU = Velocity.Size();
    const float MaxUU = Spec->GetMaxSpeedUU();
    if (SpeedUU > MaxUU && SpeedUU > KINDA_SMALL_NUMBER)
    {
        Hull->AddForce(-Velocity.GetSafeNormal() * (SpeedUU - MaxUU) * 1.5f, NAME_None, true);
    }

    Hull->SetLinearDamping(0.5f);
    Hull->SetAngularDamping(2.6f);

    const FVector Now = GetActorLocation();
    if (bHasLastLocation)
    {
        if (UCurbsideRunComponent* Run = FindRunComponent())
        {
            Run->AddDistance(Spec->VehicleId, CurbsideUnits::UUToMeters(FVector::Dist2D(Now, LastLocation)));
        }
    }
    LastLocation = Now;
    bHasLastLocation = true;
}

FTransform ACurbsideBoatPawn::GetExitTransform_Implementation() const
{
    // Put the player on the deck rather than in the water beside the hull.
    const float DeckZ = Hull ? Hull->Bounds.BoxExtent.Z + 60.0f : 100.0f;
    const FVector Location = GetActorLocation() + FVector(0.0f, 0.0f, DeckZ);
    return FTransform(FRotator(0.0f, GetActorRotation().Yaw, 0.0f), Location);
}

bool ACurbsideBoatPawn::CanBeEntered_Implementation() const
{
    return true;
}
