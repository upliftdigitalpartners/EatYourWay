#include "CurbsideCharacter.h"

#include "Camera/CameraComponent.h"
#include "CurbsideDriveable.h"
#include "CurbsideHUD.h"
#include "CurbsideRunComponent.h"
#include "CurbsideVendorActor.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/OverlapResult.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"
#include "GameFramework/SpringArmComponent.h"

ACurbsideCharacter::ACurbsideCharacter()
{
    PrimaryActorTick.bCanEverTick = true;

    bUseControllerRotationPitch = false;
    bUseControllerRotationYaw = false;
    bUseControllerRotationRoll = false;

    UCharacterMovementComponent* Move = GetCharacterMovement();
    Move->bOrientRotationToMovement = true;
    Move->RotationRate = FRotator(0.0f, 620.0f, 0.0f);
    Move->MaxWalkSpeed = CurbsideUnits::MpsToUU(4.2f);
    Move->JumpZVelocity = 480.0f;
    Move->AirControl = 0.25f;
    // Kerbs and stoop steps are everywhere in Queens.
    Move->MaxStepHeight = 45.0f;

    SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
    SpringArm->SetupAttachment(RootComponent);
    SpringArm->TargetArmLength = 380.0f;
    SpringArm->SocketOffset = FVector(0.0f, 0.0f, 70.0f);
    SpringArm->bUsePawnControlRotation = true;
    SpringArm->bEnableCameraLag = true;
    SpringArm->CameraLagSpeed = 12.0f;

    FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
    FollowCamera->SetupAttachment(SpringArm);
}

void ACurbsideCharacter::NotifyControllerChanged()
{
    Super::NotifyControllerChanged();

    if (const APlayerController* PC = Cast<APlayerController>(GetController()))
    {
        if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
                ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
        {
            if (OnFootContext)
            {
                Subsystem->AddMappingContext(OnFootContext, 0);
            }
        }
    }
}

void ACurbsideCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
    if (!Input)
    {
        return;
    }

    if (MoveAction)
    {
        Input->BindAction(MoveAction, ETriggerEvent::Triggered, this, &ACurbsideCharacter::HandleMove);
        Input->BindAction(MoveAction, ETriggerEvent::Completed, this, &ACurbsideCharacter::HandleMove);
    }
    if (LookAction)
    {
        Input->BindAction(LookAction, ETriggerEvent::Triggered, this, &ACurbsideCharacter::HandleLook);
    }
    if (JumpAction)
    {
        Input->BindAction(JumpAction, ETriggerEvent::Started, this, &ACharacter::Jump);
        Input->BindAction(JumpAction, ETriggerEvent::Completed, this, &ACharacter::StopJumping);
    }
    if (SprintAction)
    {
        Input->BindAction(SprintAction, ETriggerEvent::Started, this, &ACurbsideCharacter::HandleSprintStart);
        Input->BindAction(SprintAction, ETriggerEvent::Completed, this, &ACurbsideCharacter::HandleSprintStop);
    }
    if (InteractAction)
    {
        Input->BindAction(InteractAction, ETriggerEvent::Started, this, &ACurbsideCharacter::HandleInteract);
    }
}

void ACurbsideCharacter::HandleMove(const FInputActionValue& Value)
{
    const FVector2D Axis = Value.Get<FVector2D>();

    // With a menu up the walk keys drive the menu instead. Reusing them means
    // ordering needs no input actions or mappings of its own.
    if (ACurbsideHUD* HUD = GetCurbsideHUD())
    {
        if (HUD->IsMenuOpen())
        {
            DriveMenu(HUD, Axis);
            return;
        }
    }
    MenuAxis = FVector2D::ZeroVector;

    if (!Controller || Axis.IsNearlyZero())
    {
        return;
    }

    // Move relative to where the camera is looking, flattened to the ground.
    const FRotator YawOnly(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
    const FVector Forward = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::X);
    const FVector Right = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::Y);

    AddMovementInput(Forward, Axis.Y);
    AddMovementInput(Right, Axis.X);
}

void ACurbsideCharacter::HandleLook(const FInputActionValue& Value)
{
    const FVector2D Axis = Value.Get<FVector2D>();
    AddControllerYawInput(Axis.X);
    AddControllerPitchInput(Axis.Y);
}

void ACurbsideCharacter::HandleSprintStart(const FInputActionValue& /*Value*/)
{
    GetCharacterMovement()->MaxWalkSpeed = CurbsideUnits::MpsToUU(SprintSpeedMps);
}

void ACurbsideCharacter::HandleSprintStop(const FInputActionValue& /*Value*/)
{
    GetCharacterMovement()->MaxWalkSpeed = CurbsideUnits::MpsToUU(WalkSpeedMps);
}

void ACurbsideCharacter::HandleInteract(const FInputActionValue& /*Value*/)
{
    ACurbsideHUD* HUD = GetCurbsideHUD();

    // With the menu up, F buys the highlighted item rather than reopening it.
    if (HUD && HUD->IsMenuOpen())
    {
        HUD->ConfirmOrder();
        return;
    }

    // A vendor you are standing at beats a car you are standing next to.
    if (VendorInRange)
    {
        if (HUD)
        {
            HUD->OpenMenu(VendorInRange);
        }
        // Still broadcast, so a Blueprint or UMG menu can replace the HUD's.
        OnOrderRequested.Broadcast(VendorInRange);
        return;
    }
    if (VehicleInRange)
    {
        EnterVehicle(VehicleInRange);
    }
}

ACurbsideHUD* ACurbsideCharacter::GetCurbsideHUD() const
{
    const APlayerController* PC = Cast<APlayerController>(GetController());
    return PC ? Cast<ACurbsideHUD>(PC->GetHUD()) : nullptr;
}

void ACurbsideCharacter::DriveMenu(ACurbsideHUD* HUD, const FVector2D& Axis)
{
    // Edge detection: these are axes, but the menu wants keypresses.
    if (Axis.X > 0.5f && MenuAxis.X <= 0.5f)
    {
        HUD->CycleMenu(1);
    }
    else if (Axis.X < -0.5f && MenuAxis.X >= -0.5f)
    {
        HUD->CycleMenu(-1);
    }

    if (Axis.Y < -0.5f && MenuAxis.Y >= -0.5f)
    {
        HUD->CloseMenu();
    }

    MenuAxis = Axis;
}

bool ACurbsideCharacter::EnterVehicle(APawn* Vehicle)
{
    if (!Vehicle || !Vehicle->Implements<UCurbsideDriveable>())
    {
        return false;
    }
    if (!ICurbsideDriveable::Execute_CanBeEntered(Vehicle))
    {
        return false;
    }

    AController* C = GetController();
    if (!C)
    {
        return false;
    }

    // Park the character inside the vehicle so it travels with it, rather than
    // being left standing in the street where the player got in.
    SetActorEnableCollision(false);
    SetActorHiddenInGame(true);
    GetCharacterMovement()->DisableMovement();
    AttachToActor(Vehicle, FAttachmentTransformRules::SnapToTargetNotIncludingScale);

    C->Possess(Vehicle);
    return true;
}

void ACurbsideCharacter::ExitVehicle(APawn* Vehicle)
{
    AController* C = Vehicle ? Vehicle->GetController() : GetController();
    if (!C)
    {
        return;
    }

    FTransform ExitAt = GetActorTransform();
    if (Vehicle && Vehicle->Implements<UCurbsideDriveable>())
    {
        ExitAt = ICurbsideDriveable::Execute_GetExitTransform(Vehicle);
    }

    DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
    SetActorTransform(ExitAt, /*bSweep=*/false, nullptr, ETeleportType::TeleportPhysics);
    SetActorHiddenInGame(false);
    SetActorEnableCollision(true);
    GetCharacterMovement()->SetMovementMode(MOVE_Walking);

    C->Possess(this);
}

bool ACurbsideCharacter::LeaveVehicle(APawn* Vehicle)
{
    if (Vehicle == nullptr)
    {
        return false;
    }

    TArray<AActor*> Attached;
    Vehicle->GetAttachedActors(Attached);
    for (AActor* Actor : Attached)
    {
        if (ACurbsideCharacter* Driver = Cast<ACurbsideCharacter>(Actor))
        {
            Driver->ExitVehicle(Vehicle);
            return true;
        }
    }
    return false;
}

void ACurbsideCharacter::ScanForInteractables()
{
    ACurbsideVendorActor* BestVendor = nullptr;
    APawn* BestVehicle = nullptr;
    float BestVendorDist = TNumericLimits<float>::Max();
    float BestVehicleDist = TNumericLimits<float>::Max();

    const FVector Origin = GetActorLocation();
    const float ScanUU = CurbsideUnits::MetersToUU(InteractScanMeters);
    // Hidden vendors reveal from much further out than you can order from.
    const float DiscoverUU = CurbsideUnits::MetersToUU(60.0f);
    const float QueryUU = FMath::Max(ScanUU, DiscoverUU);

    TArray<FOverlapResult> Overlaps;
    FCollisionQueryParams Params;
    Params.AddIgnoredActor(this);

    GetWorld()->OverlapMultiByChannel(
        Overlaps, Origin, FQuat::Identity, ECC_Pawn,
        FCollisionShape::MakeSphere(QueryUU), Params);

    UCurbsideRunComponent* Run = FindRunComponent();

    for (const FOverlapResult& Result : Overlaps)
    {
        AActor* Actor = Result.GetActor();
        if (!IsValid(Actor))
        {
            continue;
        }
        const float Dist = FVector::Dist(Origin, Actor->GetActorLocation());

        if (ACurbsideVendorActor* Vendor = Cast<ACurbsideVendorActor>(Actor))
        {
            if (Dist <= CurbsideUnits::MetersToUU(Vendor->DiscoverRangeMeters) && !Vendor->IsRevealed())
            {
                Vendor->Reveal();
                if (Run)
                {
                    Run->Discover(Vendor->Row.VendorId);
                }
            }
            const float OrderUU = CurbsideUnits::MetersToUU(Vendor->InteractRangeMeters);
            if (Vendor->IsRevealed() && Dist <= OrderUU && Dist < BestVendorDist)
            {
                BestVendorDist = Dist;
                BestVendor = Vendor;
            }
            continue;
        }

        if (APawn* AsPawn = Cast<APawn>(Actor))
        {
            if (AsPawn->Implements<UCurbsideDriveable>() && Dist <= ScanUU && Dist < BestVehicleDist)
            {
                BestVehicleDist = Dist;
                BestVehicle = AsPawn;
            }
        }
    }

    if (BestVendor != VendorInRange)
    {
        VendorInRange = BestVendor;
        OnVendorInRangeChanged.Broadcast(VendorInRange);
    }
    if (BestVehicle != VehicleInRange)
    {
        VehicleInRange = BestVehicle;
        OnVehicleInRangeChanged.Broadcast(VehicleInRange);
    }
}

UCurbsideRunComponent* ACurbsideCharacter::FindRunComponent() const
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

void ACurbsideCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    // Only scan while actually on foot; while driving the character is
    // attached to the vehicle and its overlaps are meaningless.
    if (GetController())
    {
        ScanForInteractables();
    }

    const FVector Now = GetActorLocation();
    if (bHasLastLocation && GetController())
    {
        if (UCurbsideRunComponent* Run = FindRunComponent())
        {
            Run->AddDistance(TEXT("foot"), CurbsideUnits::UUToMeters(FVector::Dist2D(Now, LastLocation)));
        }
    }
    LastLocation = Now;
    bHasLastLocation = true;
}
