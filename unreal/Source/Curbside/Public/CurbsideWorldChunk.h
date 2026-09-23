// Curbside — one instanced-mesh chunk of the city.
//
// The whole of Queens is six of these: buildings, roads, rails, water, parks,
// runways. Each holds an InstancedStaticMeshComponent, so 3,019 buildings cost
// one draw call rather than 3,019 actors.
//
// The transforms are computed in Node by tools/export-unreal-world.mjs and
// handed in from the editor by unreal/Tools/build_world.py. Nothing here
// generates geometry; this exists because Unreal's Python API has no way to add
// a component to an actor, so the component has to come from C++.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CurbsideWorldChunk.generated.h"

class UInstancedStaticMeshComponent;
class UMaterialInterface;
class UStaticMesh;

UCLASS()
class CURBSIDE_API ACurbsideWorldChunk : public AActor
{
    GENERATED_BODY()

public:
    ACurbsideWorldChunk();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Curbside")
    TObjectPtr<UInstancedStaticMeshComponent> Instances;

    /** "buildings", "roads", ... Kept so a rebuild can find and replace its own chunk. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Curbside")
    FName Category;

    /**
     * Replace every instance in this chunk.
     *
     * Returns how many were added, so the caller can report a number it did not
     * have to trust the script for.
     */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    int32 Rebuild(UStaticMesh* Mesh, UMaterialInterface* Material, const TArray<FTransform>& Transforms);
};
