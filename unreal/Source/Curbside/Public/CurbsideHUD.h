// Curbside — the heads-up display and the order menu.
//
// Drawn on a Canvas from C++ rather than built as a UMG widget. UMG would look
// better, but its layout is authored by hand in the widget designer, and this
// needs to exist before anyone can tell whether the game works at all. A Canvas
// HUD is the whole thing in one file, it needs no assets, and it renders the
// same on a phone as on the desktop.
//
// Replacing it with UMG later means pointing the GameMode at a different HUD
// class. Nothing else knows this is here except ACurbsideCharacter, which asks
// it to open and drive the menu.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "CurbsideTypes.h"
#include "CurbsideHUD.generated.h"

class ACurbsideVendorActor;
class UCurbsideRunComponent;

UCLASS()
class CURBSIDE_API ACurbsideHUD : public AHUD
{
    GENERATED_BODY()

public:
    ACurbsideHUD();

    virtual void BeginPlay() override;
    virtual void DrawHUD() override;

    /** Show this vendor's menu. Does nothing if the run is over. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void OpenMenu(ACurbsideVendorActor* Vendor);

    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void CloseMenu();

    /** Move the highlight. Wraps at both ends. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void CycleMenu(int32 Delta);

    /** Buy the highlighted item. Returns true if it was actually bought. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    bool ConfirmOrder();

    UFUNCTION(BlueprintPure, Category = "Curbside")
    bool IsMenuOpen() const { return OpenVendor != nullptr; }

    UFUNCTION(BlueprintPure, Category = "Curbside")
    ACurbsideVendorActor* GetOpenVendor() const { return OpenVendor; }

    /** A line of text at the centre of the screen for a few seconds. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void ShowToast(const FString& Message, float Seconds = 2.5f);

    UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Curbside|Style")
    FLinearColor PanelColour = FLinearColor(0.02f, 0.02f, 0.03f, 0.72f);

    UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Curbside|Style")
    FLinearColor TextColour = FLinearColor(0.96f, 0.95f, 0.92f, 1.0f);

    UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Curbside|Style")
    FLinearColor AccentColour = FLinearColor(1.0f, 0.72f, 0.24f, 1.0f);

private:
    UCurbsideRunComponent* FindRun() const;

    /** The run component the HUD reads, and whose events it listens to. */
    UFUNCTION()
    void HandleAte(const FCurbsideMenuItem& Item, int32 FlavorGained, bool bComboLeveled);

    UFUNCTION()
    void HandleDistrictUnlocked(const FString& District);

    UFUNCTION()
    void HandleRunEnded(const FCurbsideRunResult& Result);

    void DrawStats(UCurbsideRunComponent* Run, float S);
    void DrawPrompt(float S);

    /** The thumbstick and buttons, on a phone. Nothing on a desktop. */
    void DrawTouchControls(float S);
    void DrawMenu(UCurbsideRunComponent* Run, float S);
    void DrawToast(float S);
    void DrawSummary(float S);
    void DrawBar(float X, float Y, float W, float H, float Fraction, const FLinearColor& Fill);

    UPROPERTY()
    TObjectPtr<ACurbsideVendorActor> OpenVendor;

    int32 Selected = 0;

    FString Toast;
    float ToastUntil = 0.0f;

    bool bRunOver = false;
    FCurbsideRunResult Result;

    /** Set once so the HUD does not re-bind every time it looks the run up. */
    bool bBound = false;
};
