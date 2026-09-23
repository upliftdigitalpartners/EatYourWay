#include "CurbsideHUD.h"

#include "CurbsideRunComponent.h"
#include "CurbsideVendorActor.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"

namespace
{
    FString Clock(float SecondsLeft)
    {
        const int32 Whole = FMath::Max(0, FMath::CeilToInt(SecondsLeft));
        return FString::Printf(TEXT("%d:%02d"), Whole / 60, Whole % 60);
    }
}

ACurbsideHUD::ACurbsideHUD()
{
    PrimaryActorTick.bCanEverTick = false;
}

void ACurbsideHUD::BeginPlay()
{
    Super::BeginPlay();
    FindRun();  // binds on first success
}

UCurbsideRunComponent* ACurbsideHUD::FindRun() const
{
    const APlayerController* PC = GetOwningPlayerController();
    if (PC == nullptr || PC->PlayerState == nullptr)
    {
        return nullptr;
    }

    UCurbsideRunComponent* Run = PC->PlayerState->FindComponentByClass<UCurbsideRunComponent>();
    if (Run == nullptr)
    {
        return nullptr;
    }

    // The PlayerState arrives a frame or two after the HUD, so binding has to
    // happen the first time it is actually there rather than in BeginPlay.
    if (!bBound)
    {
        ACurbsideHUD* Self = const_cast<ACurbsideHUD*>(this);
        Run->OnAte.AddDynamic(Self, &ACurbsideHUD::HandleAte);
        Run->OnDistrictUnlocked.AddDynamic(Self, &ACurbsideHUD::HandleDistrictUnlocked);
        Run->OnRunEnded.AddDynamic(Self, &ACurbsideHUD::HandleRunEnded);
        Self->bBound = true;
    }
    return Run;
}

// ---------------------------------------------------------------- the menu

void ACurbsideHUD::OpenMenu(ACurbsideVendorActor* Vendor)
{
    if (bRunOver || Vendor == nullptr || Vendor->Row.Items.Num() == 0)
    {
        return;
    }
    OpenVendor = Vendor;
    Selected = 0;
}

void ACurbsideHUD::CloseMenu()
{
    OpenVendor = nullptr;
    Selected = 0;
}

void ACurbsideHUD::CycleMenu(int32 Delta)
{
    if (OpenVendor == nullptr)
    {
        return;
    }
    const int32 Count = OpenVendor->Row.Items.Num();
    if (Count > 0)
    {
        Selected = ((Selected + Delta) % Count + Count) % Count;
    }
}

bool ACurbsideHUD::ConfirmOrder()
{
    UCurbsideRunComponent* Run = FindRun();
    if (Run == nullptr || OpenVendor == nullptr)
    {
        return false;
    }
    if (!OpenVendor->Row.Items.IsValidIndex(Selected))
    {
        return false;
    }

    const FCurbsideMenuItem& Item = OpenVendor->Row.Items[Selected];
    int32 Gained = 0;
    const ECurbsideOrderResult Outcome = Run->Order(OpenVendor->Row, Item, Gained);

    switch (Outcome)
    {
    case ECurbsideOrderResult::Ok:
        // HandleAte draws the toast; it knows the combo state and this does not.
        CloseMenu();
        return true;

    case ECurbsideOrderResult::TooExpensive:
        ShowToast(FString::Printf(TEXT("Not enough cash for %s ($%d)"), *Item.Name, Item.Price));
        return false;

    case ECurbsideOrderResult::Closed:
        ShowToast(FString::Printf(TEXT("%s is closed right now"), *OpenVendor->Row.DisplayName));
        CloseMenu();
        return false;
    }
    return false;
}

void ACurbsideHUD::ShowToast(const FString& Message, float Seconds)
{
    Toast = Message;
    ToastUntil = GetWorld() ? GetWorld()->GetTimeSeconds() + Seconds : 0.0f;
}

void ACurbsideHUD::HandleAte(const FCurbsideMenuItem& Item, int32 FlavorGained, bool bComboLeveled)
{
    FString Line = FString::Printf(TEXT("%s  +%d flavour"), *Item.Name, FlavorGained);
    if (Item.bGem)
    {
        Line += TEXT("   HIDDEN GEM");
    }
    if (bComboLeveled)
    {
        Line += TEXT("   COMBO UP");
    }
    ShowToast(Line);
}

void ACurbsideHUD::HandleDistrictUnlocked(const FString& District)
{
    ShowToast(FString::Printf(TEXT("%s unlocked"), *District), 3.0f);
}

void ACurbsideHUD::HandleRunEnded(const FCurbsideRunResult& InResult)
{
    Result = InResult;
    bRunOver = true;
    CloseMenu();
}

// ---------------------------------------------------------------- drawing

void ACurbsideHUD::DrawBar(float X, float Y, float W, float H, float Fraction, const FLinearColor& Fill)
{
    DrawRect(FLinearColor(0.0f, 0.0f, 0.0f, 0.55f), X, Y, W, H);
    DrawRect(Fill, X, Y, W * FMath::Clamp(Fraction, 0.0f, 1.0f), H);
}

void ACurbsideHUD::DrawHUD()
{
    Super::DrawHUD();

    if (Canvas == nullptr)
    {
        return;
    }

    // One scale factor for everything, so the HUD is readable on a phone and
    // not enormous on a desktop.
    const float S = FMath::Clamp(Canvas->SizeY / 720.0f, 0.75f, 3.0f);

    if (bRunOver)
    {
        DrawSummary(S);
        return;
    }

    UCurbsideRunComponent* Run = FindRun();
    if (Run == nullptr)
    {
        return;
    }

    DrawStats(Run, S);
    DrawMenu(Run, S);
    DrawPrompt(S);
    DrawToast(S);
}

void ACurbsideHUD::DrawStats(UCurbsideRunComponent* Run, float S)
{
    UFont* Font = GEngine ? GEngine->GetMediumFont() : nullptr;

    const float Pad = 14.0f * S;
    const float W = 300.0f * S;
    const float H = 118.0f * S;
    const float Line = 22.0f * S;

    DrawRect(PanelColour, Pad, Pad, W, H);

    float Y = Pad + 8.0f * S;
    const float X = Pad + 12.0f * S;

    DrawText(FString::Printf(TEXT("$%d"), Run->Cash), AccentColour, X, Y, Font, S, false);
    const float Left = FMath::Max(0.0f, Run->RunDurationSeconds - Run->Elapsed);
    DrawText(FString::Printf(TEXT("%s left"), *Clock(Left)),
             TextColour, X + 150.0f * S, Y, Font, S, false);
    Y += Line;

    DrawText(TEXT("hunger"), TextColour, X, Y, Font, S * 0.8f, false);
    DrawBar(X + 70.0f * S, Y + 3.0f * S, 200.0f * S, 10.0f * S,
            Run->Hunger / 100.0f, FLinearColor(0.35f, 0.78f, 0.35f, 1.0f));
    Y += Line;

    DrawText(TEXT("coma"), TextColour, X, Y, Font, S * 0.8f, false);
    DrawBar(X + 70.0f * S, Y + 3.0f * S, 200.0f * S, 10.0f * S,
            Run->Coma / 100.0f, FLinearColor(0.85f, 0.32f, 0.28f, 1.0f));
    Y += Line;

    DrawText(FString::Printf(TEXT("flavour %d    x%.2f    %d cuisine(s)    %d district(s)"),
                             FMath::RoundToInt(Run->Flavor),
                             Run->GetFlavorMultiplier(),
                             Run->GetComboCount(),
                             Run->GetDistrictCount()),
             TextColour, X, Y, Font, S * 0.8f, false);
}

void ACurbsideHUD::DrawPrompt(float S)
{
    if (OpenVendor != nullptr)
    {
        return;  // the menu is its own prompt
    }

    // The character owns what is in range; it pushes the text over by opening
    // the menu, so all that is left here is the standing hint.
    UFont* Font = GEngine ? GEngine->GetMediumFont() : nullptr;
    const FString Hint = TEXT("F  order / get in        A D  browse        S  leave menu");

    const float Y = Canvas->SizeY - 46.0f * S;
    DrawRect(PanelColour, Canvas->SizeX * 0.5f - 230.0f * S, Y - 6.0f * S, 460.0f * S, 28.0f * S);
    DrawText(Hint, TextColour, Canvas->SizeX * 0.5f - 218.0f * S, Y, Font, S * 0.8f, false);
}

void ACurbsideHUD::DrawMenu(UCurbsideRunComponent* Run, float S)
{
    if (OpenVendor == nullptr)
    {
        return;
    }

    UFont* Font = GEngine ? GEngine->GetMediumFont() : nullptr;
    const TArray<FCurbsideMenuItem>& Items = OpenVendor->Row.Items;

    const float Row = 26.0f * S;
    const float W = 460.0f * S;
    const float H = (Items.Num() + 3) * Row;
    const float X = Canvas->SizeX * 0.5f - W * 0.5f;
    const float Y = Canvas->SizeY * 0.5f - H * 0.5f;

    DrawRect(PanelColour, X, Y, W, H);

    float LineY = Y + 10.0f * S;
    DrawText(OpenVendor->Row.DisplayName, AccentColour, X + 14.0f * S, LineY, Font, S, false);
    LineY += Row * 1.4f;

    for (int32 i = 0; i < Items.Num(); ++i)
    {
        const FCurbsideMenuItem& Item = Items[i];
        const bool bAffordable = Item.Price <= Run->Cash;
        const bool bHighlighted = (i == Selected);

        if (bHighlighted)
        {
            DrawRect(FLinearColor(1.0f, 1.0f, 1.0f, 0.10f), X + 8.0f * S, LineY - 3.0f * S,
                     W - 16.0f * S, Row);
        }

        FLinearColor Colour = bAffordable ? TextColour : FLinearColor(0.55f, 0.5f, 0.48f, 1.0f);
        if (bHighlighted && bAffordable)
        {
            Colour = AccentColour;
        }

        const FString Left = FString::Printf(TEXT("%s%s"),
                                             bHighlighted ? TEXT("> ") : TEXT("  "), *Item.Name);
        const FString Right = FString::Printf(TEXT("$%d   %+d hunger   %+d coma   %d flavour"),
                                              Item.Price, Item.Hunger, Item.Coma, Item.Flavor);

        DrawText(Left, Colour, X + 14.0f * S, LineY, Font, S * 0.85f, false);
        DrawText(Right, Colour, X + 190.0f * S, LineY, Font, S * 0.7f, false);
        LineY += Row;
    }

    LineY += Row * 0.3f;
    DrawText(TEXT("A D  browse      F  buy      S  leave"),
             FLinearColor(0.7f, 0.68f, 0.65f, 1.0f), X + 14.0f * S, LineY, Font, S * 0.7f, false);
}

void ACurbsideHUD::DrawToast(float S)
{
    if (Toast.IsEmpty() || GetWorld() == nullptr || GetWorld()->GetTimeSeconds() > ToastUntil)
    {
        return;
    }

    UFont* Font = GEngine ? GEngine->GetMediumFont() : nullptr;
    const float Y = Canvas->SizeY * 0.28f;
    const float W = 520.0f * S;

    DrawRect(PanelColour, Canvas->SizeX * 0.5f - W * 0.5f, Y - 8.0f * S, W, 32.0f * S);
    DrawText(Toast, AccentColour, Canvas->SizeX * 0.5f - W * 0.5f + 16.0f * S, Y, Font, S * 0.9f, false);
}

void ACurbsideHUD::DrawSummary(float S)
{
    UFont* Font = GEngine ? GEngine->GetMediumFont() : nullptr;

    const float W = 480.0f * S;
    const float H = 250.0f * S;
    const float X = Canvas->SizeX * 0.5f - W * 0.5f;
    const float Y = Canvas->SizeY * 0.5f - H * 0.5f;
    const float Row = 26.0f * S;

    DrawRect(FLinearColor(0.02f, 0.02f, 0.03f, 0.92f), X, Y, W, H);

    float LineY = Y + 16.0f * S;
    DrawText(TEXT("RUN OVER"), AccentColour, X + 18.0f * S, LineY, Font, S * 1.2f, false);
    LineY += Row * 1.6f;

    const FString Rank = UCurbsideRunComponent::ComputeRank(
        Result.Flavor, Result.ComboMax, Result.DistrictsVisited.Num());

    const TArray<FString> Lines = {
        FString::Printf(TEXT("rank        %s"), *Rank),
        FString::Printf(TEXT("flavour     %d"), Result.Flavor),
        FString::Printf(TEXT("bites       %d"), Result.Bites),
        FString::Printf(TEXT("gems        %d"), Result.Gems),
        FString::Printf(TEXT("spent       $%d"), Result.Spent),
        FString::Printf(TEXT("cuisines    %d"), Result.ComboMax),
        FString::Printf(TEXT("districts   %d"), Result.DistrictsVisited.Num()),
    };
    for (const FString& Line : Lines)
    {
        DrawText(Line, TextColour, X + 18.0f * S, LineY, Font, S * 0.9f, false);
        LineY += Row;
    }
}
