#include "CurbsideRoadVehicle.h"

#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "CurbsideRunComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"
#include "GameFramework/SpringArmComponent.h"

ACurbsideRoadVehicle::ACurbsideRoadVehicle()
{
    PrimaryActorTick.bCanEverTick = true;

    Hull = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Hull"));
    Hull->SetSimulatePhysics(true);
    Hull->SetEnableGravity(true);
    Hull->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    Hull->SetCollisionObjectType(ECC_Pawn);
    Hull->SetAngularDamping(3.0f);
    Hull->SetLinearDamping(0.05f);
    SetRootComponent(Hull);

    SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
    SpringArm->SetupAttachment(Hull);
    SpringArm->TargetArmLength = 750.0f;
    SpringArm->SocketOffset = FVector(0.0f, 0.0f, 220.0f);
    SpringArm->bEnableCameraLag = true;
    SpringArm->CameraLagSpeed = 8.0f;
    SpringArm->bInheritRoll = false;
    SpringArm->bInheritPitch = false;

    ChaseCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("ChaseCamera"));
    ChaseCamera->SetupAttachment(SpringArm);
}

void ACurbsideRoadVehicle::BeginPlay()
{
    Super::BeginPlay();

    if (Hull == nullptr)
    {
        return;
    }

    if (Spec)
    {
        // Scale the placeholder hull to the spec before measuring it, so a bus
        // is bus-shaped whatever mesh it was given. A real mesh is already the
        // right size, so this is only for the unit-cube stand-ins: it assumes a
        // 1 m cube, which is what /Game/LevelPrototyping/Meshes/SM_Cube is.
        if (const UStaticMesh* Mesh = Hull->GetStaticMesh())
        {
            const FVector MeshSize = Mesh->GetBoundingBox().GetSize();
            if (MeshSize.GetMin() > KINDA_SMALL_NUMBER)
            {
                const FVector WantUU = Spec->SizeMeters * CurbsideUnits::UUPerMeter;
                Hull->SetRelativeScale3D(WantUU / MeshSize);
            }
        }
        Hull->SetMassOverrideInKg(NAME_None, Spec->MassKg, true);
    }

    // Local half-extents, not Bounds.BoxExtent: that one is the world-space AABB
    // and grows as the car turns, which would walk the wheels outwards.
    if (const UStaticMesh* Mesh = Hull->GetStaticMesh())
    {
        LocalExtent = Mesh->GetBoundingBox().GetExtent() * Hull->GetComponentScale();
    }

    // A box on four springs rolls over in the first corner unless the weight
    // sits low. This is the single biggest stability win here.
    Hull->SetCenterOfMass(FVector(0.0f, 0.0f, -LocalExtent.Z * 0.55f));
}

void ACurbsideRoadVehicle::NotifyControllerChanged()
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

void ACurbsideRoadVehicle::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
    if (!Input)
    {
        return;
    }
    if (ThrottleAction)
    {
        Input->BindAction(ThrottleAction, ETriggerEvent::Triggered, this, &ACurbsideRoadVehicle::HandleThrottle);
        Input->BindAction(ThrottleAction, ETriggerEvent::Completed, this, &ACurbsideRoadVehicle::HandleThrottle);
    }
    if (SteerAction)
    {
        Input->BindAction(SteerAction, ETriggerEvent::Triggered, this, &ACurbsideRoadVehicle::HandleSteer);
        Input->BindAction(SteerAction, ETriggerEvent::Completed, this, &ACurbsideRoadVehicle::HandleSteer);
    }
    if (BrakeAction)
    {
        Input->BindAction(BrakeAction, ETriggerEvent::Triggered, this, &ACurbsideRoadVehicle::HandleBrake);
        Input->BindAction(BrakeAction, ETriggerEvent::Completed, this, &ACurbsideRoadVehicle::HandleBrake);
    }
    if (ExitAction)
    {
        Input->BindAction(ExitAction, ETriggerEvent::Started, this, &ACurbsideRoadVehicle::HandleExit);
    }
}

void ACurbsideRoadVehicle::HandleThrottle(const FInputActionValue& Value) { ThrottleInput = Value.Get<float>(); }
void ACurbsideRoadVehicle::HandleSteer(const FInputActionValue& Value)    { SteerInput = Value.Get<float>(); }
void ACurbsideRoadVehicle::HandleBrake(const FInputActionValue& Value)    { BrakeInput = Value.Get<float>(); }
void ACurbsideRoadVehicle::HandleExit(const FInputActionValue& /*Value*/) { OnRequestExit(); }

UCurbsideRunComponent* ACurbsideRoadVehicle::FindRunComponent() const
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

int32 ACurbsideRoadVehicle::ApplySuspension()
{
    const UWorld* World = GetWorld();
    if (World == nullptr)
    {
        return 0;
    }

    const float RestUU = CurbsideUnits::MetersToUU(SuspensionRestMeters);
    const float RadiusUU = CurbsideUnits::MetersToUU(WheelRadiusMeters);
    const float MaxTravel = RestUU + RadiusUU;

    // Same layout as the web build: track is 82% of the body width, wheelbase
    // 62% of its length, hubs a little below the centreline.
    const float HalfTrack = LocalExtent.Y * 0.82f;
    const float HalfBase = LocalExtent.X * 0.62f;
    const float HubZ = -LocalExtent.Z * 0.68f;

    const FVector Anchors[4] = {
        FVector( HalfBase, -HalfTrack, HubZ),   // front left
        FVector( HalfBase,  HalfTrack, HubZ),   // front right
        FVector(-HalfBase, -HalfTrack, HubZ),   // rear left
        FVector(-HalfBase,  HalfTrack, HubZ),   // rear right
    };

    const FTransform Transform = GetActorTransform();
    const FVector Up = GetActorUpVector();
    const FVector Right = GetActorRightVector();
    const float QuarterMass = Hull->GetMass() * 0.25f;

    FCollisionQueryParams Params(TEXT("CurbsideSuspension"), /*bTraceComplex=*/false, this);

    int32 Grounded = 0;
    for (const FVector& Anchor : Anchors)
    {
        const FVector Start = Transform.TransformPosition(Anchor);
        const FVector End = Start - Up * MaxTravel;

        FHitResult Hit;
        if (!World->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params))
        {
            continue;
        }
        ++Grounded;

        const float Compression = 1.0f - FMath::Clamp(Hit.Distance / MaxTravel, 0.0f, 1.0f);
        const FVector VelocityHere = Hull->GetPhysicsLinearVelocityAtPoint(Start);

        const float SpringForce = QuarterMass * (Compression * SpringAccel
            - FVector::DotProduct(VelocityHere, Up) * DamperCoeff);
        Hull->AddForceAtLocation(Up * SpringForce, Start);

        // Sideways grip. Without this the car is a sledge.
        const float Lateral = FVector::DotProduct(VelocityHere, Right);
        Hull->AddForceAtLocation(-Right * (Lateral * QuarterMass * GripCoeff), Start);
    }

    return Grounded;
}

void ACurbsideRoadVehicle::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (!Hull || !Spec || !Hull->IsSimulatingPhysics())
    {
        return;
    }

    GroundedWheels = ApplySuspension();

    const FVector Forward = GetActorForwardVector();
    const FVector Velocity = Hull->GetPhysicsLinearVelocity();
    const float ForwardMps = CurbsideUnits::UUToMeters(FVector::DotProduct(Velocity, Forward));

    if (GroundedWheels > 0)
    {
        // Engine. Cut it at the spec top speed, but only in the direction you
        // are already going, so you can always brake out of an overspeed.
        const bool bOverSpeed = FMath::Abs(ForwardMps) >= Spec->MaxSpeedMps
            && FMath::Sign(ThrottleInput) == FMath::Sign(ForwardMps);
        if (!bOverSpeed && !FMath::IsNearlyZero(ThrottleInput))
        {
            Hull->AddForce(Forward * (ThrottleInput * Spec->AccelScale * 9.0f), NAME_None, /*bAccelChange=*/true);
        }

        // Steering tightens at low speed and calms down at motorway speeds, and
        // needs way on: a stationary car cannot turn, it can only spin.
        const float SpeedFactor = 1.0f / (1.0f + FMath::Abs(ForwardMps) * 0.055f);
        const float Way = FMath::Min(1.0f, FMath::Abs(ForwardMps) / 2.5f);
        const float Direction = ForwardMps < 0.0f ? -1.0f : 1.0f;
        Hull->AddTorqueInRadians(
            FVector::UpVector * (SteerInput * SteerRate * SpeedFactor * Way * Direction),
            NAME_None, true);

        if (!FMath::IsNearlyZero(BrakeInput))
        {
            Hull->AddForce(-Forward * (Direction * BrakeInput * Spec->BrakeScale * 30.0f), NAME_None, true);
        }

        Hull->SetAngularDamping(3.0f);
    }
    else
    {
        // Airborne off a kerb. Damp the tumble so it lands on its wheels.
        Hull->SetAngularDamping(1.2f);
    }

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

float ACurbsideRoadVehicle::GetSpeedKph() const
{
    if (Hull == nullptr)
    {
        return 0.0f;
    }
    return CurbsideUnits::MpsToKph(
        CurbsideUnits::UUToMeters(Hull->GetPhysicsLinearVelocity().Size()));
}

FTransform ACurbsideRoadVehicle::GetExitTransform_Implementation() const
{
    // Out of the driver's door, not into the bodywork.
    const FVector Side = -GetActorRightVector() * (LocalExtent.Y + 90.0f);
    const FVector Location = GetActorLocation() + Side + FVector(0.0f, 0.0f, 60.0f);
    return FTransform(FRotator(0.0f, GetActorRotation().Yaw, 0.0f), Location);
}

bool ACurbsideRoadVehicle::CanBeEntered_Implementation() const
{
    return true;
}
