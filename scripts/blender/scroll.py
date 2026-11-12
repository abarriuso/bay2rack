"""bay2rack scroll film: a retro homelab, then its rack comes apart piece by piece and ends as the kit on the table.

The page plays it with the scroll (one frame per step, forwards and backwards), so nothing here depends on time:
no motion blur, no camera shake. Shot like a commercial: long lenses, shallow depth of field, the focus pulled to
each piece as it leaves, a frozen moment the camera orbits, pieces that snap into place like a transformer.
The words are the page's, not the film's: BEATS says which frames each text belongs to and which side of the
picture it sits on, so every shot leaves that side free. No brand or model names anywhere in the picture.
Nothing moves in a way the real thing could not: cables come off before their module, screws before their piece,
the bay screws leave through the open side of the case.

Input: docs/blender/film.glb (+ .json), exported from the web viewer in dev mode:
  await __b2r.exportBuild('film', { ...__b2r.EXAMPLES.router, rack_modules: 'uswflex,nkvm:side,vent', vent_style: 'dots' },
                          { sleeper: true })
(one switch, the KVM lite and the round-hole vent panel under them: three different pieces, one per U)

Run (Blender 5.2):
  blender -b -P scripts/blender/scroll.py -- --preview            640x360, every 2nd frame -> docs/blender/scroll/preview/
  blender -b -P scripts/blender/scroll.py -- --still 60,150       frames -> docs/blender/scroll/still_####.png
  blender -b -P scripts/blender/scroll.py -- --render [--frames A-B] [--step 2] [--lowres]   final frames -> docs/blender/scroll/frames/
  blender -b -P scripts/blender/scroll.py -- --between 4          the three moments between each two frames of --render
                                                                  (a film four times as fine; q_####_k.png, resumable)
  add --light for the light theme's version (its files get _light), --save to keep docs/blender/scroll/scroll.blend
  blender -b -P scripts/blender/scroll.py -- --table              no render: where each piece lies on the table at the
                                                                  last frame, and the camera there -> docs/scroll/table.json
                                                                  (the configurator puts the pieces there and builds the
                                                                  PC from them, from the same camera)
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero as h  # noqa: E402

END = 240
OUT = os.path.join(h.SRC, "scroll")
LIGHT = bool(h.arg("--light"))
TAG = "_light" if LIGHT else ""
# (first frame, last frame, key, side of the picture the text sits on, what the page says there)
BEATS = [
    (1, 24, "homelab", "left", "Tu homelab cabe en una torre de los 90"),
    (25, 54, "rack", "left", "Sus bahias frontales son ahora un rack"),
    (55, 88, "screws", "left", "Se atornilla como un lector de CD: nada se corta, nada se pega"),
    (89, 134, "modules", "left", "Cada U es un modulo impreso: tu eliges que va en cada una"),
    (135, 164, "frozen", "left", "Una pieza por aparato. Todas se imprimen sin soportes"),
    (165, 206, "adapter", "left", "Y una sola pieza convierte las bahias en rack"),
    (207, 228, "kit", "left", "Esto imprimes, esto compras"),
    (229, 240, "build", "left", "Configura el tuyo"),
]
# where the subject sits for a text on that side: the camera's lens shift (a fraction of the picture's width)
SHIFT = {"left": -0.13, "right": 0.13}
# the bare table of --plate sees this much more than the last frame (web/src/assemble.js has the same number)
PLATE_OVERSCAN = 1.5
random.seed(11)


def euler(o):
    """glTF nodes turn with quaternions; the keys here are Euler angles."""
    if o.rotation_mode != "XYZ":
        q = o.rotation_quaternion.copy()
        o.rotation_mode = "XYZ"
        o.rotation_euler = q.to_euler("XYZ")


def world_box(o):
    pts = [x.matrix_world @ Vector(c) for x in [o] + h.descendants(o) if x.type == "MESH" for c in x.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def hide(o):
    for x in [o] + h.descendants(o):
        x.hide_render = True
        x.hide_viewport = True


def turned(o, rot):
    r = o.rotation_euler
    return Euler((r.x + rot[0], r.y + rot[1], r.z + rot[2]))


def move(o, keys):
    """keys: [(frame, world offset from home, rotation added to home, kind)]; the kind is how it leaves that key:
    'move' eases in and out, 'snap' shoots off and overshoots into the next one (a transformer locking in)."""
    home_l, home_r = o.location.copy(), o.rotation_euler.copy()
    for f, off, rot, _ in keys:
        o.rotation_euler = home_r
        h.key(o, f, loc=home_l + h.to_local(o, off), rot=turned(o, rot))
    o.location, o.rotation_euler = home_l, home_r
    kinds = {round(f): k for f, _, _, k in keys}
    for fc in h.fcurves_of(o):
        if fc.data_path in ("location", "rotation_euler"):
            for kp in fc.keyframe_points:
                snap = kinds.get(round(kp.co.x)) == "snap"
                kp.interpolation = "BACK" if snap else "SINE"
                kp.easing = "EASE_OUT" if snap else "EASE_IN_OUT"
                if snap:
                    kp.back = 1.25


def posed(o, rot, center=None, xy=None, floor=None):
    """World offset that puts the piece, turned by rot, with its middle at `center` - or over `xy`, resting on the floor."""
    home_r = o.rotation_euler.copy()
    o.rotation_euler = turned(o, rot)
    bpy.context.view_layer.update()
    lo, hi = world_box(o)
    o.rotation_euler = home_r
    bpy.context.view_layer.update()
    mid = (lo + hi) / 2
    if center is not None:
        return Vector(center) - mid
    return Vector((xy[0] - mid.x, xy[1] - mid.y, floor - lo.z))


def loose_parts(group):
    """Every screw and insert of a group on its own, turning about its own middle. (The meshes come as loose
    triangles: they are welded first, or every triangle would be a piece.)"""
    out = []
    for o in [x for x in h.descendants(group) if x.type == "MESH"]:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.02)
        bm.to_mesh(o.data)
        bm.free()
        bpy.ops.object.select_all(action="DESELECT")
        o.hide_viewport = False
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.mesh.separate(type="LOOSE")
        parts = list(bpy.context.selected_objects)
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
        out += parts
    bpy.context.view_layer.update()
    return out


def hinged(angle, hinge):
    """A door: turned by `angle` about the vertical line through `hinge` -> (world offset, rotation) for move()."""
    hx, hy = hinge
    ca, sa = math.cos(angle), math.sin(angle)
    return Vector((hx - (hx * ca - hy * sa), hy - (hx * sa + hy * ca), 0.0)), (0.0, 0.0, angle)


def blacken(group):
    """The pale parts of a device go black (its ports and lights stay): a white switch is lost in its pale tray."""
    for o in [x for x in h.descendants(group) if x.type == "MESH"]:
        for slot in o.material_slots:
            b = h.principled(slot.material)
            name = h.base(slot.material.name) if slot.material else ""
            if not b or name.startswith("print") or name == "led":
                continue
            col = b.inputs["Base Color"].default_value
            if (col[0] + col[1] + col[2]) / 3 < 0.35:
                continue
            dark = slot.material.copy()
            db = h.principled(dark)
            for link in list(db.inputs["Base Color"].links):
                dark.node_tree.links.remove(link)
            db.inputs["Base Color"].default_value = (0.012, 0.012, 0.014, 1)
            db.inputs["Roughness"].default_value = 0.75                   # matt: no glare from the key light
            h.set_input(db, ["Specular IOR Level"], 0.2)
            h.set_input(db, ["Coat Weight"], 0.0)
            slot.material = dark


def light_theme(sc):
    """The light theme's version: a pale studio instead of the dark one."""
    sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.62, 0.63, 0.65, 1)
    b = h.principled(bpy.data.materials["floor"])
    b.inputs["Base Color"].default_value = (0.55, 0.55, 0.53, 1)
    for link in list(b.inputs["Roughness"].links):
        bpy.data.materials["floor"].node_tree.links.remove(link)
    b.inputs["Roughness"].default_value = 0.55


def build_film(sc, root, info):
    c = info["scene"]["case"]
    floor = (c["z0"] - 8) * 0.001
    h.light_set(0.0, floor)
    bpy.data.objects["floor"].location.z = floor
    h.area("table", (0.0, -0.58, floor + 1.5), (0.0, -0.58, floor), 1.2, 55, (1.0, 0.96, 0.9))        # over the kit
    h.area("rake", (-1.3, -1.0, floor + 0.4), (0.0, -0.58, floor), 0.7, 140, (1.0, 0.9, 0.78), 0.3)  # long shadows on it
    groups = {h.base(o.name): o for o in h.descendants(root) if o.type == "EMPTY"}
    film = {}
    Z = (0.0, 0.0, 0.0)
    FLAT = (math.pi / 2, 0.0, 0.0)                                         # front face down: how it is printed
    blacken(groups["module0"])                                             # the switch

    # 60-88: the cables plugged into the front of the rack come off; the rest of the homelab keeps its own
    front = [o for n, o in sorted(groups.items()) if n.startswith("cable_") and world_box(o)[0].y < -0.01]
    for i, o in enumerate(front):
        euler(o)
        f = 60 + i * 3
        move(o, [(1, Z, Z, "move"), (f, Z, Z, "snap"), (f + 7, (0.0, -0.05, 0.0), Z, "move"),
                 (f + 20, (-0.05 + 0.02 * i, -0.3, -0.22), (0.5, 0.0, 0.4 - 0.15 * i), "move")])
        h.hidden_from(o, f + 21)

    # the screws: the ones of the rack spin out of the front one after another (56-88) and hang in the air; the ones
    # that hold the adapter in the bays go in from the side, so they wait for the side panel to open (172-186).
    # The inserts stay in the adapter's posts.
    adapter = groups["adapter"]
    screws = []
    for p in loose_parts(groups["hardware"]):
        mat = h.base(p.data.materials[0].name) if p.data.materials else ""
        if mat in ("brass", "gold"):
            mw = p.matrix_world.copy()
            p.parent = adapter
            p.matrix_world = mw
        else:
            screws.append(p)
    bpy.context.view_layer.update()
    screws.sort(key=lambda p: (-round(p.matrix_world.translation.z, 2), p.matrix_world.translation.x))
    print(f"scroll: {len(screws)} screws, {len(front)} front cables")
    n = max(len(screws), 1)
    k = 0
    for i, p in enumerate(screws):
        lo, hi = world_box(p)
        size, mid = hi - lo, (lo + hi) / 2
        side = size.x > size.y                                             # a bay screw: it lies across
        if side and mid.x > 0:
            hide(p)                                                        # (the far side: behind the board's tray)
            continue
        d = Vector((-1.0, 0, 0)) if side else Vector((0, -1.0, 0))
        spin = (math.tau * 5, 0, 0) if side else (0, math.tau * 5, 0)
        f0 = 172 + (i % 4) * 2 if side else 56 + round(i * 20 / n)
        cloud = d * random.uniform(0.07, 0.13) + Vector((0 if side else random.uniform(-0.02, 0.02), 0, random.uniform(-0.015, 0.03)))
        spot = Vector((0.165 + (k % 8) * 0.014, -0.47 - (k // 8) * 0.035, floor + min(size.x, size.y, size.z) / 2 + 0.0005))
        lay = (spin[0], spin[1], math.pi / 2) if side else spin
        fk = 206 + round(k * 6 / n)
        k += 1
        move(p, [(1, Z, Z, "move"), (f0, Z, Z, "move"), (f0 + 12, d * 0.03, spin, "move"), (f0 + 26, cloud, spin, "move"),
                 (fk, cloud * 1.08, spin, "snap"), (fk + 14, spot - mid, lay, "move")])

    # 160-176: the side panel swings open like a door (its hinge at the back): the inside of the PC, and the way
    # out for the bay screws
    panel = groups.get("side_panel")
    if panel:
        euler(panel)
        lo, hi = world_box(panel)
        off, rot = hinged(math.radians(-105), (lo.x, hi.y))
        move(panel, [(1, Z, Z, "move"), (160, Z, Z, "snap"), (176, off, rot, "move")])
    film.update(groups=groups, screws=screws, panel=panel, floor=floor)

    # the modules and the strip's panel shoot out of the bays and lock in the air; later the adapter follows
    stage = {"module0": (90, (0.0, -0.2, 0.135)), "module1": (98, (0.0, -0.31, 0.075)), "module2": (106, (0.0, -0.42, 0.018)),
             "filler": (114, (0.0, -0.1, 0.215)), "adapter": (184, (0.0, -0.09, 0.0855))}
    table = {"adapter": (-0.215, -0.58), "filler": (0.0, -0.44), "module0": (0.0, -0.52), "module1": (0.0, -0.61),
             "module2": (0.0, -0.7)}
    for i, (name, (f0, center)) in enumerate(stage.items()):
        o = groups.get(name)
        if not o:
            continue
        euler(o)
        out = posed(o, Z, center=center)
        dur = 20 if name == "adapter" else 12
        fk = 204 + i * 2
        move(o, [(1, Z, Z, "move"), (f0, Z, Z, "snap"), (f0 + dur, out, Z, "move"), (fk, out * 1.04, Z, "snap"),
                 (fk + 16, posed(o, FLAT, xy=table[name], floor=floor), FLAT, "move")])

    # the bays, empty: light from inside the case comes out as the adapter leaves
    inside = h.area("inside", (0.0, 0.14, 0.085), (0.0, -1.0, 0.085), 0.13, 0.0, (0.55, 0.72, 1.0), 0.15)
    inside.visible_camera = False
    for f, w in ((170, 0.0), (196, 22.0), (212, 22.0), (228, 0.0)):
        inside.data.energy = w
        inside.data.keyframe_insert("energy", frame=f)

    # camera. Each shot keeps its subject off the side where the page writes (BEATS). It goes round to the right
    # before the modules shoot out (never across their way), orbits the frozen pieces back to the left, and ends
    # on the open side of the tower.
    cam, aim, focus = h.camera(sc)
    lab = (0.1, 0.12, -0.1)
    rack = (0.0, -0.01, 0.09)
    hang = (0.0, -0.17, 0.065)
    kit = (0.0, -0.58, floor)
    S = h.shot
    S(cam, aim, focus, 1, (-0.72, -1.62, -0.2), (0.2, 0.15, -0.1), lab, lens=32, fstop=4.0)               # the homelab, low
    S(cam, aim, focus, 24, (-0.55, -1.3, -0.1), (0.12, 0.1, -0.03), rack, lens=38, fstop=4.0)
    S(cam, aim, focus, 54, (-0.13, -0.5, 0.115), (0.0, 0.0, 0.088), rack, lens=70, fstop=2.8)             # macro on the rack
    S(cam, aim, focus, 70, (0.03, -0.56, 0.12), (0.0, -0.02, 0.088), (0.0, -0.03, 0.09), lens=62, fstop=2.8)
    S(cam, aim, focus, 88, (0.25, -0.63, 0.15), (0.0, -0.06, 0.09), (0.0, -0.04, 0.09), lens=55, fstop=3.2)    # round to the right
    S(cam, aim, focus, 112, (0.47, -0.74, 0.2), hang, (0.0, -0.31, 0.075), lens=48, fstop=3.5)
    S(cam, aim, focus, 134, (0.58, -0.79, 0.22), hang, (0.0, -0.31, 0.075), lens=45, fstop=4.0)
    for f, a, z in ((144, 15, 0.2), (154, -15, 0.17), (164, -42, 0.14)):                                   # the frozen orbit
        r = math.radians(a)
        S(cam, aim, focus, f, (0.9 * math.sin(r), -0.9 * math.cos(r) - 0.1, z), hang, (0.0, -0.2, 0.12), lens=45, fstop=4.0)
    S(cam, aim, focus, 186, (-0.68, -0.6, 0.13), (0.0, -0.04, 0.075), (0.0, -0.02, 0.085), lens=42, fstop=4.0)    # the open side
    S(cam, aim, focus, 206, (-0.6, -0.74, 0.1), (0.0, -0.1, 0.08), (0.0, -0.09, 0.085), lens=45, fstop=4.0)
    S(cam, aim, focus, 228, (0.0, -0.86, floor + 1.2), kit, kit, lens=45, fstop=5.6)                       # over the table
    S(cam, aim, focus, END, (0.02, -0.82, floor + 1.08), kit, kit, lens=45, fstop=5.6)
    film["cam"], film["aim"] = cam, aim
    # the picture slides sideways under the camera (lens shift: the perspective stays) so the subject sits on the
    # side the text of that stretch leaves free
    for a, b, _, side, _ in BEATS:
        cam.data.shift_x = SHIFT[side]
        for f in sorted({a + 4, max(a + 4, b - 4)}):
            cam.data.keyframe_insert("shift_x", frame=f)
    for o in (cam, aim, focus, cam.data):
        for fc in h.fcurves_of(o):
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.easing = "AUTO"
    return film


def mm(m):
    """A world matrix (metres) -> rows of 4, in mm (the configurator's units: OpenSCAD's, Z up)."""
    return [[round(m[r][c] * (1000 if c == 3 and r < 3 else 1), 4) for c in range(4)] for r in range(4)]


def table(sc, film):
    """Where each piece is at the first frame (built) and at the last (on the table), and the last camera."""
    names = [n for n in ("adapter", "filler", "module0", "module1", "module2", "module3") if n in film["groups"]]
    rest, end = {}, {}
    for f, out in ((1, rest), (END, end)):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        for n in names:
            out[n] = film["groups"][n].matrix_world.copy()
        for i, p in enumerate(film["screws"]):
            lo, hi = world_box(p)
            out[f"screw{i}"] = (p.matrix_world.copy(), (lo + hi) / 2, hi - lo)
        if film["panel"]:
            out["panel"] = film["panel"].matrix_world.copy()
        if f == END:
            cam, aim = film["cam"], film["aim"]
            camera = {"matrix": mm(cam.matrix_world), "aim": [round(x * 1000, 2) for x in aim.matrix_world.translation],
                      "lens": cam.data.lens, "sensor": cam.data.sensor_width, "shift": [cam.data.shift_x, cam.data.shift_y],
                      "size": [sc.render.resolution_x, sc.render.resolution_y]}
    pieces = {n: {"move": mm(end[n] @ rest[n].inverted())} for n in names}
    screws = []
    for i, p in enumerate(film["screws"]):
        m0, c0, s0 = rest[f"screw{i}"]
        m1, _, _ = end[f"screw{i}"]
        screws.append({"at": [round(x * 1000, 2) for x in c0], "size": [round(x * 1000, 2) for x in s0],
                       "move": mm(m1 @ m0.inverted()), "hidden": bool(p.hide_render)})
    out = {"floor": round(film["floor"] * 1000, 2), "camera": camera, "pieces": pieces, "screws": screws}
    if film["panel"]:
        out["panel"] = {"move": mm(end["panel"] @ rest["panel"].inverted())}
    path = os.path.normpath(os.path.join(h.SRC, "..", "scroll", "table.json"))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"table: {len(pieces)} pieces, {len(screws)} screws -> {path}")


def main():
    sc = h.reset()
    sc.frame_end = END
    h.studio(sc)
    root, info = h.import_build("film", 0.0)
    h.dress_materials()
    film = build_film(sc, root, info)
    if h.arg("--table"):
        table(sc, film)
        return
    if LIGHT:
        light_theme(sc)
    preview = bool(h.arg("--preview"))
    h.render_settings(sc, preview, bool(h.arg("--lowres")))
    sc.render.use_motion_blur = False                       # a scroll stops on any frame: each one must be sharp
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "beats.json"), "w", encoding="utf-8") as f:
        json.dump({"frames": END, "beats": [{"from": a, "to": b, "key": k, "side": s, "subject": round(0.5 - SHIFT[s], 2), "text": t}
                                              for a, b, k, s, t in BEATS]}, f, indent=1)
    if h.arg("--save"):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"scroll{TAG}.blend"))
    still = h.arg("--still")
    if still:
        for f in str(still).split(","):
            sc.frame_set(int(f))
            sc.render.filepath = os.path.join(OUT, f"still{TAG}_{int(f):04d}.png")
            bpy.ops.render.render(write_still=True)
        return
    between = h.arg("--between")
    if between:
        # a finer film from the same keys: the N - 1 moments between each two frames (N = 4: four times the frames),
        # saved as q_<frame>_<k>.png next to the f_<frame>.png of --render. It skips the ones already there, so it
        # can be stopped and run again.
        n = int(between)
        folder = os.path.join(OUT, "frames" + TAG)
        for f in range(1, END):
            for k in range(1, n):
                path = os.path.join(folder, f"q_{f:04d}_{k}.png")
                if os.path.exists(path):
                    continue
                sc.frame_set(f, subframe=k / n)
                sc.render.filepath = path
                bpy.ops.render.render(write_still=True)
        return
    if h.arg("--plate"):
        # the last frame without the kit: the bare table the configurator lays its 3D pieces on (the page projects
        # it onto its floor from this camera, so the film's picture turns into the 3D view with nothing moving), and
        # the same frame with the kit, to match the 3D pieces against
        sc.render.resolution_x, sc.render.resolution_y = 2560, 1440
        sc.frame_set(END)
        folder = os.path.join(OUT, "plate")
        os.makedirs(folder, exist_ok=True)
        sc.render.filepath = os.path.join(folder, f"kit{TAG}.png")
        bpy.ops.render.render(write_still=True)
        kit = [film["groups"][n] for n in ("adapter", "filler", "module0", "module1", "module2", "module3") if n in film["groups"]]
        for o in kit + list(film["screws"]):
            for d in [o] + list(h.descendants(o)):
                d.hide_render = True
        # only the floor: the PC and the homelab are the page's 3D (their shadows and reflections on the floor stay)
        for o in sc.objects:
            if o.type in ("MESH", "CURVE") and o.name != "floor":
                o.visible_camera = False
        # overscan: half as wide again on every side of the same centre (the page's camera rises off the table and
        # sees more of it). The lens shift is a fraction of the frame's width: the same offset is a smaller one.
        cam = film["cam"].data
        cam.animation_data_clear()
        cam.shift_x = cam.shift_x / PLATE_OVERSCAN
        cam.sensor_width *= PLATE_OVERSCAN
        sc.render.resolution_x, sc.render.resolution_y = 3200, 1800
        sc.render.filepath = os.path.join(folder, f"plate{TAG}.png")
        bpy.ops.render.render(write_still=True)
        return
    if h.arg("--sharp"):
        # the frames of --render again at 2560 x 1440, for the page to show when the scroll stops on one (the film
        # itself plays at 1600). Same names, in sharp<TAG>/; it skips the ones already there, so it can be resumed.
        sc.render.resolution_x, sc.render.resolution_y = 2560, 1440
        folder = os.path.join(OUT, "sharp" + TAG)
        for f in range(1, END + 1):
            path = os.path.join(folder, f"f_{f:04d}.png")
            if os.path.exists(path):
                continue
            sc.frame_set(f)
            sc.render.filepath = path
            bpy.ops.render.render(write_still=True)
        # and halfway between each two (h_####.png): a sharp picture every other frame of the page's film, so the
        # scroll that stops settles at most one frame away from where it was
        for f in range(1, END):
            path = os.path.join(folder, f"h_{f:04d}.png")
            if os.path.exists(path):
                continue
            sc.frame_set(f, subframe=0.5)
            sc.render.filepath = path
            bpy.ops.render.render(write_still=True)
        return
    if preview or h.arg("--render"):
        fr = h.arg("--frames")
        if fr and fr is not True:
            a, b = fr.split("-")
            sc.frame_start, sc.frame_end = int(a), int(b)
        sc.frame_step = int(h.arg("--step", 2 if preview else 1))     # --step 2: every other frame
        sc.render.filepath = os.path.join(OUT, ("preview" if preview else "frames") + TAG, "f_")
        bpy.ops.render.render(animation=True)


if __name__ == "__main__":
    main()
