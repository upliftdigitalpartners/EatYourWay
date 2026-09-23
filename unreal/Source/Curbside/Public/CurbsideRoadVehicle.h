// Curbside — a driveable car that needs no art.
//
// ACurbsideWheeledVehicle is the Chaos one, and it is the better car: real
// suspension, real tyre model. It also needs a skeletal mesh with wheel bones
// and a physics asset, which is art, and there is none yet.
//
// This is the other one. A static mesh hull on four raycast springs, ported
// from src/vehicles/controller.ts where the handling was tuned against Rapier's
// DynamicRayCastVehicleController. It drives with a cube for a body, so the
// city is driveable today. The two are interchangeable behind ICurbsideDriveable
// and share the same UCurbsideVehicleSpec, so swapping one for the other later
// changes which class gets placed and nothing else.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "CurbsideDriveable.h"
#include "CurbsideVehicleSpec.h"
#include "CurbsideRoadVehicle.generated.h"

class UCameraComponent;
class UCurbsideRunComponent;
class UInputAction;
class UInputMappingContext;
class USpringArmComponent;
class UStaticMeshComponent;
struct FInputActionValue;

UCLASS()
class CURBSIDE_API ACurbsideRoadVehicle : public APawn, public ICurbsideDriveable
{
    GENERATED_BODY()

public:
    ACurbsideRoadVehicle();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void NotifyControllerChanged() override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UCurbsideVehicleSpec> Spec;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UStaticMeshComponent> Hull;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<USpringArmComponent> SpringArm;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UCameraComponent> ChaseCamera;

    // ---- suspension ---------------------------------------------------------
    // Defaults are the web build's, converted to centimetres.

    /** Ride height the springs hold, in metres. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Curbside|Suspension")
    float SuspensionRestMeters = 0.36f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Curbside|Suspension")
    float WheelRadiusMeters = 0.34f;

    /** Spring stiffness as an acceleration, cm/s². Two gravities rests at half travel. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Curbside|Suspension")
    float SpringAccel = 2200.0f;

    /** Vertical damping, 1/s. Too low and the car pogos; too high and it locks. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Curbside|Suspension")
    float DamperCoeff = 3.5f;

    /** Sideways grip, 1/s. This is what stops the car sliding through corners. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Curbside|Handling")
    float GripCoeff = 6.0f;

    /** Peak yaw rate, radians/s, before the speed falloff below. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Curbside|Handling")
    float SteerRate = 1.6f;

    /** Called when the player asks to get out. Bind the exit in Blueprint. */
    UFUNCTION(BlueprintImplementableEvent, Category = "Curbside")
    void OnRequestExit();

    UFUNCTION(BlueprintPure, Category = "Curbside")
    float GetSpeedKph() const;

    /** True while at least one wheel is on something. */
    UFUNCTION(BlueprintPure, Category = "Curbside")
    bool IsGrounded() const { return GroundedWheels > 0; }

    virtual UCurbsideVehicleSpec* GetVehicleSpec_Implementation() const override { return Spec.Get(); }
    virtual FTransform GetExitTransform_Implementation() const override;
    virtual bool CanBeEntered_Implementation() const override;

protected:
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputMappingContext> DrivingContext;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> ThrottleAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> SteerAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> BrakeAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> ExitAction;

private:
    void HandleThrottle(const FInputActionValue& Value);
    void HandleSteer(const FInputActionValue& Value);
    void HandleBrake(const FInputActionValue& Value);
    void HandleExit(const FInputActionValue& Value);

    UCurbsideRunComponent* FindRunComponent() const;

    /** Four spring traces. Returns how many found ground. */
    int32 ApplySuspension();

    float ThrottleInput = 0.0f;
    float SteerInput = 0.0f;
    float BrakeInput = 0.0f;

    int32 GroundedWheels = 0;

    /** Half-extents of the hull in its own space, cached once the mesh is set. */
    FVector LocalExtent = FVector(230.0f, 92.0f, 72.0f);

    FVector LastLocation = FVector::ZeroVector;
    bool bHasLastLocation = false;
};
