// Curbside — helicopters and fixed-wing aircraft.
//
// Chaos has no flight model, so this is a hand-rolled arcade one applying
// forces to a simulating mesh. Same model as the web build:
//   Helicopter — thrust only along the rotor axis, so tilting the airframe is
//                what moves you. Collective climbs, cyclic steers, auto-level
//                keeps it flyable without a stick.
//   Fixed-wing — thrust along the nose, lift proportional to the square of
//                airspeed and gated on a ground roll, so a jet cannot leap off
//                the apron. Control authority scales with airspeed.
//
// Forces use bAccelChange = true, so they are accelerations in cm/s^2 and
// tuning does not change when a vehicle's mass does.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "CurbsideDriveable.h"
#include "CurbsideVehicleSpec.h"
#include "CurbsideAircraftPawn.generated.h"

class UStaticMeshComponent;
class USpringArmComponent;
class UCameraComponent;
class UInputAction;
class UInputMappingContext;
class UCurbsideRunComponent;
struct FInputActionValue;

UCLASS()
class CURBSIDE_API ACurbsideAircraftPawn : public APawn, public ICurbsideDriveable
{
    GENERATED_BODY()

public:
    ACurbsideAircraftPawn();

    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void NotifyControllerChanged() override;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UCurbsideVehicleSpec> Spec;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UStaticMeshComponent> Hull;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<USpringArmComponent> SpringArm;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UCameraComponent> ChaseCamera;

    /** Spins visually while the engine is running; assign a rotor/prop mesh. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Curbside")
    TObjectPtr<USceneComponent> RotorMesh;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputMappingContext> FlightContext;

    /** Axis1D: collective for a helicopter, throttle for a fixed-wing. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> ThrottleAction;

    /** Axis2D: X = roll, Y = pitch. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> CyclicAction;

    /** Axis1D: rudder / tail rotor. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> YawAction;

    /** Axis1D: helicopter collective up/down. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> LiftAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> ExitAction;

    UFUNCTION(BlueprintImplementableEvent, Category = "Curbside")
    void OnRequestExit();

    /** Forward airspeed in m/s, for the HUD. */
    UFUNCTION(BlueprintPure, Category = "Curbside")
    float GetAirspeedMps() const;

    /** Height above the level's ground, in metres. */
    UFUNCTION(BlueprintPure, Category = "Curbside")
    float GetAltitudeMeters() const;


    // ---- ICurbsideDriveable ----
    virtual UCurbsideVehicleSpec* GetVehicleSpec_Implementation() const override { return Spec.Get(); }
    virtual FTransform GetExitTransform_Implementation() const override;
    virtual bool CanBeEntered_Implementation() const override;

protected:
    void HandleThrottle(const FInputActionValue& Value);
    void HandleCyclic(const FInputActionValue& Value);
    void HandleYaw(const FInputActionValue& Value);
    void HandleLift(const FInputActionValue& Value);
    void HandleExit(const FInputActionValue& Value);

    void TickHelicopter(float DeltaSeconds);
    void TickFixedWing(float DeltaSeconds);

    /** Torque the airframe back toward level. */
    void AutoLevel(float Strength);

private:
    float ThrottleInput = 0.0f;
    float PitchInput = 0.0f;
    float RollInput = 0.0f;
    float YawInput = 0.0f;
    float LiftInput = 0.0f;

    /** Ground roll accumulated by a fixed-wing, metres. */
    float GroundRoll = 0.0f;

    FVector LastLocation = FVector::ZeroVector;
    bool bHasLastLocation = false;

    bool IsOnGround() const;
    UCurbsideRunComponent* FindRunComponent() const;
};
