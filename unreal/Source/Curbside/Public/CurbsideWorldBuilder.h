// Curbside — the entry point the editor script calls to build the city.
//
// Unreal's Python API cannot add a component to an actor, so it cannot make an
// InstancedStaticMeshComponent on its own. It can, however, call a
// BlueprintCallable static function. So the script does the reading and the
// maths, and hands the finished transforms to this.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "CurbsideWorldChunk.h"
#include "CurbsideWorldBuilder.generated.h"

class UMaterialInterface;
class UStaticMesh;

UCLASS()
class CURBSIDE_API UCurbsideWorldBuilder : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    /**
     * Spawn (or reuse) one chunk of the city and fill it with instances.
     *
     * Re-running replaces the chunk of the same Category rather than stacking a
     * second copy on top of the first.
     */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    static ACurbsideWorldChunk* SpawnWorldChunk(
        UObject* WorldContextObject,
        FName Category,
        const FString& Label,
        UStaticMesh* Mesh,
        UMaterialInterface* Material,
        const TArray<FTransform>& Transforms);

    /** Delete every chunk in the world. Returns how many went. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    static int32 DestroyWorldChunks(UObject* WorldContextObject);

    /** Total instances across every chunk — a number the script cannot fake. */
    UFUNCTION(BlueprintCallable, Category = "Curbside")
    static int32 CountWorldInstances(UObject* WorldContextObject);
};
