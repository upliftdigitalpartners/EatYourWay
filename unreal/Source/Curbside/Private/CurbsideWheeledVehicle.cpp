#include "CurbsideWheeledVehicle.h"

#include "ChaosWheeledVehicleMovementComponent.h"
#include "Camera/CameraComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "CurbsideRunComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"
#include "GameFramework/SpringArmComponent.h"

ACurbsideWheeledVehicle::ACurbsideWheeledVehicle()
{
    PrimaryActorTick.bCanEverTick = true;

    SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
    SpringArm->SetupAttachment(GetMesh());
    SpringArm->TargetArmLength = 750.0f;
    SpringArm->SocketOffset = FVector(0.0f, 0.0f, 250.0f);
    SpringArm->bEnableCameraLag = true;
    SpringArm->bEnableCameraRotationLag = true;
    SpringArm->CameraLagSpeed = 8.0f;
    SpringArm->CameraRotationLagSpeed = 6.0f;
    SpringArm->bInheritPitch = false;
    SpringArm->bInheritRoll = false;

    ChaseCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("ChaseCamera"));
    ChaseCamera->SetupAttachment(SpringArm);
}

void ACurbsideWheeledVehicle::NotifyControllerChanged()
{
    Super::NotifyControllerChanged();

    if (const APlayerController* PC = Cast<APlayerController>(GetController()))
    {
        if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
                ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
        {
            if (DrivingContext)
            {
                Subsystem->AddMappingContext(DrivingContext, 0);
            }
        }
    }
}

void ACurbsideWheeledVehicle::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
    if (!Input)
    {
        return;
    }

    if (ThrottleAction)
    {
        Input->BindAction(ThrottleAction, ETriggerEvent::Triggered, this, &ACurbsideWheeledVehicle::HandleThrottle);
        Input->BindAction(ThrottleAction, ETriggerEvent::Completed, this, &ACurbsideWheeledVehicle::HandleThrottle);
    }
    if (SteerAction)
    {
        Input->BindAction(SteerAction, ETriggerEvent::Triggered, this, &ACurbsideWheeledVehicle::HandleSteer);
        Input->BindAction(SteerAction, ETriggerEvent::Completed, this, &ACurbsideWheeledVehicle::HandleSteer);
    }
    if (BrakeAction)
    {
        Input->BindAction(BrakeAction, ETriggerEvent::Started, this, &ACurbsideWheeledVehicle::HandleBrakeStart);
        Input->BindAction(BrakeAction, ETriggerEvent::Completed, this, &ACurbsideWheeledVehicle::HandleBrakeStop);
    }
    if (ExitAction)
    {
        Input->BindAction(ExitAction, ETriggerEvent::Started, this, &ACurbsideWheeledVehicle::HandleExit);
    }
}

void ACurbsideWheeledVehicle::HandleThrottle(const FInputActionValue& Value)
{
    const float Axis = Value.Get<float>();
    if (UChaosWheeledVehicleMovementComponent* Move =
            Cast<UChaosWheeledVehicleMovementComponent>(GetVehicleMovementComponent()))
    {
        // Chaos wants throttle and brake as separate positive inputs; a
        // negative axis is reverse, which it handles via gearing.
        Move->SetThrottleInput(FMath::Abs(Axis));
        Move->SetTargetGear(Axis < -0.05f ? -1 : 1, /*bImmediate=*/false);
    }
}

void ACurbsideWheeledVehicle::HandleSteer(const FInputActionValue& Value)
{
    if (UChaosWheeledVehicleMovementComponent* Move =
            Cast<UChaosWheeledVehicleMovementComponent>(GetVehicleMovementComponent()))
    {
        Move->SetSteeringInput(Value.Get<float>());
    }
}

void ACurbsideWheeledVehicle::HandleBrakeStart(const FInputActionValue& /*Value*/)
{
    if (UChaosWheeledVehicleMovementComponent* Move =
            Cast<UChaosWheeledVehicleMovementComponent>(GetVehicleMovementComponent()))
    {
        Move->SetBrakeInput(1.0f);
        Move->SetHandbrakeInput(true);
    }
}

void ACurbsideWheeledVehicle::HandleBrakeStop(const FInputActionValue& /*Value*/)
{
    if (UChaosWheeledVehicleMovementComponent* Move =
            Cast<UChaosWheeledVehicleMovementComponent>(GetVehicleMovementComponent()))
    {
        Move->SetBrakeInput(0.0f);
        Move->SetHandbrakeInput(false);
    }
}

void ACurbsideWheeledVehicle::HandleExit(const FInputActionValue& /*Value*/)
{
    OnRequestExit();
}

UCurbsideRunComponent* ACurbsideWheeledVehicle::FindRunComponent() const
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

void ACurbsideWheeledVehicle::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    UChaosWheeledVehicleMovementComponent* Move =
        Cast<UChaosWheeledVehicleMovementComponent>(GetVehicleMovementComponent());

    // Enforce the spec's top speed. Chaos has no direct cap, so cut throttle
    // once we are over it rather than clamping velocity (which feels rubbery).
    if (Move && Spec)
    {
        const float SpeedUU = FMath::Abs(Move->GetForwardSpeed());
        if (SpeedUU > Spec->GetMaxSpeedUU())
        {
            Move->SetThrottleInput(0.0f);
        }
    }

    // Log distance for the end-of-run travel breakdown.
    const FVector Now = GetActorLocation();
    if (bHasLastLocation && Spec)
    {
        const float MovedUU = FVector::Dist2D(Now, LastLocation);
        if (UCurbsideRunComponent* Run = FindRunComponent())
        {
            Run->AddDistance(Spec->VehicleId, CurbsideUnits::UUToMeters(MovedUU));
        }
    }
    LastLocation = Now;
    bHasLastLocation = true;
}

FTransform ACurbsideWheeledVehicle::GetExitTransform_Implementation() const
{
    // Step out to the driver's side, clear of the vehicle's own collision.
    const float Clearance = (GetMesh() ? GetMesh()->Bounds.BoxExtent.Y : 100.0f) + 90.0f;
    const FVector Location = GetActorLocation() - GetActorRightVector() * Clearance;
    return FTransform(FRotator(0.0f, GetActorRotation().Yaw, 0.0f), Location);
}

bool ACurbsideWheeledVehicle::CanBeEntered_Implementation() const
{
    return true;
}
