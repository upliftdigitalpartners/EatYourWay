// Curbside — driveable ground vehicles.
//
// Thin wrapper over Chaos Vehicles: the movement component does the physics,
// this class binds Enhanced Input, applies the spec's speed cap, and reports
// distance travelled to the run.
//
// REQUIRES: the ChaosVehiclesPlugin plugin enabled in your .uproject, and
// "ChaosVehicles" in your module's PublicDependencyModuleNames.

#pragma once

#include "CoreMinimal.h"
#include "WheeledVehiclePawn.h"
#include "CurbsideDriveable.h"
#include "CurbsideVehicleSpec.h"
#include "CurbsideWheeledVehicle.generated.h"

class UInputAction;
class UInputMappingContext;
class UCurbsideRunComponent;
class USpringArmComponent;
class UCameraComponent;
struct FInputActionValue;

UCLASS()
class CURBSIDE_API ACurbsideWheeledVehicle : public AWheeledVehiclePawn, public ICurbsideDriveable
{
    GENERATED_BODY()

public:
    ACurbsideWheeledVehicle();

    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void NotifyControllerChanged() override;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UCurbsideVehicleSpec> Spec;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<USpringArmComponent> SpringArm;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UCameraComponent> ChaseCamera;

    // ---- input assets (create these in the editor and assign) --------------

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputMappingContext> DrivingContext;

    /** Axis1D: forward/back. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> ThrottleAction;

    /** Axis1D: left/right. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> SteerAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> BrakeAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> ExitAction;

    /** Called when the player presses Exit. The GameMode swaps possession. */
    UFUNCTION(BlueprintImplementableEvent, Category = "Curbside")
    void OnRequestExit();


    // ---- ICurbsideDriveable ----
    virtual UCurbsideVehicleSpec* GetVehicleSpec_Implementation() const override { return Spec.Get(); }
    virtual FTransform GetExitTransform_Implementation() const override;
    virtual bool CanBeEntered_Implementation() const override;

protected:
    void HandleThrottle(const FInputActionValue& Value);
    void HandleSteer(const FInputActionValue& Value);
    void HandleBrakeStart(const FInputActionValue& Value);
    void HandleBrakeStop(const FInputActionValue& Value);
    void HandleExit(const FInputActionValue& Value);

private:
    /** Where the pawn was last frame, for the distance log. */
    FVector LastLocation = FVector::ZeroVector;
    bool bHasLastLocation = false;

    UCurbsideRunComponent* FindRunComponent() const;
};
