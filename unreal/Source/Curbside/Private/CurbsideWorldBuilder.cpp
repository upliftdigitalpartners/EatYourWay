#include "CurbsideWorldBuilder.h"

#include "CurbsideWorldChunk.h"

#include "Components/InstancedStaticMeshComponent.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "EngineUtils.h"

namespace
{
    UWorld* ResolveWorld(UObject* WorldContextObject)
    {
        if (WorldContextObject == nullptr)
        {
            return nullptr;
        }
        if (UWorld* AsWorld = Cast<UWorld>(WorldContextObject))
        {
            return AsWorld;
        }
        if (GEngine != nullptr)
        {
            return GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::ReturnNull);
        }
        return WorldContextObject->GetWorld();
    }

    ACurbsideWorldChunk* FindChunk(UWorld* World, FName Category)
    {
        for (TActorIterator<ACurbsideWorldChunk> It(World); It; ++It)
        {
            if (It->Category == Category)
            {
                return *It;
            }
        }
        return nullptr;
    }
}

ACurbsideWorldChunk* UCurbsideWorldBuilder::SpawnWorldChunk(
    UObject* WorldContextObject,
    FName Category,
    const FString& Label,
    UStaticMesh* Mesh,
    UMaterialInterface* Material,
    const TArray<FTransform>& Transforms)
{
    UWorld* World = ResolveWorld(WorldContextObject);
    if (World == nullptr)
    {
        UE_LOG(LogTemp, Error, TEXT("[Curbside] SpawnWorldChunk: no world."));
        return nullptr;
    }

    ACurbsideWorldChunk* Chunk = FindChunk(World, Category);
    if (Chunk == nullptr)
    {
        FActorSpawnParameters Params;
        Params.ObjectFlags = RF_Transactional;
        Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

        Chunk = World->SpawnActor<ACurbsideWorldChunk>(
            ACurbsideWorldChunk::StaticClass(), FTransform::Identity, Params);
        if (Chunk == nullptr)
        {
            UE_LOG(LogTemp, Error, TEXT("[Curbside] SpawnWorldChunk: spawn failed for %s."), *Category.ToString());
            return nullptr;
        }
        Chunk->Category = Category;
    }

#if WITH_EDITOR
    if (!Label.IsEmpty())
    {
        Chunk->SetActorLabel(Label);
    }
#endif

    const int32 Placed = Chunk->Rebuild(Mesh, Material, Transforms);
    UE_LOG(LogTemp, Log, TEXT("[Curbside] %s: %d instances."), *Category.ToString(), Placed);

    return Chunk;
}

int32 UCurbsideWorldBuilder::DestroyWorldChunks(UObject* WorldContextObject)
{
    UWorld* World = ResolveWorld(WorldContextObject);
    if (World == nullptr)
    {
        return 0;
    }

    TArray<ACurbsideWorldChunk*> Doomed;
    for (TActorIterator<ACurbsideWorldChunk> It(World); It; ++It)
    {
        Doomed.Add(*It);
    }
    for (ACurbsideWorldChunk* Chunk : Doomed)
    {
        World->DestroyActor(Chunk);
    }
    return Doomed.Num();
}

int32 UCurbsideWorldBuilder::CountWorldInstances(UObject* WorldContextObject)
{
    UWorld* World = ResolveWorld(WorldContextObject);
    if (World == nullptr)
    {
        return 0;
    }

    int32 Total = 0;
    for (TActorIterator<ACurbsideWorldChunk> It(World); It; ++It)
    {
        if (It->Instances != nullptr)
        {
            Total += It->Instances->GetInstanceCount();
        }
    }
    return Total;
}
