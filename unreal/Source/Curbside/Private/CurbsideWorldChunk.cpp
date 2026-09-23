#include "CurbsideWorldChunk.h"

#include "Components/InstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"

ACurbsideWorldChunk::ACurbsideWorldChunk()
{
    PrimaryActorTick.bCanEverTick = false;

    Instances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("Instances"));
    SetRootComponent(Instances);

    // Nothing in the city moves, and static mobility is what lets the renderer
    // batch and cull it. It also means the vendor spawner's ground trace has
    // something solid to land on.
    Instances->SetMobility(EComponentMobility::Static);
    // Profile first: setting a profile resets the enabled flag, so the other
    // order would quietly leave the city non-solid.
    Instances->SetCollisionProfileName(TEXT("BlockAll"));
    Instances->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    Instances->SetCastShadow(true);
}

int32 ACurbsideWorldChunk::Rebuild(UStaticMesh* Mesh, UMaterialInterface* Material, const TArray<FTransform>& Transforms)
{
    if (Instances == nullptr)
    {
        return 0;
    }

    Modify();
    Instances->Modify();

    Instances->ClearInstances();

    if (Mesh != nullptr)
    {
        Instances->SetStaticMesh(Mesh);
    }
    if (Material != nullptr)
    {
        Instances->SetMaterial(0, Material);
    }

    if (Transforms.Num() > 0)
    {
        // Transforms arrive in the chunk's local space, which is the level
        // origin — the exporter already baked world positions.
        Instances->AddInstances(Transforms, /*bShouldReturnIndices=*/false, /*bWorldSpace=*/false);
    }

    Instances->MarkRenderStateDirty();

    return Instances->GetInstanceCount();
}
