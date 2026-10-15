"""Product shots of one printed part for the README, lit like the film.

The STL must be exported in mounting orientation (print_orientation=false), in mm:
  openscad -o docs/blender/v2/adapter.stl -D 'part="adapter"' -D print_orientation=false -D bays=3 src/bay2rack.scad
  blender -b -P scripts/blender/product.py -- docs/blender/v2/adapter.stl docs/img/adapter-v2
writes <out>-back.png (the sleeve: tab grooves, ribs, lips) and <out>-front.png.
"""
import os
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:]
STL, OUT = os.path.abspath(ARGS[0]), os.path.abspath(ARGS[1])
SAMPLES = int(ARGS[2]) if len(ARGS) > 2 else 128


def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def area(name, loc, target, size, power, color=(1, 1, 1), size_y=None):
    light = bpy.data.lights.new(name, "AREA")
    light.energy, light.color, light.shape = power, color, "RECTANGLE"
    light.size, light.size_y = size, size_y or size
    o = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def pla(color):
    """Matte PLA with 0.2 mm layer lines; the part is printed front-down, so the layers stack along Y."""
    m = bpy.data.materials.new("pla")
    m.use_nodes = True
    nt = m.node_tree
    b = principled(m)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = 0.52
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation, mul.inputs[1].default_value = "MULTIPLY", 1 / 0.2
    tri = nt.nodes.new("ShaderNodeMath")
    tri.operation, tri.inputs[1].default_value = "PINGPONG", 0.5
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], mul.inputs[0])
    nt.links.new(mul.outputs[0], tri.inputs[0])
    nt.links.new(tri.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    bpy.ops.wm.stl_import(filepath=STL)
    part = bpy.context.selected_objects[0]
    part.scale = (0.001, 0.001, 0.001)
    bpy.context.view_layer.update()
    pts = [part.matrix_world @ Vector(c) for c in part.bound_box]
    mn, mx = Vector(map(min, *pts)), Vector(map(max, *pts))
    part.location -= Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))       # centred, standing on the floor
    part.data.materials.append(pla((0.5, 0.51, 0.53)))
    bpy.ops.object.shade_auto_smooth() if hasattr(bpy.ops.object, "shade_auto_smooth") else None
    h = mx.z - mn.z

    world = bpy.data.worlds.new("studio")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0035, 0.004, 0.0052, 1)
    bpy.ops.mesh.primitive_plane_add(size=20)
    floor = bpy.context.object
    fm = bpy.data.materials.new("floor")
    fm.use_nodes = True
    principled(fm).inputs["Base Color"].default_value = (0.004, 0.0045, 0.0055, 1)
    principled(fm).inputs["Roughness"].default_value = 0.34
    floor.data.materials.append(fm)

    c = (0, 0.02, h / 2)
    area("key", (-0.55, -0.6, 0.75), c, 0.6, 14, (1.0, 0.95, 0.88), 0.4)
    area("fill", (0.7, -0.5, 0.25), c, 0.9, 2.5, (0.9, 0.95, 1.0))
    area("rim", (0.45, 0.7, 0.5), c, 0.9, 22, (0.55, 0.72, 1.0), 0.15)
    area("top", (0.05, 0.1, 0.9), c, 0.6, 5, (1, 1, 1), 0.3)

    cd = bpy.data.cameras.new("cam")
    cd.lens, cd.sensor_width = 70, 36
    cd.dof.use_dof, cd.dof.aperture_fstop = True, 5.6
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    aim = bpy.data.objects.new("aim", None)
    sc.collection.objects.link(aim)
    track = cam.constraints.new("TRACK_TO")
    track.target, track.track_axis, track.up_axis = aim, "TRACK_NEGATIVE_Z", "UP_Y"
    cd.dof.focus_object = aim

    r = sc.render
    r.engine = "CYCLES"
    r.resolution_x, r.resolution_y = 1400, 1000
    r.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.exposure = -0.3
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            sc.view_settings.look = look
            break
        except TypeError:
            pass
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "HIP"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "HIP"
    sc.cycles.device = "GPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True

    # the sleeve from behind (tab grooves, inner ribs, lips, fillets into the posts), then the front
    for name, eye, look in (("back", (0.3, 0.36, h + 0.13), (0, 0.035, h * 0.45)),
                            ("front", (-0.26, -0.34, h + 0.08), (0, 0.0, h * 0.5))):
        cam.location, aim.location = eye, look
        r.filepath = f"{OUT}-{name}.png"
        bpy.ops.render.render(write_still=True)


main()
