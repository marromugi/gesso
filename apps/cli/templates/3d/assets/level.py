# Builds the level in Blender and writes it to assets/level.glb (see CLAUDE.md):
#   <Blender> --background --factory-startup --python assets/level.py -- assets/level.glb
# An object with the custom property `collider` ("convex" or "mesh") is solid in the game; one
# whose name ends in "-col" is solid but not drawn.
import math
import sys

import bpy

out = sys.argv[sys.argv.index("--") + 1]

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color):
    made = bpy.data.materials.new(name)
    made.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*color, 1)
    return made


def solid(obj, kind, mat=None):
    obj["collider"] = kind
    if mat:
        obj.data.materials.append(mat)
    return obj


grass = material("grass", (0.25, 0.55, 0.3))
stone = material("stone", (0.55, 0.55, 0.6))
wood = material("wood", (0.6, 0.4, 0.2))

# Blender's z is up; the game's y is up (the export turns it).
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.25))
ground = bpy.context.object
ground.name = "Ground"
ground.scale = (20, 20, 0.5)
solid(ground, "convex", grass)

# A ramp up to a platform.
verts = [(-2, -1.5, 0), (2, -1.5, 0), (2, 1.5, 0), (-2, 1.5, 0), (2, -1.5, 1.5), (2, 1.5, 1.5)]
faces = [(0, 1, 2, 3), (1, 4, 5, 2), (0, 3, 5, 4), (0, 4, 1), (3, 2, 5)]
mesh = bpy.data.meshes.new("Ramp")
mesh.from_pydata(verts, [], faces)
ramp = bpy.data.objects.new("Ramp", mesh)
ramp.location = (4, 0, 0)
bpy.context.collection.objects.link(ramp)
solid(ramp, "convex", stone)

bpy.ops.mesh.primitive_cube_add(size=1, location=(7.5, 0, 0.75))
platform = bpy.context.object
platform.name = "Platform"
platform.scale = (3, 3, 1.5)
solid(platform, "convex", stone)

for i, (x, y) in enumerate([(-3, 3), (-4, -2), (0, -5)]):
    bpy.ops.mesh.primitive_cube_add(size=1.2, location=(x, y, 0.6), rotation=(0, 0, i * 0.5))
    crate = bpy.context.object
    crate.name = f"Crate{i}"
    solid(crate, "convex", wood)

# A ring is concave, so it collides as its own mesh.
bpy.ops.mesh.primitive_torus_add(
    location=(-6, 4, 1.6), rotation=(math.pi / 2, 0, 0), major_radius=1.6, minor_radius=0.35
)
ring = bpy.context.object
ring.name = "Ring"
solid(ring, "mesh", stone)

# A detailed rock collides as a simple box that isn't drawn.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.2, location=(2, 5, 0.8))
rock = bpy.context.object
rock.name = "Rock"
rock.data.materials.append(stone)
bpy.ops.mesh.primitive_cube_add(size=2, location=(2, 5, 0.8))
rock_col = bpy.context.object
rock_col.name = "Rock-col"
solid(rock_col, "convex")

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_extras=True,
    export_apply=True,
    export_yup=True,
)
