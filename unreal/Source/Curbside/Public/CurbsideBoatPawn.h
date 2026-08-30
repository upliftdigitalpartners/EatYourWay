// Curbside — boats.
//
// Buoyancy is sampled at four points on the hull rather than one, so the boat
// pitches and rolls with the surface instead of bobbing like a point mass.
// Strong lateral drag is what makes a hull carve a turn instead of sliding.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "CurbsideDriveable.h"
#include "CurbsideVehicleSpec.h"
#include "CurbsideBoatPawn.generated.h"

class UStaticMeshComponent;
class USpringArmComponent;
class UCameraComponent;
class UInputAction;
class UInputMappingContext;
class UCurbsideRunComponent;
struct FInputActionValue;

UCLASS()
class CURBSIDE_API ACurbsideBoatPawn : public APawn, public ICurbsideDriveable
{
    GENERATED_BODY()

public:
    ACurbsideBoatPawn();

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

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputMappingContext> BoatContext;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> ThrottleAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> SteerAction;

    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Input")
    TObjectPtr<UInputAction> ExitAction;

    UFUNCTION(BlueprintImplementableEvent, Category = "Curbside")
    void OnRequestExit();

    UFUNCTION(BlueprintPure, Category = "Curbside")
    bool IsInWater() const { return bInWater; }


    // ---- ICurbsideDriveable ----
    virtual UCurbsideVehicleSpec* GetVehicleSpec_Implementation() const override { return Spec.Get(); }
    virtual FTransform GetExitTransform_Implementation() const override;
    virtual bool CanBeEntered_Implementation() const override;

protected:
    void HandleThrottle(const FInputActionValue& Value);
    void HandleSteer(const FInputActionValue& Value);
    void HandleExit(const FInputActionValue& Value);

private:
    float ThrottleInput = 0.0f;
    float SteerInput = 0.0f;
    bool bInWater = false;

    FVector LastLocation = FVector::ZeroVector;
    bool bHasLastLocation = false;

    UCurbsideRunComponent* FindRunComponent() const;
};
