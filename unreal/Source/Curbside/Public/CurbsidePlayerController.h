// Curbside — the player controller, and with it the touch controls.
//
// The pawns already read Enhanced Input actions (IA_Move, IA_Throttle and so
// on), and they should not have to care whether those came from a keyboard or
// a thumb. So this does not talk to the pawns at all: it reads the touchscreen
// and *injects* values for the same input actions. Every pawn keeps working
// unchanged, and a pawn written later gets touch support for free as long as
// it binds the usual actions.
//
// The actions are loaded by path rather than assigned in a Blueprint. There is
// no Blueprint subclass to keep in sync that way, and setup_curbside.py already
// creates them all at fixed paths.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "CurbsideTouchLayout.h"
#include "CurbsidePlayerController.generated.h"

class UInputAction;
class UEnhancedInputLocalPlayerSubsystem;

/** One finger, and what it grabbed when it landed. */
struct FCurbsideFinger
{
    ECurbsideTouchGrab Grab = ECurbsideTouchGrab::None;
    FVector2D Position = FVector2D::ZeroVector;
    FVector2D Previous = FVector2D::ZeroVector;
    bool bDown = false;
};

UCLASS()
class CURBSIDE_API ACurbsidePlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    ACurbsidePlayerController();

    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;
    virtual void PlayerTick(float DeltaSeconds) override;

    /**
     * Whether to show and honour the on-screen controls.
     *
     * On by default on a phone, off on a desktop. `curbside.Touch 1` forces
     * them on anywhere, which is how you test them on the Mac without
     * packaging first — with "Use Mouse for Touch" on, the mouse drives them.
     */
    UFUNCTION(BlueprintPure, Category = "Curbside|Touch")
    bool UseTouchControls() const;

    /** -1..1 on each axis, deadzoned. Y is forward. */
    UFUNCTION(BlueprintPure, Category = "Curbside|Touch")
    FVector2D GetTouchStickAxis() const { return StickAxis; }

    /** Where to draw the thumb, as an offset from the stick centre in pixels. */
    FVector2D GetTouchStickOffset() const { return StickOffset; }

    bool IsTouchHeld(ECurbsideTouchGrab Button) const;

    /** Where the controls are this frame. Also what the HUD draws. */
    FCurbsideTouchLayout GetTouchLayout() const;

    UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Curbside|Touch")
    float LookSensitivity = 0.22f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Curbside|Touch")
    float StickDeadzone = 0.14f;

    /** Folder holding IA_Move and friends. Only change this if you moved them. */
    UPROPERTY(EditDefaultsOnly, Category = "Curbside|Touch")
    FString InputActionFolder = TEXT("/Game/Curbside/Input");

protected:
    void HandleTouchPressed(ETouchIndex::Type Finger, FVector Location);
    void HandleTouchMoved(ETouchIndex::Type Finger, FVector Location);
    void HandleTouchReleased(ETouchIndex::Type Finger, FVector Location);

private:
    void LoadInputActions();
    void InjectTouchInput();
    void Inject(UInputAction* Action, const struct FInputActionValue& Value);
    UEnhancedInputLocalPlayerSubsystem* GetEnhancedInput() const;

    static constexpr int32 MaxFingers = 8;
    FCurbsideFinger Fingers[MaxFingers];

    FVector2D StickAxis = FVector2D::ZeroVector;
    FVector2D StickOffset = FVector2D::ZeroVector;
    FVector2D LookDelta = FVector2D::ZeroVector;

    // Resolved once at BeginPlay. Any of them may legitimately be null — a
    // project that never made IA_Lift simply has no lift to inject.
    UPROPERTY() TObjectPtr<UInputAction> MoveAction;
    UPROPERTY() TObjectPtr<UInputAction> LookAction;
    UPROPERTY() TObjectPtr<UInputAction> CyclicAction;
    UPROPERTY() TObjectPtr<UInputAction> ThrottleAction;
    UPROPERTY() TObjectPtr<UInputAction> SteerAction;
    UPROPERTY() TObjectPtr<UInputAction> LiftAction;
    UPROPERTY() TObjectPtr<UInputAction> JumpAction;
    UPROPERTY() TObjectPtr<UInputAction> BrakeAction;
    UPROPERTY() TObjectPtr<UInputAction> SprintAction;
    UPROPERTY() TObjectPtr<UInputAction> InteractAction;
    UPROPERTY() TObjectPtr<UInputAction> ExitAction;
};
