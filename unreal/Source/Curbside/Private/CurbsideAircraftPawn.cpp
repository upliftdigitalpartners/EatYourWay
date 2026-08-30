#include "CurbsideAircraftPawn.h"

#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "CurbsideRunComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"
#include "GameFramework/SpringArmComponent.h"

namespace
{
    /** Unreal's default gravity, cm/s^2. */
    constexpr float GravityCmS2 = 980.0f;

    /** Trace this far down when measuring altitude. */
    constexpr float AltitudeTraceUU = 200000.0f;  // 2 km
}

ACurbsideAircraftPawn::ACurbsideAircraftPawn()
{
    PrimaryActorTick.bCanEverTick = true;

    Hull = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Hull"));
    Hull->SetSimulatePhysics(true);
    Hull->SetEnableGravity(true);
    Hull->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    Hull->SetCollisionObjectType(ECC_Pawn);
    Hull->SetLinearDamping(0.2f);
    Hull->SetAngularDamping(2.0f);
    SetRootComponent(Hull);

    SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
    SpringArm->SetupAttachment(Hull);
    SpringArm->TargetArmLength = 1600.0f;
    SpringArm->SocketOffset = FVector(0.0f, 0.0f, 450.0f);
    SpringArm->bEnableCameraLag = true;
    SpringArm->bEnableCameraRotationLag = true;
    SpringArm->CameraLagSpeed = 5.0f;
    SpringArm->CameraRotationLagSpeed = 4.0f;
    // Aircraft roll hard; letting the arm inherit it makes the view unreadable.
    SpringArm->bInheritRoll = false;

    ChaseCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("ChaseCamera"));
    ChaseCamera->SetupAttachment(SpringArm);
}

void ACurbsideAircraftPawn::NotifyControllerChanged()
{
    Super::NotifyControllerChanged();

    if (const APlayerController* PC = Cast<APlayerController>(GetController()))
    {
        if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
                ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
        {
            if (FlightContext)
            {
                Subsystem->AddMappingContext(FlightContext, 0);
            }
        }
    }
}

void ACurbsideAircraftPawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
    if (!Input)
    {
        return;
    }

    auto BindAxis = [Input, this](UInputAction* Action, void (ACurbsideAircraftPawn::*Fn)(const FInputActionValue&))
    {
        if (Action)
        {
            Input->BindAction(Action, ETriggerEvent::Triggered, this, Fn);
            Input->BindAction(Action, ETriggerEvent::Completed, this, Fn);
        }
    };

    BindAxis(ThrottleAction, &ACurbsideAircraftPawn::HandleThrottle);
    BindAxis(CyclicAction, &ACurbsideAircraftPawn::HandleCyclic);
    BindAxis(YawAction, &ACurbsideAircraftPawn::HandleYaw);
    BindAxis(LiftAction, &ACurbsideAircraftPawn::HandleLift);

    if (ExitAction)
    {
        Input->BindAction(ExitAction, ETriggerEvent::Started, this, &ACurbsideAircraftPawn::HandleExit);
    }
}

void ACurbsideAircraftPawn::HandleThrottle(const FInputActionValue& Value) { ThrottleInput = Value.Get<float>(); }
void ACurbsideAircraftPawn::HandleYaw(const FInputActionValue& Value)      { YawInput = Value.Get<float>(); }
void ACurbsideAircraftPawn::HandleLift(const FInputActionValue& Value)     { LiftInput = Value.Get<float>(); }
void ACurbsideAircraftPawn::HandleExit(const FInputActionValue& /*Value*/) { OnRequestExit(); }

void ACurbsideAircraftPawn::HandleCyclic(const FInputActionValue& Value)
{
    const FVector2D Axis = Value.Get<FVector2D>();
    RollInput = Axis.X;
    PitchInput = Axis.Y;
}

float ACurbsideAircraftPawn::GetAirspeedMps() const
{
    if (!Hull)
    {
        return 0.0f;
    }
    const float ForwardUU = FVector::DotProduct(Hull->GetPhysicsLinearVelocity(), GetActorForwardVector());
    return CurbsideUnits::UUToMeters(ForwardUU);
}

float ACurbsideAircraftPawn::GetAltitudeMeters() const
{
    const FVector Start = GetActorLocation();
    FHitResult Hit;
    FCollisionQueryParams Params;
    Params.AddIgnoredActor(this);

    if (GetWorld()->LineTraceSingleByChannel(
            Hit, Start, Start - FVector(0.0f, 0.0f, AltitudeTraceUU), ECC_Visibility, Params))
    {
        return CurbsideUnits::UUToMeters(Hit.Distance);
    }
    return CurbsideUnits::UUToMeters(Start.Z);
}

bool ACurbsideAircraftPawn::IsOnGround() const
{
    // Half the hull's height plus a small tolerance.
    const float Clearance = Hull ? Hull->Bounds.BoxExtent.Z + 40.0f : 100.0f;
    return CurbsideUnits::MetersToUU(GetAltitudeMeters()) <= Clearance;
}

UCurbsideRunComponent* ACurbsideAircraftPawn::FindRunComponent() const
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

void ACurbsideAircraftPawn::AutoLevel(float Strength)
{
    if (!Hull)
    {
        return;
    }
    // The hull's up vector tipping toward +Y is roll; toward +X is pitch.
    // Torque proportional to the tip brings it back without fighting input.
    const FVector Up = GetActorUpVector();
    const FVector Correction(-Up.Y * Strength, Up.X * Strength, 0.0f);
    Hull->AddTorqueInRadians(Correction, NAME_None, /*bAccelChange=*/true);
}

void ACurbsideAircraftPawn::TickHelicopter(float DeltaSeconds)
{
    if (!Hull || !Spec)
    {
        return;
    }

    // Collective. Neutral exactly cancels gravity, so the aircraft hovers when
    // the stick is centred; LiftRatio sets how much climb is available above that.
    const float Collective = GravityCmS2 * (1.0f + LiftInput * FMath::Max(0.1f, Spec->LiftRatio - 1.0f));
    Hull->AddForce(GetActorUpVector() * Collective, NAME_None, /*bAccelChange=*/true);

    // Cyclic and tail rotor, in radians/s^2.
    const float T = 2.2f;
    Hull->AddTorqueInRadians(GetActorRightVector() * (PitchInput * Spec->PitchRate * T), NAME_None, true);
    Hull->AddTorqueInRadians(GetActorForwardVector() * (RollInput * Spec->RollRate * T), NAME_None, true);
    Hull->AddTorqueInRadians(FVector::UpVector * (YawInput * Spec->YawRate * T), NAME_None, true);

    AutoLevel(3.2f);

    // Bleed off anything over the spec top speed with drag rather than a clamp.
    const FVector Vel = Hull->GetPhysicsLinearVelocity();
    const float SpeedUU = Vel.Size();
    const float MaxUU = Spec->GetMaxSpeedUU();
    if (SpeedUU > MaxUU && SpeedUU > KINDA_SMALL_NUMBER)
    {
        Hull->AddForce(-Vel.GetSafeNormal() * (SpeedUU - MaxUU) * 2.0f, NAME_None, true);
    }

    Hull->SetLinearDamping(0.35f);
    Hull->SetAngularDamping(2.6f);
}

void ACurbsideAircraftPawn::TickFixedWing(float DeltaSeconds)
{
    if (!Hull || !Spec)
    {
        return;
    }

    const float AirspeedMps = GetAirspeedMps();
    const float Stall = FMath::Max(1.0f, Spec->StallSpeedMps);
    const bool bOnGround = IsOnGround();

    // Thrust. Reverse thrust is not a thing, so clamp to forward only.
    const float Throttle = FMath::Max(0.0f, ThrottleInput);
    Hull->AddForce(GetActorForwardVector() * (Throttle * Spec->AccelScale * 30.0f), NAME_None, true);

    // Track the ground roll so a jet has to use the runway.
    if (bOnGround)
    {
        GroundRoll += FMath::Abs(AirspeedMps) * DeltaSeconds;
    }
    else
    {
        GroundRoll = FMath::Max(GroundRoll, Spec->TakeoffRollMeters);
    }
    const bool bRotated = !bOnGround || (GroundRoll >= Spec->TakeoffRollMeters * 0.55f);

    // Lift grows with the square of airspeed and vanishes below stall.
    if (bRotated && AirspeedMps > Stall * 0.4f)
    {
        const float Q = FMath::Square(AirspeedMps / Stall);
        const float Lift = FMath::Min(Q, 2.4f) * GravityCmS2 * Spec->LiftRatio * 0.45f;
        Hull->AddForce(GetActorUpVector() * Lift, NAME_None, true);
    }

    // Control authority scales with airspeed: mushy when slow, sharp when fast.
    const float Authority = FMath::Min(1.4f, FMath::Abs(AirspeedMps) / Stall);
    const float T = 2.0f * Authority;
    Hull->AddTorqueInRadians(GetActorRightVector() * (PitchInput * Spec->PitchRate * T), NAME_None, true);
    Hull->AddTorqueInRadians(GetActorForwardVector() * (RollInput * Spec->RollRate * T), NAME_None, true);
    Hull->AddTorqueInRadians(FVector::UpVector * (YawInput * Spec->YawRate * T), NAME_None, true);

    // Nosewheel steering while still slow on the ground.
    if (bOnGround && AirspeedMps < Stall)
    {
        Hull->AddTorqueInRadians(FVector::UpVector * (YawInput * 1.4f), NAME_None, true);
    }

    const FVector Vel = Hull->GetPhysicsLinearVelocity();
    const float SpeedUU = Vel.Size();
    const float MaxUU = Spec->GetMaxSpeedUU();
    if (SpeedUU > MaxUU && SpeedUU > KINDA_SMALL_NUMBER)
    {
        Hull->AddForce(-Vel.GetSafeNormal() * (SpeedUU - MaxUU) * 1.8f, NAME_None, true);
    }

    Hull->SetAngularDamping(bOnGround ? 3.0f : 1.5f);
    Hull->SetLinearDamping(0.05f);
}

void ACurbsideAircraftPawn::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (Spec)
    {
        if (Spec->Drive == ECurbsideDrive::Helicopter)
        {
            TickHelicopter(DeltaSeconds);
        }
        else if (Spec->Drive == ECurbsideDrive::Plane)
        {
            TickFixedWing(DeltaSeconds);
        }
    }

    // Spin the rotor for feedback; purely cosmetic.
    if (RotorMesh)
    {
        const float Rpm = (Spec && Spec->Drive == ECurbsideDrive::Helicopter) ? 1400.0f : 2200.0f;
        RotorMesh->AddLocalRotation(FRotator(0.0f, Rpm * DeltaSeconds, 0.0f));
    }

    const FVector Now = GetActorLocation();
    if (bHasLastLocation && Spec)
    {
        if (UCurbsideRunComponent* Run = FindRunComponent())
        {
            Run->AddDistance(Spec->VehicleId, CurbsideUnits::UUToMeters(FVector::Dist(Now, LastLocation)));
        }
    }
    LastLocation = Now;
    bHasLastLocation = true;
}

FTransform ACurbsideAircraftPawn::GetExitTransform_Implementation() const
{
    const float Clearance = (Hull ? Hull->Bounds.BoxExtent.Y : 150.0f) + 120.0f;
    const FVector Location = GetActorLocation() - GetActorRightVector() * Clearance;
    return FTransform(FRotator(0.0f, GetActorRotation().Yaw, 0.0f), Location);
}

bool ACurbsideAircraftPawn::CanBeEntered_Implementation() const
{
    // Boarding a moving aircraft is not a thing. Require it to be settled.
    return !Hull || Hull->GetPhysicsLinearVelocity().SizeSquared() < FMath::Square(150.0f);
}
