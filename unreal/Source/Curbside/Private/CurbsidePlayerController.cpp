#include "CurbsidePlayerController.h"

#include "Components/InputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/LocalPlayer.h"
#include "HAL/IConsoleManager.h"
#include "InputAction.h"
#include "InputActionValue.h"

namespace
{
    /** Force the on-screen controls on (or off) regardless of platform. */
    int32 GCurbsideTouch = -1;
    FAutoConsoleVariableRef CVarCurbsideTouch(
        TEXT("curbside.Touch"),
        GCurbsideTouch,
        TEXT("On-screen controls: -1 automatic (on for phones), 0 off, 1 on."),
        ECVF_Default);
}

ACurbsidePlayerController::ACurbsidePlayerController()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ACurbsidePlayerController::BeginPlay()
{
    Super::BeginPlay();

    LoadInputActions();

    if (UseTouchControls())
    {
        // A phone has no cursor to show, and the touch stack has to be awake
        // before BindTouch sees anything.
        bShowMouseCursor = false;
        bEnableTouchEvents = true;
        bEnableTouchOverEvents = true;
    }
}

// ------------------------------------------------------------------ actions

void ACurbsidePlayerController::LoadInputActions()
{
    // LoadObject rather than a hard reference: a project that has not run
    // setup_curbside.py yet should start with no touch controls, not refuse to
    // launch. Warnings are suppressed because a missing action is expected.
    auto Find = [this](const TCHAR* Name) -> UInputAction*
    {
        const FString Path = FString::Printf(TEXT("%s/%s.%s"), *InputActionFolder, Name, Name);
        return LoadObject<UInputAction>(nullptr, *Path, nullptr, LOAD_NoWarn | LOAD_Quiet);
    };

    MoveAction     = Find(TEXT("IA_Move"));
    LookAction     = Find(TEXT("IA_Look"));
    CyclicAction   = Find(TEXT("IA_Cyclic"));
    ThrottleAction = Find(TEXT("IA_Throttle"));
    SteerAction    = Find(TEXT("IA_Steer"));
    LiftAction     = Find(TEXT("IA_Lift"));
    JumpAction     = Find(TEXT("IA_Jump"));
    BrakeAction    = Find(TEXT("IA_Brake"));
    SprintAction   = Find(TEXT("IA_Sprint"));
    InteractAction = Find(TEXT("IA_Interact"));
    ExitAction     = Find(TEXT("IA_Exit"));
}

UEnhancedInputLocalPlayerSubsystem* ACurbsidePlayerController::GetEnhancedInput() const
{
    return ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer());
}

bool ACurbsidePlayerController::UseTouchControls() const
{
    if (GCurbsideTouch >= 0)
    {
        return GCurbsideTouch > 0;
    }
    return FPlatformMisc::GetUseVirtualJoysticks();
}

// -------------------------------------------------------------------- touch

void ACurbsidePlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();

    if (InputComponent == nullptr)
    {
        return;
    }

    // Raw touch, not Enhanced Input: we are the thing turning touches into
    // input actions, so we have to sit underneath it.
    InputComponent->BindTouch(IE_Pressed,  this, &ACurbsidePlayerController::HandleTouchPressed);
    InputComponent->BindTouch(IE_Repeat,   this, &ACurbsidePlayerController::HandleTouchMoved);
    InputComponent->BindTouch(IE_Released, this, &ACurbsidePlayerController::HandleTouchReleased);
}

void ACurbsidePlayerController::HandleTouchPressed(ETouchIndex::Type Finger, FVector Location)
{
    const int32 Index = static_cast<int32>(Finger);
    if (Index < 0 || Index >= MaxFingers || !UseTouchControls())
    {
        return;
    }

    const FVector2D P(Location.X, Location.Y);
    FCurbsideFinger& F = Fingers[Index];
    F.bDown = true;
    F.Position = P;
    F.Previous = P;
    F.Grab = GetTouchLayout().GrabAt(P);
}

void ACurbsidePlayerController::HandleTouchMoved(ETouchIndex::Type Finger, FVector Location)
{
    const int32 Index = static_cast<int32>(Finger);
    if (Index < 0 || Index >= MaxFingers)
    {
        return;
    }

    FCurbsideFinger& F = Fingers[Index];
    if (!F.bDown)
    {
        return;
    }

    const FVector2D P(Location.X, Location.Y);
    if (F.Grab == ECurbsideTouchGrab::Look)
    {
        // Accumulated here rather than measured in Tick: touch moves arrive as
        // events, and several can land between two frames.
        LookDelta += P - F.Position;
    }
    F.Previous = F.Position;
    F.Position = P;
}

void ACurbsidePlayerController::HandleTouchReleased(ETouchIndex::Type Finger, FVector Location)
{
    const int32 Index = static_cast<int32>(Finger);
    if (Index < 0 || Index >= MaxFingers)
    {
        return;
    }
    Fingers[Index] = FCurbsideFinger();
}

FCurbsideTouchLayout ACurbsidePlayerController::GetTouchLayout() const
{
    int32 SizeX = 0;
    int32 SizeY = 0;
    const_cast<ACurbsidePlayerController*>(this)->GetViewportSize(SizeX, SizeY);
    return FCurbsideTouchLayout::Build(static_cast<float>(SizeX), static_cast<float>(SizeY));
}

bool ACurbsidePlayerController::IsTouchHeld(ECurbsideTouchGrab Button) const
{
    for (int32 i = 0; i < MaxFingers; ++i)
    {
        if (Fingers[i].bDown && Fingers[i].Grab == Button)
        {
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------- injection

void ACurbsidePlayerController::PlayerTick(float DeltaSeconds)
{
    // Before Super, so the values are already queued when Super processes the
    // input stack this frame rather than the next one.
    if (UseTouchControls())
    {
        InjectTouchInput();
    }
    Super::PlayerTick(DeltaSeconds);
}

void ACurbsidePlayerController::Inject(UInputAction* Action, const FInputActionValue& Value)
{
    if (Action == nullptr)
    {
        return;
    }
    UEnhancedInputLocalPlayerSubsystem* Input = GetEnhancedInput();
    if (Input == nullptr)
    {
        return;
    }

    static const TArray<UInputModifier*> NoModifiers;
    static const TArray<UInputTrigger*> NoTriggers;
    Input->InjectInputForAction(Action, Value, NoModifiers, NoTriggers);
}

void ACurbsidePlayerController::InjectTouchInput()
{
    const FCurbsideTouchLayout L = GetTouchLayout();

    // ---- stick ----
    StickOffset = FVector2D::ZeroVector;
    for (int32 i = 0; i < MaxFingers; ++i)
    {
        if (Fingers[i].bDown && Fingers[i].Grab == ECurbsideTouchGrab::Stick)
        {
            StickOffset = Fingers[i].Position - L.StickCentre;
            break;
        }
    }
    if (StickOffset.Size() > L.StickRadius)
    {
        StickOffset = StickOffset.GetSafeNormal() * L.StickRadius;
    }

    FVector2D Axis = (L.StickRadius > 0.0f) ? StickOffset / L.StickRadius : FVector2D::ZeroVector;
    Axis.Y = -Axis.Y;  // screen Y grows downward; forward is up

    const float Magnitude = static_cast<float>(Axis.Size());
    if (Magnitude < StickDeadzone)
    {
        Axis = FVector2D::ZeroVector;
    }
    else
    {
        // Rescale past the deadzone so the first responsive pixel is still a
        // small input, instead of jumping straight to the deadzone value.
        const float Scaled = FMath::Min((Magnitude - StickDeadzone) / (1.0f - StickDeadzone), 1.0f);
        Axis = Axis.GetSafeNormal() * Scaled;
    }
    StickAxis = Axis;

    // ---- buttons ----
    const bool bAction = IsTouchHeld(ECurbsideTouchGrab::Action);
    const bool bJump   = IsTouchHeld(ECurbsideTouchGrab::Jump);
    const bool bBrake  = IsTouchHeld(ECurbsideTouchGrab::Brake);
    const bool bExit   = IsTouchHeld(ECurbsideTouchGrab::Exit);

    // ---- inject ----
    // Everything goes out every frame, to whichever actions exist. A pawn only
    // hears the actions it binds, so the car never sees IA_Move and the
    // character never sees IA_Throttle; there is nothing to switch between.
    Inject(MoveAction, FInputActionValue(Axis));
    Inject(CyclicAction, FInputActionValue(Axis));
    Inject(SteerAction, FInputActionValue(static_cast<float>(Axis.X)));
    Inject(ThrottleAction, FInputActionValue(static_cast<float>(Axis.Y)));

    Inject(LookAction, FInputActionValue(LookDelta * LookSensitivity));
    LookDelta = FVector2D::ZeroVector;

    Inject(InteractAction, FInputActionValue(bAction));
    Inject(JumpAction, FInputActionValue(bJump));
    Inject(BrakeAction, FInputActionValue(bBrake));
    Inject(ExitAction, FInputActionValue(bExit));

    // One button, three jobs, and only ever one of them bound at a time: on
    // foot it sprints, in a vehicle it brakes, in the air it descends. Same for
    // the button above it — jump, or climb.
    Inject(SprintAction, FInputActionValue(bBrake));
    Inject(LiftAction, FInputActionValue((bJump ? 1.0f : 0.0f) - (bBrake ? 1.0f : 0.0f)));
}
