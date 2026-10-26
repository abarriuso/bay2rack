"""The gallery pictures of the site: each ready-made build in its own case and its own setting.

One shared language (the same 4:3 frame, a 50-85 mm lens on the rack front, AgX, PLA with layer lines) and one
look per build: a desk at night, a blue homelab shelf, a workbench, a macro, a warm living room, a backlit gaming
case in haze, a white product shot, late sun.

Input: docs/blender/gallery/<k>.glb (+ .json), exported from the web viewer in dev mode (see export-glb.js):
  await __b2r.exportBuild('gallery/router', { ...__b2r.EXAMPLES.router, case_model: 'definexlr2' }, { filament })

Run (Blender 5.2):
  blender -b -P scripts/blender/gallery.py -- router [kvm ...] [--samples 256] [--preview]
writes docs/blender/gallery/<k>.png; then  python scripts/blender/gallery_encode.py  makes docs/gallery/.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, "docs", "blender", "gallery")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = "--preview" in ARGS
SAMPLES = int(ARGS[ARGS.index("--samples") + 1]) if "--samples" in ARGS else (24 if PREVIEW else 192)
NAMES = [a for i, a in enumerate(ARGS) if not a.startswith("--") and (i == 0 or ARGS[i - 1] != "--samples")]


def srgb(h):
    """#rrggbb -> linear RGB."""
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# per build: the setting, the camera (azimuth from the front, elevation, lens, f-stop, how much of the frame
# the rack fills), the lights and the floor. Angles in degrees; the rack front faces -Y.
LOOKS = {
    "router": dict(world=("#0b0d12", 0.6), floor="wood_dark", az=-28, el=12, lens=70, fstop=2.8, fill=0.62,
                   lights=[("key", -1.0, -0.9, 0.7, 0.5, 40, "#ffe4c8"), ("rim", 0.9, 0.9, 0.6, 0.6, 160, "#6d8cff"),
                           ("fill", 1.2, -1.0, 0.3, 1.2, 14, "#c9d6ff")]),
    "network": dict(world=("#05080f", 0.4), floor="slate", az=24, el=8, lens=60, fstop=4, fill=0.66,
                    lights=[("key", 1.1, -1.0, 0.8, 0.8, 70, "#d8e6ff"), ("rim", -0.8, 0.9, 0.9, 1.6, 260, "#2f7bff"),
                            ("top", 0.0, 0.1, 1.4, 1.2, 25, "#8fd0ff")]),
    "pi": dict(world=("#d9dbd6", 0.8), floor="mat", az=-20, el=20, lens=60, fstop=5.6, fill=0.7,
               lights=[("sky", -0.4, -0.3, 1.8, 2.4, 220, "#fff6ea"), ("fill", 1.4, -1.2, 0.5, 1.6, 40, "#eef4ff")]),
    "kvm": dict(world=("#121316", 0.5), floor="slate", az=-32, el=7, lens=85, fstop=2.8, fill=0.72,
                lights=[("key", -1.0, -1.2, 0.5, 1.2, 110, "#fff1df"), ("rim", 1.0, 0.8, 0.6, 0.5, 140, "#bcd2ff")]),
    "audio": dict(world=("#1a120c", 0.6), floor="wood_warm", az=30, el=10, lens=65, fstop=2.8, fill=0.6,
                  lights=[("lamp", 1.1, -0.8, 0.7, 0.4, 55, "#ffc48a"), ("window", -1.4, -0.4, 0.9, 1.8, 70, "#cfe0ff"),
                          ("rim", -0.5, 1.0, 0.8, 0.8, 40, "#ffd2a0")]),
    "client": dict(world=("#070708", 0.3), floor="slate", az=-22, el=10, lens=60, fstop=3.2, fill=0.62, haze=0.25,
                   lights=[("back", 0.4, 1.6, 0.9, 1.0, 220, "#ff4a3d"), ("key", -1.1, -1.0, 0.6, 0.8, 60, "#e8eeff"),
                           ("kick", 1.2, 0.2, 0.2, 0.4, 90, "#ff7a45")]),
    "unifi": dict(world=("#f4f5f2", 1.0), floor="seamless", az=20, el=14, lens=75, fstop=8, fill=0.62,
                  lights=[("soft", -0.8, -1.2, 1.2, 2.6, 260, "#ffffff"), ("fill", 1.2, -0.8, 0.6, 2.4, 120, "#ffffff"),
                          ("top", 0.0, 0.3, 1.8, 2.0, 90, "#ffffff")]),
    "bezel": dict(world=("#2a2420", 0.5), floor="concrete", az=-30, el=9, lens=70, fstop=4, fill=0.62,
                  sun=(8, 30, 3.5, "#ffb070"), lights=[("fill", 1.2, -1.0, 0.5, 1.6, 30, "#a8c4ff")]),
}


# ------------------------------------------------------------------ scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    return sc


def import_build(k):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, k + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    with open(os.path.join(SRC, k + ".json"), encoding="utf-8") as f:
        info = json.load(f)
    bpy.context.view_layer.update()
    return new, info


def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def under(objs, names):
    """The meshes below the glTF nodes of these names (the rack: adapter, modules, fillers, screws)."""
    out = set()
    for o in objs:
        p = o
        while p:
            if p.name.split(".")[0] in names or p.name.split(".")[0].startswith("module"):
                out.add(o)
                break
            p = p.parent
    return [o for o in out if o.type == "MESH"]


# ------------------------------------------------------------------ materials
def principled(mat):
    if not mat or not mat.use_nodes:
        return None
    return next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)


def set_input(b, names, value):
    for n in names:
        if n in b.inputs:
            b.inputs[n].default_value = value
            return


def layer_lines(mat, b, strength=0.05):
    """FDM layer lines: 0.2 mm layers, the parts are printed front-down (along Y). Object space is mm."""
    nt = mat.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation, mul.inputs[1].default_value = "MULTIPLY", 5.0
    tri = nt.nodes.new("ShaderNodeMath")
    tri.operation, tri.inputs[1].default_value = "PINGPONG", 0.5
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], mul.inputs[0])
    nt.links.new(mul.outputs[0], tri.inputs[0])
    nt.links.new(tri.outputs[0], bump.inputs["Height"])
    if b.inputs["Normal"].is_linked:
        nt.links.new(b.inputs["Normal"].links[0].from_socket, bump.inputs["Normal"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])


def bevel(mat, b, radius=0.0005):
    """Rounded edges in the shading (radius in metres): CAD meshes have knife edges no real part has."""
    nt = mat.node_tree
    bv = nt.nodes.new("ShaderNodeBevel")
    bv.samples = 6
    bv.inputs["Radius"].default_value = radius
    if b.inputs["Normal"].is_linked:
        nt.links.new(b.inputs["Normal"].links[0].from_socket, bv.inputs["Normal"])
    nt.links.new(bv.outputs["Normal"], b.inputs["Normal"])


def dress_materials():
    for mat in bpy.data.materials:
        b = principled(mat)
        if not b:
            continue
        if not mat.name.startswith(("led", "glass", "mesh", "grille")):
            bevel(mat, b)
        n = mat.name.split(".")[0]
        if n.startswith("print"):
            set_input(b, ["Roughness"], 0.5)
            set_input(b, ["Specular IOR Level"], 0.4)
            set_input(b, ["Coat Weight"], 0.04)
            layer_lines(mat, b)
        elif n == "led":
            set_input(b, ["Emission Strength"], 14.0)
        elif n in ("steel", "zinc", "brass", "gold"):
            set_input(b, ["Roughness"], 0.25)
        elif n == "glass":
            set_input(b, ["Transmission Weight", "Transmission"], 1.0)
            set_input(b, ["Roughness"], 0.03)
            set_input(b, ["Alpha"], 1.0)
        elif n == "case_body":
            set_input(b, ["Coat Weight"], 0.1)


# ------------------------------------------------------------------ set
def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def floor_material(kind):
    m = bpy.data.materials.new("floor_" + kind)
    m.use_nodes = True
    nt = m.node_tree
    b = principled(m)
    tc = node(nt, "ShaderNodeTexCoord")
    if kind.startswith("wood"):
        dark = kind == "wood_dark"
        a, c = (srgb("#2a1a10"), srgb("#3d2616")) if dark else (srgb("#6b3f22"), srgb("#8a5530"))
        mp = node(nt, "ShaderNodeMapping", Scale=(1.5, 14, 1))
        wave = node(nt, "ShaderNodeTexWave", Scale=3.0, Distortion=6.0, Detail=4.0)
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*a, 1)
        ramp.color_ramp.elements[1].color = (*c, 1)
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs[0], wave.inputs["Vector"])
        nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
        set_input(b, ["Roughness"], 0.32 if dark else 0.4)
        set_input(b, ["Coat Weight"], 0.3 if dark else 0.15)
    elif kind == "mat":
        # a green self-healing cutting mat with a 10 mm grid
        mp = node(nt, "ShaderNodeMapping", Scale=(100, 100, 1))
        brick = node(nt, "ShaderNodeTexBrick", Color1=(*srgb("#1f5b48"), 1), Color2=(*srgb("#1f5b48"), 1),
                     Mortar=(*srgb("#8fc7b0"), 1), Scale=1.0, **{"Mortar Size": 0.012, "Brick Width": 1.0, "Row Height": 1.0})
        brick.offset = 0.0
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs[0], brick.inputs["Vector"])
        nt.links.new(brick.outputs["Color"], b.inputs["Base Color"])
        set_input(b, ["Roughness"], 0.75)
    elif kind == "seamless":
        set_input(b, ["Base Color"], (*srgb("#eeeeea"), 1))
        set_input(b, ["Roughness"], 0.9)
    else:
        base = {"slate": "#16181c", "concrete": "#6e6a64"}[kind]
        noise = node(nt, "ShaderNodeTexNoise", Scale=40.0 if kind == "slate" else 18.0, Detail=8.0)
        rng = node(nt, "ShaderNodeMapRange", **{"To Min": 0.35, "To Max": 0.6})
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        nt.links.new(noise.outputs["Fac"], rng.inputs["Value"])
        nt.links.new(rng.outputs["Result"], b.inputs["Roughness"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.inputs["A"].default_value = (*srgb(base), 1)
        mix.inputs["B"].default_value = (*[x * 0.75 for x in srgb(base)], 1)
        nt.links.new(noise.outputs["Fac"], mix.inputs["Factor"])
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    return m


def floor_and_backdrop(kind, z, centre):
    """A floor under the case and, for the seamless product shot, a curved sweep behind it."""
    bpy.ops.mesh.primitive_plane_add(size=12, location=(centre.x, centre.y, z))
    f = bpy.context.object
    f.data.materials.append(floor_material(kind))
    if kind == "seamless":
        bpy.ops.mesh.primitive_cylinder_add(radius=1.2, depth=12, location=(centre.x, centre.y + 1.4, z + 1.2),
                                            rotation=(0, math.pi / 2, 0))
        bpy.context.object.data.materials.append(f.data.materials[0])


def world(colour, strength, haze=0.0):
    w = bpy.data.worlds.new("world")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*srgb(colour), 1)
    bg.inputs["Strength"].default_value = strength
    if haze:
        vol = w.node_tree.nodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Density"].default_value = haze * 0.05
        w.node_tree.links.new(vol.outputs[0], w.node_tree.nodes["World Output"].inputs["Volume"])


def area(name, loc, target, size, power, colour):
    light = bpy.data.lights.new(name, "AREA")
    light.energy, light.color, light.shape = power, srgb(colour), "RECTANGLE"
    light.size, light.size_y = size, size * 0.7
    o = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def sun(az, el, strength, colour):
    light = bpy.data.lights.new("sun", "SUN")
    light.energy, light.color, light.angle = strength, srgb(colour), math.radians(1.5)
    o = bpy.data.objects.new("sun", light)
    bpy.context.scene.collection.objects.link(o)
    d = Vector((math.sin(math.radians(az)), -math.cos(math.radians(az)), math.tan(math.radians(el))))
    o.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()


def camera(look, rack_lo, rack_hi):
    """On the rack front, from look['az'] / look['el'], far enough that the rack is look['fill'] of the frame height."""
    sc = bpy.context.scene
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    c = cam.data
    c.lens, c.sensor_width = look["lens"], 36
    aim = (rack_lo + rack_hi) / 2
    aim.y = rack_lo.y                                        # the front face
    h = max(rack_hi.z - rack_lo.z, (rack_hi.x - rack_lo.x) * 0.75)
    vfov = 2 * math.atan(36 * 0.75 / 2 / c.lens)
    dist = h / look["fill"] / 2 / math.tan(vfov / 2)
    az, el = math.radians(look["az"]), math.radians(look["el"])
    cam.location = aim + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist
    cam.rotation_euler = (aim - cam.location).to_track_quat("-Z", "Y").to_euler()
    c.dof.use_dof = True
    c.dof.aperture_fstop = look["fstop"]
    c.dof.focus_distance = (aim - cam.location).length
    return aim, dist


def render_settings(sc):
    r = sc.render
    r.resolution_x, r.resolution_y = (800, 600) if PREVIEW else (1800, 1350)
    r.resolution_percentage = 100
    r.image_settings.file_format, r.image_settings.color_mode = "PNG", "RGB"
    sc.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            sc.view_settings.look = look
            break
        except TypeError:
            pass
    r.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "HIP"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "HIP"
    sc.cycles.device = "GPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.015
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 8
    sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False


def shoot(k):
    look = LOOKS[k]
    sc = reset()
    objs, info = import_build(k)
    dress_materials()
    lo, hi = bounds(objs)
    rack = under(objs, {"adapter", "filler", "hardware", "bezel0", "bezel1"}) or objs
    rlo, rhi = bounds(rack)
    aim, dist = camera(look, rlo, rhi)
    floor_and_backdrop(look["floor"], lo.z, (lo + hi) / 2)
    world(*look["world"], look.get("haze", 0))
    for name, x, y, z, size, power, colour in look["lights"]:
        area(name, aim + Vector((x, y, z)) * max(dist, 0.6), aim, size * max(dist, 0.6), power * max(dist, 0.6) ** 2, colour)
    if "sun" in look:
        sun(*look["sun"])
    render_settings(sc)
    sc.render.filepath = os.path.join(SRC, k + ("-preview" if PREVIEW else "") + ".png")
    bpy.ops.render.render(write_still=True)
    print("wrote", sc.render.filepath, "case", info["values"].get("case_model"))


for k in NAMES or LOOKS:
    shoot(k)
