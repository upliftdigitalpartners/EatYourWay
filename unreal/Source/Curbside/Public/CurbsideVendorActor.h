// Curbside — a food vendor placed in the world.
//
// Vendors are authored as DataTable rows in metres relative to the level's
// georeference origin, and spawned by UCurbsideVendorSpawner at BeginPlay.
// That keeps one source of truth shared with the web build, and means moving
// the Cesium georeference moves every vendor with it.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CurbsideTypes.h"
#include "CurbsideVendorActor.generated.h"

class USphereComponent;
class UStaticMeshComponent;

UCLASS()
class CURBSIDE_API ACurbsideVendorActor : public AActor
{
    GENERATED_BODY()

public:
    ACurbsideVendorActor();

    /** Populated at spawn from the DataTable. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FCurbsideVendorRow Row;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<USceneComponent> Root;

    /** Proximity volume; entering it is what enables the order prompt. */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<USphereComponent> InteractSphere;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UStaticMeshComponent> StallMesh;

    /** Overhead pin, so a vendor is findable from a helicopter. */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UStaticMeshComponent> PinMesh;

    /** Interaction radius, metres. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    float InteractRangeMeters = 9.0f;

    /** Hidden vendors reveal at this range, metres. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Curbside")
    float DiscoverRangeMeters = 60.0f;

    /** Apply a row and configure visibility for hidden vendors. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void InitialiseFromRow(const FCurbsideVendorRow& InRow);

    /** Reveal a hidden vendor. Called by the character on approach. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void Reveal();

    UFUNCTION(BlueprintPure, Category = "Curbside")
    bool IsRevealed() const { return bRevealed; }

    /** Blueprint hook for opening the order UI. */
    UFUNCTION(BlueprintImplementableEvent, Category = "Curbside")
    void OnVendorRevealed();

private:
    bool bRevealed = true;
};

/**
 * Reads the vendor DataTable and spawns an actor per row at BeginPlay.
 *
 * Positions are metres east/south of GeoreferenceOrigin. With Cesium, put a
 * CesiumGeoreference at the Queens origin (see unreal/README.md) and leave
 * GeoreferenceOrigin at the identity, since Cesium already makes that point
 * the level's origin.
 */
UCLASS(Blueprintable)
class CURBSIDE_API ACurbsideVendorSpawner : public AActor
{
    GENERATED_BODY()

public:
    ACurbsideVendorSpawner();

    virtual void BeginPlay() override;

    /** DataTable built from unreal/Data/DT_Vendors.json (row: FCurbsideVendorRow). */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UDataTable> VendorTable;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    TSubclassOf<ACurbsideVendorActor> VendorClass;

    /** World transform that vendor offsets are measured from. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FTransform GeoreferenceOrigin = FTransform::Identity;

    /** Drop each vendor onto whatever is beneath it. With streamed Cesium
     *  terrain the ground may not be loaded yet, so this retries. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    bool bSnapToGround = true;

    UFUNCTION(BlueprintCallable, Category = "Curbside")
    void SpawnVendors();

    UFUNCTION(BlueprintPure, Category = "Curbside")
    const TArray<ACurbsideVendorActor*>& GetSpawned() const { return Spawned; }

private:
    UPROPERTY()
    TArray<TObjectPtr<ACurbsideVendorActor>> SpawnedStorage;

    UPROPERTY()
    TArray<ACurbsideVendorActor*> Spawned;

    /** Cesium streams terrain in, so a ground trace at BeginPlay often misses.
     *  Retry the ones that failed until they land or we give up. */
    void RetrySnapToGround();

    FTimerHandle SnapTimer;
    int32 SnapAttempts = 0;
};
