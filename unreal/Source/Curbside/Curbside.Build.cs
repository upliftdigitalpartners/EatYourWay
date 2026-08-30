// Reference Build.cs.
//
// If you are dropping these files into an existing module, do not copy this
// file: instead merge the dependency lists below into your own Build.cs, and
// keep your module's name.

using UnrealBuildTool;

public class Curbside : ModuleRules
{
    public Curbside(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore",

            // Enhanced Input: all pawns bind through it.
            "EnhancedInput",

            // Chaos Vehicles: required by ACurbsideWheeledVehicle.
            // Also enable the ChaosVehiclesPlugin plugin in your .uproject.
            "ChaosVehicles",

            // Physics forces used by the aircraft and boat pawns.
            "PhysicsCore",
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "Slate",
            "SlateCore",
        });

        // Cesium for Unreal is intentionally NOT a hard dependency. Nothing in
        // this module includes a Cesium header — the georeference is wired up
        // in the level and passed to the vendor spawner as a transform. That
        // keeps the module compiling whether or not the plugin is installed.
    }
}
