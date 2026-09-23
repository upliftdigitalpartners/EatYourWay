// Curbside — the player on foot.
//
// Owns the interaction loop: find the nearest vendor or driveable each tick,
// and on the interact key either open an order or take the wheel. Possession
// swapping lives here rather than in the GameMode so a co-op second player
// gets the same behaviour for free.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "CurbsideTypes.h"
#include "CurbsideCharacter.generated.h"

class ACurbsideVendorActor;
class UCameraComponent;
class UCurbsideRunComponent;
class UInputAction;
class UInputMappingContext;
class USpringArmComponent;
struct FInputActionValue;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCurbsideVendorInRange, ACurbsideVendorActor*, Vendor);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCurbsideVehicleInRange, APawn*, Vehicle);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCurbsideOrderRequested, ACurbsideVendorActor*, Vendor);

UCLASS()
class CURBSIDE_API ACurbsideCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    ACurbsideCharacter();

    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void NotifyControllerChanged() override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<USpringArmComponent> SpringArm;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UCameraComponent> FollowCamera;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputMappingContext> OnFootContext;

    /** Axis2D: X = strafe, Y = forward. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> MoveAction;

    /** Axis2D: mouse / right stick look. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> LookAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> JumpAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> SprintAction;

    /** Order at a vendor, or get into a vehicle. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> InteractAction;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    float WalkSpeedMps = 4.2f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    float SprintSpeedMps = 7.4f;

    /** How far to look for something to interact with, metres. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    float InteractScanMeters = 12.0f;

    // ---- prompts: bind these to your HUD ----

    UPROPERTY(BlueprintAssignable, Category = "Curbside")
    FCurbsideVendorInRange OnVendorInRangeChanged;

    UPROPERTY(BlueprintAssignable, Category = "Curbside")
    FCurbsideVehicleInRange OnVehicleInRangeChanged;

    /** Fired when the player interacts with an open vendor. Your UI should
     *  build the order menu from Vendor->Row.Items and call
     *  UCurbsideRunComponent::Order with the chosen item. */
    UPROPERTY(BlueprintAssignable, Category = "Curbside")
    FCurbsideOrderRequested OnOrderRequested;

    UFUNCTION(BlueprintCallable, Category = "Curbside")
    bool EnterVehicle(APawn* Vehicle);

    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void ExitVehicle(APawn* Vehicle);

    /**
     * Get whoever is driving `Vehicle` out of it. Returns false if nobody is.
     *
     * The vehicles cannot reach their driver directly — they share an interface,
     * not a base class, and the controller has moved on to the vehicle. But
     * EnterVehicle attaches the character to the vehicle so it travels with it,
     * so the driver is simply the attached ACurbsideCharacter.
     */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    static bool LeaveVehicle(APawn* Vehicle);

    UFUNCTION(BlueprintPure, Category = "Curbside")
    ACurbsideVendorActor* GetVendorInRange() const { return VendorInRange; }

    UFUNCTION(BlueprintPure, Category = "Curbside")
    APawn* GetVehicleInRange() const { return VehicleInRange; }

protected:
    void HandleMove(const FInputActionValue& Value);
    void HandleLook(const FInputActionValue& Value);
    void HandleSprintStart(const FInputActionValue& Value);
    void HandleSprintStop(const FInputActionValue& Value);
    void HandleInteract(const FInputActionValue& Value);

    /** Refresh VendorInRange / VehicleInRange and reveal hidden vendors. */
    void ScanForInteractables();

private:
    UPROPERTY()
    TObjectPtr<ACurbsideVendorActor> VendorInRange;

    UPROPERTY()
    TObjectPtr<APawn> VehicleInRange;

    FVector LastLocation = FVector::ZeroVector;
    bool bHasLastLocation = false;

    UCurbsideRunComponent* FindRunComponent() const;
};
