"""bay2rack hero video: a sleeper homelab that unfolds and assembles itself, shot like a commercial.

Input: docs/blender/{router,homelab3,network5,proxmox_pi}.glb (+ .json), exported from the web viewer
in dev mode:  await __b2r.exportBuild('router', __b2r.EXAMPLES.router, { sleeper: true })

Run (Blender 5.2):
  blender -b -P scripts/blender/hero.py -- --still 140            one frame -> docs/blender/still_0140.png
  blender -b -P scripts/blender/hero.py -- --preview               fast 640x360 pass of the whole film
  blender -b -P scripts/blender/hero.py -- --render [--frames A-B] final Cycles frames -> docs/blender/frames/
  add --save to keep docs/blender/hero.blend, --lowres for 960x540

Shot list (30 fps, 510 frames, 17 s):
  1    1-42   macro sweep along the closed beige sleeper; its 5.25in bays are empty
  2   44-180  it unfolds: top, sides and front fly apart, the modern server floats in the open,
              then everything snaps back (the side panel closes last: a sleeper), the adapter and
              the rack modules fly into the bays, the screws spin in and the LEDs come on
  3  182-250  orbit to the back: the cables grow out of the network card and the PCI-slot brackets
  4  252-310  the Proxmox node next to it swaps its 80 mm fan bezel for a 2U Raspberry Pi blade cluster
  5  311-355  cut: a 3-bay homelab in another sleeper, its modules snap in
  6  356-400  cut: a 5-bay network rack in a taller case
  7  401-510  back to the router: wide hero shot, slow push; the last frame is the poster
"""
import json
import os
import random
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, "docs", "blender")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    if name in ARGS:
        i = ARGS.index(name)
        return ARGS[i + 1] if i + 1 < len(ARGS) and not ARGS[i + 1].startswith("--") else True
    return default


FPS = 30
END = 510
SETS = {"router": 0.0, "homelab3": 6.0, "network5": 12.0}     # each build on its own set, 6 m apart
random.seed(7)


# ------------------------------------------------------------------ helpers
def fcurves_of(id_data):
    """F-curves of an ID, for both legacy and layered (Blender 4.4+) actions."""
    ad = id_data.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    try:
        return list(act.fcurves)
    except AttributeError:
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    out.extend(bag.fcurves)
        return out


def key(obj, frame, loc=None, rot=None):
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert("location", frame=frame)
    if rot is not None:
        obj.rotation_euler = rot
        obj.keyframe_insert("rotation_euler", frame=frame)


def base(name):
    return name.split(".")[0]


def descendants(obj):
    out = []
    for c in obj.children:
        out.append(c)
        out.extend(descendants(c))
    return out


def find(root, name):
    for o in descendants(root):
        if base(o.name) == name:
            return o
    return None


# ------------------------------------------------------------------ scene and import
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, END
    sc.unit_settings.system = "METRIC"
    return sc


def import_build(name, x):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    root = next(o for o in new if o.parent is None)
    root.location.x += x
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    with open(os.path.join(SRC, name + ".json"), encoding="utf-8") as f:
        info = json.load(f)
    bpy.context.view_layer.update()
    return root, info


# ------------------------------------------------------------------ materials
def principled(mat):
    if not mat or not mat.use_nodes:
        return None
    return next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)


def set_input(bsdf, names, value):
    for n in names:
        if n in bsdf.inputs:
            bsdf.inputs[n].default_value = value
            return


def add_bump(mat, bsdf, kind, strength):
    """Procedural surface: 'peel' = orange-peel paint, 'grain' = ABS texture, 'layers' = FDM layer lines."""
    nt = mat.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    if kind == "layers":
        # object space of the imported parts is millimetres: 0.2 mm layers, printed front-down (along Y)
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs[0])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = 1 / 0.2
        nt.links.new(sep.outputs["Y"], mul.inputs[0])
        tri = nt.nodes.new("ShaderNodeMath")
        tri.operation = "PINGPONG"
        tri.inputs[1].default_value = 0.5
        nt.links.new(mul.outputs[0], tri.inputs[0])
        nt.links.new(tri.outputs[0], bump.inputs["Height"])
    else:
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 1.2 if kind == "peel" else 4.0
        noise.inputs["Detail"].default_value = 6
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    if bsdf.inputs["Normal"].is_linked:
        nt.links.new(bsdf.inputs["Normal"].links[0].from_socket, bump.inputs["Normal"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def tint_variation(mat, bsdf, color, amount=0.06):
    """Large, slow blotches of yellowing on old beige plastic and paint."""
    nt = mat.node_tree
    for link in list(bsdf.inputs["Base Color"].links):
        nt.links.remove(link)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.012
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*color, 1)
    mix.inputs["B"].default_value = (color[0] * (1 + amount * 0.6), color[1] * (1 + amount * 0.2), color[2] * (1 - amount * 1.6), 1)
    nt.links.new(noise.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])


LED_MATS = []


def dress_materials():
    putty = (0.46, 0.405, 0.30)          # the beige of the painted shell (linear)
    front = (0.5, 0.445, 0.33)           # ABS front, a touch lighter
    prints = (0.43, 0.39, 0.30)          # PLA that matches the case
    for mat in bpy.data.materials:
        b = principled(mat)
        if not b:
            continue
        n = base(mat.name)
        if n == "case_body":
            tint_variation(mat, b, putty, 0.05)
            set_input(b, ["Roughness"], 0.42)
            set_input(b, ["Metallic"], 0.0)
            set_input(b, ["Coat Weight"], 0.15)
            add_bump(mat, b, "peel", 0.08)
        elif n == "case_front":
            tint_variation(mat, b, front, 0.09)
            set_input(b, ["Roughness"], 0.5)
            add_bump(mat, b, "grain", 0.05)
        elif n.startswith("print"):
            for link in list(b.inputs["Base Color"].links):
                mat.node_tree.links.remove(link)
            set_input(b, ["Base Color"], (*prints, 1))
            set_input(b, ["Roughness"], 0.55)
            set_input(b, ["Specular IOR Level"], 0.35)
            add_bump(mat, b, "layers", 0.06)
        elif n == "led":
            set_input(b, ["Emission Strength"], 18.0)
            LED_MATS.append(mat)
        elif n in ("steel", "zinc"):
            set_input(b, ["Roughness"], 0.28)
        elif n == "gold":
            set_input(b, ["Roughness"], 0.22)


# ------------------------------------------------------------------ studio
def studio(sc):
    world = bpy.data.worlds.new("studio")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.0035, 0.004, 0.0052, 1)
    bg.inputs["Strength"].default_value = 1.0
    bpy.ops.mesh.primitive_plane_add(size=80, location=(6, 3, -0.4))
    floor = bpy.context.object
    floor.name = "floor"
    m = bpy.data.materials.new("floor")
    m.use_nodes = True
    b = principled(m)
    b.inputs["Base Color"].default_value = (0.006, 0.0065, 0.008, 1)
    floor.data.materials.append(m)
    nt = m.node_tree
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 35
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["To Min"].default_value = 0.16
    rng.inputs["To Max"].default_value = 0.3
    nt.links.new(noise.outputs["Fac"], rng.inputs["Value"])
    nt.links.new(rng.outputs["Result"], b.inputs["Roughness"])


def area(name, loc, target, size, power, color=(1, 1, 1), size_y=None):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = power
    light.color = color
    light.shape = "RECTANGLE"
    light.size = size
    light.size_y = size_y or size
    o = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def light_set(x, z_floor):
    """Key, fill, a cool rim and a top strip around the set at x."""
    c = (x + 0.15, 0.25, z_floor + 0.35)
    area(f"key_{x}", (x - 1.3, -1.5, z_floor + 1.7), c, 1.4, 240, (1.0, 0.94, 0.86), 0.9)
    area(f"fill_{x}", (x + 1.6, -1.3, z_floor + 0.5), c, 2.2, 40, (0.9, 0.95, 1.0))
    area(f"rim_{x}", (x + 1.3, 1.9, z_floor + 1.3), c, 2.2, 420, (0.55, 0.72, 1.0), 0.25)
    area(f"top_{x}", (x + 0.2, 0.3, z_floor + 2.2), c, 1.6, 70, (1, 1, 1), 0.5)


# ------------------------------------------------------------------ animation tools
def to_local(obj, v):
    """World-space offset -> the object's parent space (the import root scales mm to m)."""
    if obj.parent is None:
        return Vector(v)
    return obj.parent.matrix_world.to_3x3().inverted() @ Vector(v)


def set_keys(obj, keys, back=1.12):
    """keys: [(frame, loc, rot, kind)]; kind 'hold', 'snap' (overshoots into place) or 'move' (smooth)."""
    for f, loc, rot, _ in keys:
        key(obj, f, loc=loc, rot=rot)
    kinds = {f: k for f, _, _, k in keys}
    for fc in fcurves_of(obj):
        if fc.data_path not in ("location", "rotation_euler"):
            continue
        for kp in fc.keyframe_points:
            k = kinds.get(int(round(kp.co.x)), "move")
            kp.interpolation = "BACK" if k == "snap" else "BEZIER" if k == "hold" else "SINE"
            kp.easing = "EASE_OUT" if k == "snap" else "EASE_IN_OUT" if k == "move" else "AUTO"
            if k == "snap":
                kp.back = back


def hide_keys(obj, frames_states):
    for o in [obj] + descendants(obj):
        for f, hidden in frames_states:
            o.hide_render = hidden
            o.keyframe_insert("hide_render", frame=f)


def visible_from(obj, frame):
    """Hidden until `frame`: parts waiting off-set never sneak into a shot."""
    hide_keys(obj, [(1, True), (frame - 1, True), (frame, False)])


def hidden_from(obj, frame):
    hide_keys(obj, [(1, False), (frame - 1, False), (frame, True)])


def away(obj, offset, rot):
    home_l, home_r = obj.location.copy(), obj.rotation_euler.copy()
    return home_l, home_r, home_l + to_local(obj, offset), Euler((home_r.x + rot[0], home_r.y + rot[1], home_r.z + rot[2]))


def fly_in(obj, f_in, f_out, offset, rot=(0, 0, 0), back=1.12, appear=True):
    """Transformer entry: from home + offset (turned by rot) it snaps into place between f_in and f_out."""
    home_l, home_r, away_l, away_r = away(obj, offset, rot)
    set_keys(obj, [(1, away_l, away_r, "hold"), (f_in, away_l, away_r, "snap"), (f_out, home_l, home_r, "hold")], back)
    if appear:
        visible_from(obj, f_in)


def explode(obj, f_out0, f_out1, f_in0, f_in1, offset, rot=(0, 0, 0), back=1.08):
    """Leave home between f_out0 and f_out1, drift while floating, snap back between f_in0 and f_in1."""
    home_l, home_r, away_l, away_r = away(obj, offset, rot)
    drift = away_l + to_local(obj, Vector(offset) * 0.06)
    set_keys(obj, [(1, home_l, home_r, "hold"), (f_out0, home_l, home_r, "move"), (f_out1, away_l, away_r, "move"),
                   (f_in0, drift, away_r, "snap"), (f_in1, home_l, home_r, "hold")], back)


def fly_out(obj, f0, f1, offset, rot=(0, 0, 0)):
    home_l, home_r, away_l, away_r = away(obj, offset, rot)
    set_keys(obj, [(1, home_l, home_r, "hold"), (f0, home_l, home_r, "move"), (f1, away_l, away_r, "hold")])
    hidden_from(obj, f1 + 1)


def leds(frame_off, frame_on):
    for m in LED_MATS:
        s = principled(m).inputs["Emission Strength"]
        full = s.default_value
        s.default_value = 0.0
        s.keyframe_insert("default_value", frame=frame_off)
        s.default_value = full
        s.keyframe_insert("default_value", frame=frame_on)


def grow_cables(root, start, step, dur):
    """Each cable grows along its length (a Build modifier over the tube faces); plugs pop at the end."""
    scene = find(root, "scene")
    if not scene:
        return
    cables = sorted([c for c in scene.children if base(c.name).startswith("cable_")], key=lambda c: base(c.name))
    for i, c in enumerate(cables):
        f0 = start + i * step
        for o in descendants(c):
            if o.type != "MESH":
                continue
            if o.parent == c:
                mod = o.modifiers.new("grow", "BUILD")
                mod.frame_start = f0
                mod.frame_duration = dur
            else:
                hide_keys(o, [(1, True), (f0 + dur - 1, True), (f0 + dur, False)])


def handheld(cam, aim):
    """A camera operator's hands: slow, small noise on the position and on the point it looks at."""
    for o, strength in ((cam, 0.003), (aim, 0.0045)):
        for fc in fcurves_of(o):
            if fc.data_path == "location":
                m = fc.modifiers.new("NOISE")
                m.scale = 40
                m.strength = strength
                m.phase = random.random() * 100


# ------------------------------------------------------------------ camera
def camera(sc):
    cd = bpy.data.cameras.new("cam")
    cd.lens = 40
    cd.sensor_width = 36
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 3.2
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    focus = bpy.data.objects.new("focus", None)
    sc.collection.objects.link(focus)
    cd.dof.focus_object = focus
    aim = bpy.data.objects.new("aim", None)
    sc.collection.objects.link(aim)
    track = cam.constraints.new("TRACK_TO")
    track.target = aim
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    return cam, aim, focus


def shot(cam, aim, focus, frame, eye, look, f=None, lens=None, fstop=None, cut=False):
    """Camera keyframe: eye, look-at point, focus point, lens. cut = jump from the previous key."""
    key(cam, frame, loc=Vector(eye))
    key(aim, frame, loc=Vector(look))
    key(focus, frame, loc=Vector(f or look))
    if lens:
        cam.data.lens = lens
        cam.data.keyframe_insert("lens", frame=frame)
    if fstop:
        cam.data.dof.aperture_fstop = fstop
        cam.data.dof.keyframe_insert("aperture_fstop", frame=frame)
    if cut:
        for o in (cam, aim, focus, cam.data):
            for fc in fcurves_of(o):
                prev = [kp for kp in fc.keyframe_points if kp.co.x < frame - 0.5]
                if prev:
                    max(prev, key=lambda k: k.co.x).interpolation = "CONSTANT"


# ------------------------------------------------------------------ the film
def build_film(sc, builds):
    root, info = builds["router"]
    for name in SETS:
        light_set(SETS[name], (builds[name][1]["scene"]["case"]["z0"] - 8) * 0.001)
    bpy.data.objects["floor"].location.z = (info["scene"]["case"]["z0"] - 8) * 0.001

    cam, aim, focus = camera(sc)
    X = SETS["router"]
    c = info["scene"]["case"]
    D, Z0, Z1 = c["d"] * 0.001, c["z0"] * 0.001, c["z1"] * 0.001
    front_mid = (X, -0.02, (Z0 + Z1) / 2)
    bays = (X, -0.02, 0.09)
    groups = {base(o.name): o for o in descendants(root) if o.type == "EMPTY"}
    case = groups.get("case")

    def part(n):
        return find(case, n) if case else None

    # --- 44-180: the sleeper unfolds, the server floats, everything snaps back, the rack goes in
    shell = {  # name: (offset m, rotation, leaves at, comes back at)
        "top_panel": ((0.0, 0.06, 0.46), (0.3, 0.0, 0.12), 44, 108),
        "side_panel_mb": ((0.52, 0.02, 0.06), (0.0, 0.0, 0.32), 46, 104),
        "front": ((0.0, -0.6, 0.05), (-0.38, 0.0, 0.0), 48, 114),
        "side_panel": ((-0.55, -0.1, 0.08), (0.0, 0.0, -0.5), 50, 122),       # closes last: a sleeper
    }
    for n, (off, rot, o0, b0) in shell.items():
        o = part(n)
        if o:
            explode(o, o0, o0 + 22, b0, b0 + 16, off, rot)
    guts = [("part_cooler", (-0.3, -0.02, 0.2), (0.45, 0.3, 0.0)), ("part_ram", (-0.24, -0.24, 0.24), (0.0, 0.6, 0.45)),
            ("part_board", (-0.13, 0.04, 0.07), (0.0, 0.12, 0.0)), ("part_nic", (-0.32, 0.22, 0.03), (0.0, 0.0, 0.6)),
            ("part_gpu", (-0.32, 0.28, -0.07), (0.0, 0.0, -0.5)), ("part_psu", (-0.26, 0.08, -0.18), (0.25, 0.0, 0.4)),
            ("part_drives", (-0.24, -0.22, -0.14), (0.0, 0.32, -0.3))]
    for i, (n, off, rot) in enumerate(guts):
        o = part(n)
        if o:
            explode(o, 54 + i * 2, 76 + i * 2, 88 + i * 2, 104 + i * 2, off, rot, back=1.04)
    rack = [groups.get(n) for n in ["adapter"] + [f"module{k}" for k in range(len(info["mods"]))] + ["filler"]]
    for i, o in enumerate([o for o in rack if o]):
        twist = (random.uniform(-0.25, 0.25), random.uniform(-0.35, 0.35), random.uniform(-0.45, 0.45))
        fly_in(o, 128 + i * 6, 144 + i * 6, (random.uniform(-0.08, 0.08), -0.75 - i * 0.04, random.uniform(0.0, 0.16)), twist)
    hw = groups.get("hardware")
    if hw:
        fly_in(hw, 160, 170, (0.0, -0.1, 0.0), (0.0, 6.283, 0.0), back=1.0)      # the screws spin in
    leds(166, 178)

    # --- 182-250: the cables grow at the back
    grow_cables(root, 190, 4, 26)

    # --- 252-310: the Proxmox node swaps its fan bezel for a Raspberry Pi blade cluster
    hl = info["scene"]["homelab"]
    px = X + hl["clients"][0][0] * 0.001
    bz = hl["clientBezels"][1][0] * 0.001
    pi_root, _ = builds["proxmox_pi"]
    pi_root.location = (px, 0.0, bz)
    fan_bezel = groups.get("bezel1")
    if fan_bezel:
        fly_out(fan_bezel, 258, 276, (0.06, -0.6, 0.28), (0.7, 0.0, 0.9))
    fly_in(pi_root, 272, 292, (-0.05, -0.55, 0.34), (0.5, 0.25, -0.55))

    # --- 311-400: the other builds, their rack modules snap in
    for name, f0 in (("homelab3", 316), ("network5", 361)):
        r, inf = builds[name]
        g = {base(o.name): o for o in descendants(r) if o.type == "EMPTY"}
        parts = [g.get(n) for n in [f"module{k}" for k in range(len(inf["mods"]))] + ["filler"]]
        for i, o in enumerate([p for p in parts if p]):
            fly_in(o, f0 + i * 4, f0 + 14 + i * 4, (0.0, -0.6, random.uniform(-0.04, 0.1)),
                   (random.uniform(-0.2, 0.2), random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3)))

    # --- camera
    B3, B5 = SETS["homelab3"], SETS["network5"]
    ctl = (X + c["w"] * 0.001 / 2 - 0.021, -0.006, Z1 - 0.07)                                            # turbo display
    shot(cam, aim, focus, 1, (X + 0.3, -0.26, Z1 - 0.02), ctl, ctl, lens=85, fstop=2.0)                   # macro sweep
    shot(cam, aim, focus, 24, (X + 0.16, -0.32, Z1 - 0.06), (X + 0.06, -0.01, Z1 - 0.1), lens=75, fstop=2.0)
    shot(cam, aim, focus, 42, (X - 0.14, -0.44, 0.17), (X, -0.02, 0.06), lens=60, fstop=2.2)
    shot(cam, aim, focus, 70, (X - 0.95, -1.3, 0.6), (X - 0.05, 0.2, 0.0), front_mid, lens=35, fstop=4.5)  # the unfold
    shot(cam, aim, focus, 112, (X - 1.25, -0.8, 0.45), (X - 0.05, 0.25, -0.02), front_mid, lens=35, fstop=4.5)
    shot(cam, aim, focus, 150, (X - 0.62, -1.0, 0.27), bays, bays, lens=45, fstop=3.2)                     # rack goes in
    shot(cam, aim, focus, 180, (X - 0.44, -0.8, 0.2), bays, bays, lens=50, fstop=3.0)
    shot(cam, aim, focus, 220, (X + 0.95, 1.4, 0.32), (X + 0.06, D * 0.9, Z1 - 0.3), lens=40, fstop=3.5)    # the back
    shot(cam, aim, focus, 250, (X + 0.58, 1.12, 0.1), (X + 0.03, D, Z1 - 0.3), lens=45, fstop=3.0)
    prox = (px, -0.02, bz + 0.04)
    shot(cam, aim, focus, 266, (X + 0.05, -1.15, 0.32), prox, prox, lens=45, fstop=3.5)                    # Proxmox node
    shot(cam, aim, focus, 310, (px - 0.25, -0.78, 0.13), prox, prox, lens=55, fstop=3.0)
    b3 = (B3, -0.02, 0.07)
    shot(cam, aim, focus, 311, (B3 - 0.52, -0.82, 0.28), b3, b3, lens=45, fstop=3.0, cut=True)           # cut: 3 bays
    shot(cam, aim, focus, 355, (B3 - 0.3, -0.64, 0.2), b3, b3, lens=50, fstop=3.0)
    b5 = (B5, -0.02, 0.11)
    shot(cam, aim, focus, 356, (B5 + 0.56, -0.86, 0.05), b5, b5, lens=45, fstop=3.0, cut=True)           # cut: 5 bays
    shot(cam, aim, focus, 400, (B5 + 0.33, -0.7, 0.18), b5, b5, lens=50, fstop=3.0)
    wide = (X + 0.2, 0.15, -0.05)
    shot(cam, aim, focus, 401, (X - 0.86, -1.5, 0.5), wide, front_mid, lens=35, fstop=5.6, cut=True)      # hero
    shot(cam, aim, focus, END, (X - 0.58, -1.12, 0.36), wide, bays, lens=38, fstop=4.5)
    for o in (cam, aim, focus, cam.data):
        for fc in fcurves_of(o):
            for kp in fc.keyframe_points:
                if kp.interpolation != "CONSTANT":
                    kp.interpolation = "BEZIER"
                    kp.easing = "AUTO"
    handheld(cam, aim)


# ------------------------------------------------------------------ render settings
def render_settings(sc, preview, lowres):
    r = sc.render
    r.resolution_x, r.resolution_y = (640, 360) if preview else (960, 540) if lowres else (1600, 900)
    r.resolution_percentage = 100
    r.use_motion_blur = True
    r.motion_blur_shutter = 0.45
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.exposure = -0.25
        for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
            try:
                sc.view_settings.look = look
                break
            except TypeError:
                pass
    except TypeError:
        pass
    r.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "HIP"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "HIP"
    sc.cycles.device = "GPU"
    sc.cycles.samples = int(arg("--samples", 12 if preview else 64))
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    try:
        sc.cycles.denoising_use_gpu = True
    except AttributeError:
        pass
    sc.cycles.max_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    r.use_persistent_data = True


def main():
    sc = reset()
    studio(sc)
    builds = {name: import_build(name, x) for name, x in SETS.items()}
    builds["proxmox_pi"] = import_build("proxmox_pi", 0.0)
    dress_materials()
    build_film(sc, builds)
    preview = bool(arg("--preview"))
    render_settings(sc, preview, bool(arg("--lowres")))
    if arg("--save"):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC, "hero.blend"))
    still = arg("--still")
    if still:
        for f in str(still).split(","):
            sc.frame_set(int(f))
            sc.render.filepath = os.path.join(SRC, f"still_{int(f):04d}.png")
            bpy.ops.render.render(write_still=True)
        return
    if preview or arg("--render"):
        fr = arg("--frames")
        if fr and fr is not True:
            a, b = fr.split("-")
            sc.frame_start, sc.frame_end = int(a), int(b)
        sc.render.filepath = os.path.join(SRC, "preview" if preview else "frames", "f_")
        bpy.ops.render.render(animation=True)


main()
