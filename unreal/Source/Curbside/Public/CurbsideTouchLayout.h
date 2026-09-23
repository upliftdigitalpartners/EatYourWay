// Curbside — where the on-screen controls sit.
//
// Two things need these numbers and they must agree exactly: the player
// controller, which decides what a finger grabbed, and the HUD, which draws
// what the finger is aiming at. A control drawn a few pixels from where it is
// actually hit-tested feels broken in a way that is very hard to diagnose, so
// both read the layout from here rather than each working it out.
//
// Everything is in canvas pixels, computed from the viewport size, so it
// adapts from a phone to a tablet to a desktop window without a second set of
// numbers.

#pragma once

#include "CoreMinimal.h"

/** Which on-screen control a finger is holding. */
enum class ECurbsideTouchGrab : uint8
{
    None,
    Stick,
    Look,
    Action,   // order / get in / confirm
    Jump,     // jump on foot, climb in an aircraft
    Brake,    // brake in a vehicle, descend in an aircraft
    Exit,     // get out
};

struct FCurbsideTouchLayout
{
    FVector2D StickCentre = FVector2D::ZeroVector;
    float StickRadius = 0.0f;

    FVector2D Action = FVector2D::ZeroVector;
    FVector2D Jump = FVector2D::ZeroVector;
    FVector2D Brake = FVector2D::ZeroVector;
    FVector2D Exit = FVector2D::ZeroVector;
    float ButtonRadius = 0.0f;

    /** A touch starting right of this, and not on a button, turns the camera. */
    float LookZoneLeft = 0.0f;

    static FCurbsideTouchLayout Build(float SizeX, float SizeY)
    {
        FCurbsideTouchLayout L;

        // Sized off the short edge so the controls stay thumb-sized whether the
        // phone is a small one or a tablet, and are never a silly size on a
        // very wide window.
        const float Short = FMath::Min(SizeX, SizeY);

        L.StickRadius = FMath::Clamp(Short * 0.16f, 54.0f, 190.0f);
        L.ButtonRadius = FMath::Clamp(Short * 0.078f, 28.0f, 92.0f);

        const float Margin = L.ButtonRadius * 0.85f;
        const float R = L.ButtonRadius;

        L.StickCentre = FVector2D(Margin + L.StickRadius,
                                  SizeY - Margin - L.StickRadius);

        // A diamond rather than a column: the thumb pivots, so the reachable
        // area is an arc, not a line.
        const FVector2D Corner(SizeX - Margin - R, SizeY - Margin - R);
        L.Action = Corner;
        L.Jump  = Corner - FVector2D(0.0f, R * 2.35f);
        L.Brake = Corner - FVector2D(R * 2.35f, 0.0f);
        L.Exit  = Corner - FVector2D(R * 2.0f, R * 2.0f);

        L.LookZoneLeft = SizeX * 0.45f;
        return L;
    }

    /** The button at this point, or None. Buttons win over the look zone. */
    ECurbsideTouchGrab ButtonAt(const FVector2D& P) const
    {
        // A little larger than what is drawn. Fingers are not precise, and a
        // button that needs aiming at is worse than one that is slightly greedy.
        const float Hit = ButtonRadius * 1.15f;
        if (FVector2D::Distance(P, Action) <= Hit) { return ECurbsideTouchGrab::Action; }
        if (FVector2D::Distance(P, Jump)   <= Hit) { return ECurbsideTouchGrab::Jump; }
        if (FVector2D::Distance(P, Brake)  <= Hit) { return ECurbsideTouchGrab::Brake; }
        if (FVector2D::Distance(P, Exit)   <= Hit) { return ECurbsideTouchGrab::Exit; }
        return ECurbsideTouchGrab::None;
    }

    ECurbsideTouchGrab GrabAt(const FVector2D& P) const
    {
        const ECurbsideTouchGrab Button = ButtonAt(P);
        if (Button != ECurbsideTouchGrab::None)
        {
            return Button;
        }
        // The stick zone is generous too, and square, so a thumb landing below
        // or left of the drawn circle still finds it.
        if (P.X <= StickCentre.X + StickRadius * 1.5f &&
            P.Y >= StickCentre.Y - StickRadius * 1.5f)
        {
            return ECurbsideTouchGrab::Stick;
        }
        if (P.X >= LookZoneLeft)
        {
            return ECurbsideTouchGrab::Look;
        }
        return ECurbsideTouchGrab::None;
    }
};
