"""Build the Rinse & Repeat bathroom and bedroom props in Blender and export them as GLB.

Run headless:
  blender --background --factory-startup --python build_props.py -- <texture_dir> <out_dir> [names...]

<texture_dir> holds Poly Haven (CC0) texture folders: white_oak_veneer, terry_cloth, rough_linen.
<out_dir> receives glb/<Name>.glb and png/<Name>.png preview renders.
Sizes are real-world metres; Lens Studio imports GLB metres as centimetres x100.
Every model faces -Y in Blender, which becomes +Z (towards the viewer) in glTF.
Floor props have their origin at the floor centre; wall props at the wall plane.
"""

import json
import math
import os
import struct
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TEX_DIR = argv[0]
OUT_DIR = argv[1]
ONLY = set(argv[2:])
os.makedirs(os.path.join(OUT_DIR, "glb"), exist_ok=True)
os.makedirs(os.path.join(OUT_DIR, "png"), exist_ok=True)
os.makedirs(os.path.join(OUT_DIR, "tex"), exist_ok=True)

# ---------------------------------------------------------------- materials

_mats = {}
_imgs = {}


def tinted(tex, kind, tint, name):
    """Load a texture, multiply it by `tint`, save it as PNG and return the image."""
    key = (name, kind)
    if key in _imgs:
        return _imgs[key]
    src = os.path.join(TEX_DIR, tex, f"{tex}_{kind}_1k.jpg")
    img = bpy.data.images.load(src)
    if kind == "Diffuse" and tint is not None:
        px = list(img.pixels)
        grey = tex in ("terry_cloth", "rough_linen")  # fabric: keep the weave, replace the colour
        for i in range(0, len(px), 4):
            if grey:
                lum = 0.35 + 0.65 * (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
                px[i] = px[i + 1] = px[i + 2] = min(1.0, lum * 1.6)
            px[i] = min(1.0, px[i] * tint[0])
            px[i + 1] = min(1.0, px[i + 1] * tint[1])
            px[i + 2] = min(1.0, px[i + 2] * tint[2])
        out = bpy.data.images.new(f"{name}_diff", img.size[0], img.size[1])
        out.pixels = px
        out.filepath_raw = os.path.join(OUT_DIR, "tex", f"{name}_diff.png")
        out.file_format = "PNG"
        out.save()
        img = out
    else:
        img.colorspace_settings.name = "Non-Color" if kind != "Diffuse" else "sRGB"
    _imgs[key] = img
    return img


def mat(name, color=(1, 1, 1), metal=0.0, rough=0.5, tex=None, tint=None, emit=0.0, double=False):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = not double
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    if emit > 0:
        bsdf.inputs["Emission Color"].default_value = (*color, 1)
        bsdf.inputs["Emission Strength"].default_value = emit
    if tex:
        it = nt.nodes.new("ShaderNodeTexImage")
        it.image = tinted(tex, "Diffuse", tint, name)
        nt.links.new(it.outputs["Color"], bsdf.inputs["Base Color"])
        nrm_path = os.path.join(TEX_DIR, tex, f"{tex}_nor_gl_1k.jpg")
        if os.path.exists(nrm_path):
            nt_img = nt.nodes.new("ShaderNodeTexImage")
            nt_img.image = tinted(tex, "nor_gl", None, name)
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = 0.8
            nt.links.new(nt_img.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    _mats[name] = m
    return m


def M():
    """The shared material palette (light colours: dark renders transparent on Specs)."""
    return {
        "ceramic": mat("Ceramic", (0.95, 0.95, 0.94), 0.0, 0.12),
        "chrome": mat("Chrome", (0.88, 0.89, 0.91), 0.35, 0.28),  # satin, stays bright on Specs
        "oak": mat("Oak", tex="white_oak_veneer", tint=(1.08, 1.05, 1.0), rough=0.55),
        "paint": mat("WhitePaint", (0.93, 0.92, 0.89), 0.0, 0.45),
        "terry_blue": mat("TerryBlue", tex="terry_cloth", tint=(0.55, 0.75, 1.0), rough=0.95),
        "terry_white": mat("TerryWhite", tex="terry_cloth", tint=(0.86, 0.86, 0.84), rough=0.95),
        "linen_aqua": mat("LinenAqua", tex="rough_linen", tint=(0.72, 0.95, 0.95), rough=0.9, double=True),
        "mirror": mat("MirrorGlass", (0.74, 0.8, 0.85), 0.0, 0.45),  # matte: reflects no environment
        "teal": mat("ShampooTeal", (0.1, 0.62, 0.62), 0.0, 0.25),
        "lavender": mat("ConditionerLavender", (0.68, 0.55, 0.9), 0.0, 0.25),
        "peach": mat("BodyWashPeach", (1.0, 0.5, 0.26), 0.0, 0.25),
        "label": mat("LabelWhite", (0.97, 0.97, 0.95), 0.0, 0.6),
        "cap": mat("CapWhite", (0.96, 0.96, 0.96), 0.0, 0.35),
        "soap": mat("SoapCream", (1.0, 0.95, 0.82), 0.0, 0.45),
        "shade": mat("LampShade", (1.0, 0.95, 0.85), 0.0, 0.8, emit=0.6, double=True),
        "lamp_base": mat("LampBase", (0.86, 0.9, 0.84), 0.0, 0.3),
        "parquet": mat("Parquet", tex="herringbone_parquet", tint=(1.25, 1.2, 1.12), rough=0.5),
        "plaster": mat("Plaster", tex="painted_plaster_wall", tint=(1.05, 1.0, 0.92), rough=0.9),
        "floor_tile": mat("FloorTile", tex="interior_tiles", tint=(1.1, 1.1, 1.08), rough=0.35),
        "wall_tile": mat("WallTile", tex="long_white_tiles", tint=(1.12, 1.12, 1.12), rough=0.25),
        "ceiling": mat("Ceiling", (0.95, 0.94, 0.92), 0.0, 0.9),
        "spray": mat("SprayFace", (0.78, 0.8, 0.82), 0.0, 0.5),
        "door": mat("DoorSage", (0.72, 0.8, 0.74), 0.0, 0.5),  # off-white blows out to glare on Specs
        "glow": mat("PickupGlow", (1.0, 0.72, 0.12), 0.0, 0.5),  # exported unlit, see make_unlit
    }


# ---------------------------------------------------------------- geometry helpers


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    _imgs.clear()


def _finish(obj, m, bevel=0.0, segs=3, smooth=True):
    obj.data.materials.append(m)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
        except Exception:
            bpy.ops.object.shade_smooth()
    obj.select_set(False)
    return obj


def box(size, loc, m, bevel=0.0, segs=3, smooth=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.scale = size
    return _finish(o, m, bevel, segs, smooth)


def cyl(r, depth, loc, m, rot=(0, 0, 0), verts=32, bevel=0.0, segs=3, scale=(1, 1, 1), r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = scale
    return _finish(o, m, bevel, segs)


def sphere(r, loc, m, scale=(1, 1, 1), segs=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segs, ring_count=segs // 2)
    o = bpy.context.active_object
    o.scale = scale
    return _finish(o, m)


def torus(major, minor, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=24, minor_segments=8)
    return _finish(bpy.context.active_object, m)


def lathe(rings, m, loc=(0, 0, 0), sy=1.0, verts=40, cap_top=True):
    """Solid of revolution from [(z, radius), ...] bottom to top; `sy` squashes it into an oval."""
    bm = bmesh.new()
    loops = []
    for z, r in rings:
        loops.append([bm.verts.new((loc[0] + r * math.cos(a), loc[1] + r * sy * math.sin(a), loc[2] + z))
                      for a in (2 * math.pi * i / verts for i in range(verts))])
    for a, b in zip(loops, loops[1:]):
        for i in range(verts):
            j = (i + 1) % verts
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(loops[0])))
    if cap_top:
        bm.faces.new(loops[-1])
    me = bpy.data.meshes.new("lathe")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("lathe", me)
    bpy.context.collection.objects.link(o)
    return _finish(o, m)


def cut(target, cutter):
    """Boolean difference, then delete the cutter."""
    mod = target.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def box_uvs(obj, tile=0.5):
    """World-scale box projection: 1 texture repeat per `tile` metres."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            co = loop.vert.co
            if ax == 0:
                u, v = co.y, co.z
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            loop[uv].uv = (u / tile, v / tile)
    bm.to_mesh(me)
    bm.free()


def join_all(name, uvs=True):
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    # Bake every part's transform so the joined prop has an identity transform at the origin.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    if uvs:
        box_uvs(o)
    return o


# ---------------------------------------------------------------- export + preview


def export(obj, name):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_DIR, "glb", name + ".glb"), export_format="GLB",
                              use_selection=True, export_apply=True)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    dims = obj.dimensions
    make_unlit(os.path.join(OUT_DIR, "glb", name + ".glb"))
    print(f"[prop] {name}: {dims.x * 100:.0f} x {dims.y * 100:.0f} x {dims.z * 100:.0f} cm, {tris} triangles")


UNLIT = {"PickupGlow"}  # materials that should ignore scene lighting (pure, bright colour)


def make_unlit(path, names=UNLIT):
    """Mark the named materials in a GLB with KHR_materials_unlit (Blender's exporter does not)."""
    with open(path, "rb") as f:
        data = f.read()
    magic, version, _ = struct.unpack_from("<III", data, 0)
    json_len, json_type = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + json_len])
    rest = data[20 + json_len:]
    changed = False
    for m in gltf.get("materials", []):
        if m.get("name") in names:
            m.setdefault("extensions", {})["KHR_materials_unlit"] = {}
            m.pop("emissiveFactor", None)
            changed = True
    if not changed:
        return
    used = gltf.setdefault("extensionsUsed", [])
    if "KHR_materials_unlit" not in used:
        used.append("KHR_materials_unlit")
    chunk = json.dumps(gltf, separators=(",", ":")).encode()
    chunk += b" " * ((4 - len(chunk) % 4) % 4)
    out = struct.pack("<III", magic, version, 12 + 8 + len(chunk) + len(rest))
    out += struct.pack("<II", len(chunk), json_type) + chunk + rest
    with open(path, "wb") as f:
        f.write(out)


def preview(obj, name, d=(0.75, -1.6, 0.65), suffix="", figure=None, zoom=2.0):
    sc = bpy.context.scene
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES"):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    if sc.render.engine == "CYCLES":
        sc.cycles.samples = 48
    sc.render.resolution_x = sc.render.resolution_y = 512
    sc.render.film_transparent = False
    # Studio gradient (bright above, dark below) so chrome has something to reflect.
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    wn = world.node_tree.nodes
    tc = wn.new("ShaderNodeTexCoord")
    sep = wn.new("ShaderNodeSeparateXYZ")
    ramp = wn.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.08, 0.08, 0.09, 1)
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[1].color = (0.9, 0.9, 0.92, 1)
    mapr = wn.new("ShaderNodeMapRange")
    mapr.inputs["From Min"].default_value = -1
    world.node_tree.links.new(tc.outputs["Generated"], sep.inputs[0])
    world.node_tree.links.new(sep.outputs["Z"], mapr.inputs["Value"])
    world.node_tree.links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
    world.node_tree.links.new(ramp.outputs["Color"], wn["Background"].inputs[0])
    wn["Background"].inputs[1].default_value = 0.8
    sc.world = world
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    centre = (lo + hi) / 2
    size = (hi - lo).length
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    if figure is not None:  # 175 cm grey figure for scale, preview only
        fm = mat("Figure", (0.55, 0.6, 0.68), 0.0, 0.7)
        cyl(0.17, 1.4, (figure[0], figure[1], figure[2] + 0.7), fm, scale=(1, 0.65, 1), bevel=0.08)
        sphere(0.11, (figure[0], figure[1], figure[2] + 1.62), fm)
        size = max(size, 2.2)
        centre = Vector((centre.x, centre.y, max(centre.z, 0.8)))
    d = Vector(d).normalized()
    cam.location = centre + d * size * zoom
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    for loc, energy in (((2, -3, 4), 900), ((-3, -1, 2), 300)):
        ld = bpy.data.lights.new("l", "AREA")
        ld.energy = energy * max(size, 0.3) ** 2
        ld.size = 2.0
        lo_ = bpy.data.objects.new("l", ld)
        lo_.location = centre + Vector(loc) * max(size, 0.3)
        lo_.rotation_euler = (centre - lo_.location).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(lo_)
    sc.render.filepath = os.path.join(OUT_DIR, "png", name + suffix + ".png")
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------- props


def bathtub(m):
    # Standard alcove tub: 170 x 80 cm, rim 55 cm high, basin floor 5 cm up, so about 50 cm deep inside.
    tub = box((1.7, 0.8, 0.55), (0, 0, 0.275), m["ceramic"], bevel=0.03)
    hole = box((1.56, 0.66, 0.7), (0, 0, 0.05 + 0.35), m["ceramic"], bevel=0.1, segs=6)
    cut(tub, hole)
    cyl(0.025, 0.004, (-0.62, 0, 0.052), m["chrome"])  # drain
    cyl(0.02, 0.1, (-0.78, 0.25, 0.6), m["chrome"])  # faucet riser
    cyl(0.016, 0.16, (-0.72, 0.25, 0.64), m["chrome"], rot=(0, math.pi / 2, 0))  # spout
    for x in (-0.82, -0.68):
        cyl(0.018, 0.04, (x, 0.32, 0.57), m["chrome"])  # taps


def shower_curtain(m):
    cyl(0.012, 1.72, (0, 0, 2.0), m["chrome"], rot=(0, math.pi / 2, 0))
    for i in range(17):
        torus(0.018, 0.003, (-0.8 + i * 0.1, 0, 1.985), m["chrome"], rot=(math.pi / 2, 0, 0))
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=96, y_subdivisions=10, size=1, location=(0, 0, 1.1),
                                    rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object
    o.scale = (1.62, 1.75, 1)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    k = 2 * math.pi * 9 / 1.62
    for v in o.data.vertices:
        x, z = v.co.x, v.co.z
        fold = math.sin(x * k) + 0.45 * math.sin(x * k * 2.3 + 1.1) + 0.25 * math.sin(x * k * 0.37 + 0.4)
        v.co.y += 0.03 * fold * (0.55 + 0.45 * (z - 0.2) / 1.8)  # folds tighter near the rings
        v.co.y += 0.01 * math.sin(z * 9 + x * 3)  # slight sway down the length
    o.data.materials.append(m["linen_aqua"])
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()


def shower_head(m):
    cyl(0.04, 0.01, (0, -0.005, 1.95), m["chrome"], rot=(math.pi / 2, 0, 0))  # wall flange
    cyl(0.011, 0.84, (0, -0.035, 1.52), m["chrome"])  # exposed riser from the valve to the arm
    cyl(0.018, 0.03, (0, -0.035, 1.94), m["chrome"])  # riser top fitting
    cyl(0.009, 0.03, (0, -0.02, 1.94), m["chrome"], rot=(math.pi / 2, 0, 0))  # wall bracket
    cyl(0.012, 0.32, (0, -0.15, 2.0), m["chrome"], rot=(math.radians(70), 0, 0))  # arm
    cyl(0.11, 0.018, (0, -0.3, 2.04), m["chrome"], bevel=0.006)  # rain head
    cyl(0.095, 0.003, (0, -0.3, 2.03), m["spray"])  # spray face
    for i in range(24):  # nozzles
        a, r = 2 * math.pi * i / 24, 0.06 + 0.02 * (i % 2)
        cyl(0.004, 0.004, (r * math.cos(a), -0.3 + r * math.sin(a), 2.0275), m["chrome"], verts=8)
    cyl(0.085, 0.012, (0, -0.006, 1.1), m["chrome"], rot=(math.pi / 2, 0, 0), bevel=0.003)  # valve plate
    cyl(0.025, 0.03, (0, -0.025, 1.1), m["chrome"], rot=(math.pi / 2, 0, 0))  # valve body
    box((0.11, 0.015, 0.012), (0.04, -0.045, 1.1), m["chrome"], bevel=0.004)  # lever


def toilet(m):
    # Foot, narrow waist, then the rounded bowl flaring out to the rim.
    bowl = lathe([(0.0, 0.13), (0.015, 0.135), (0.05, 0.12), (0.12, 0.105), (0.2, 0.125),
                  (0.28, 0.165), (0.34, 0.185), (0.375, 0.19), (0.38, 0.185)],
                 m["ceramic"], loc=(0, -0.06, 0), sy=1.32)
    bowl_hole = sphere(0.15, (0, -0.07, 0.4), m["ceramic"], scale=(1, 1.3, 0.8))
    cut(bowl, bowl_hole)
    cyl(0.2, 0.03, (0, -0.07, 0.395), m["ceramic"], scale=(1, 1.32, 1), bevel=0.012)  # closed lid
    box((0.42, 0.19, 0.38), (0, 0.2, 0.58), m["ceramic"], bevel=0.02)  # tank
    box((0.44, 0.21, 0.03), (0, 0.2, 0.785), m["ceramic"], bevel=0.01)  # tank lid
    cyl(0.022, 0.008, (0, 0.2, 0.803), m["chrome"])  # flush button


def vanity_sink(m):
    outer = (0.255, 0.175, 0.125)
    inner = (0.24, 0.16, 0.11)
    bc = (0, -0.02, 0.86)
    cab = box((0.8, 0.46, 0.8), (0, 0.01, 0.4), m["oak"], bevel=0.008)
    cut(cab, sphere(1.0, bc, m["oak"], scale=outer))  # room for the basin
    for x in (-0.2, 0.2):
        box((0.385, 0.018, 0.66), (x, -0.226, 0.43), m["oak"], bevel=0.004)
        box((0.012, 0.02, 0.16), (x + (0.15 if x < 0 else -0.15), -0.25, 0.62), m["chrome"], bevel=0.004)
    top = box((0.84, 0.5, 0.05), (0, 0, 0.825), m["ceramic"], bevel=0.01)
    cut(top, sphere(1.0, bc, m["ceramic"], scale=inner))
    shell = sphere(1.0, bc, m["ceramic"], scale=outer)  # under-mounted ceramic bowl
    cut(shell, sphere(1.0, bc, m["ceramic"], scale=inner))
    cut(shell, box((1, 1, 0.3), (0, 0, 0.95), m["ceramic"]))  # trim the part above the counter
    cyl(0.02, 0.004, (0, -0.02, 0.775), m["chrome"])  # drain
    cyl(0.018, 0.16, (0, 0.18, 0.93), m["chrome"])  # faucet
    cyl(0.013, 0.12, (0, 0.13, 1.0), m["chrome"], rot=(math.pi / 2, 0, 0))  # spout
    box((0.012, 0.07, 0.012), (0.045, 0.19, 0.99), m["chrome"], bevel=0.004)  # lever


def bath_mirror(m):
    box((0.6, 0.03, 0.8), (0, -0.015, 0.4), m["oak"], bevel=0.006)
    box((0.53, 0.004, 0.73), (0, -0.032, 0.4), m["mirror"], smooth=False)


def towel_bar(m):
    cyl(0.009, 0.62, (0, -0.07, 0), m["chrome"], rot=(0, math.pi / 2, 0))
    for x in (-0.3, 0.3):
        cyl(0.025, 0.01, (x, -0.005, 0), m["chrome"], rot=(math.pi / 2, 0, 0), bevel=0.003)
        cyl(0.01, 0.07, (x, -0.04, 0), m["chrome"], rot=(math.pi / 2, 0, 0))


def towel(m):
    # Folded in thirds: three soft layers, each slightly offset so the folds read from the side.
    for i, (dx, w) in enumerate(((0.0, 0.32), (0.004, 0.318), (-0.003, 0.316))):
        box((w, 0.18, 0.026), (dx, 0, 0.013 + i * 0.024), m["terry_blue"], bevel=0.012, segs=5)


def sheet(width, path, m, amp=0.0, waves=6, gather=None, thickness=0.006, nx=28):
    """A cloth strip `width` wide along X, following `path` [(y, z), ...] in the YZ plane.
    Folds push the cloth along the path normal; `gather(s)` scales X along the length (pinching)."""
    seg = [0.0]
    for (y0, z0), (y1, z1) in zip(path, path[1:]):
        seg.append(seg[-1] + math.hypot(y1 - y0, z1 - z0))
    length = seg[-1]
    bm = bmesh.new()
    rows = []
    for i, (y, z) in enumerate(path):
        a = path[max(i - 1, 0)]
        b = path[min(i + 1, len(path) - 1)]
        ty, tz = b[0] - a[0], b[1] - a[1]
        tl = math.hypot(ty, tz) or 1.0
        ny, nz = -tz / tl, ty / tl
        s_ = seg[i] / length
        g = gather(s_) if gather else 1.0
        row = []
        for j in range(nx + 1):
            u = j / nx - 0.5
            x = u * width * g
            f = amp(s_) if callable(amp) else amp
            d = f * (math.sin(u * math.pi * 2 * waves) + 0.4 * math.sin(u * math.pi * 2 * waves * 2.1 + 0.7))
            row.append(bm.verts.new((x, y + ny * d, z + nz * d)))
        rows.append(row)
    for r0, r1 in zip(rows, rows[1:]):
        for j in range(nx):
            bm.faces.new((r0[j], r0[j + 1], r1[j + 1], r1[j]))
    me = bpy.data.meshes.new("sheet")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("sheet", me)
    bpy.context.collection.objects.link(o)
    sol = o.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = 0
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier=sol.name)
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    o.select_set(False)
    return o


def towel_hanging(m):
    """The towel held up by one pinch: origin at the pinch point, cloth hanging 66 cm below it."""
    path = [(0.0, -i * 0.66 / 40) for i in range(41)]

    def gather(s_):
        t = min(1.0, s_ / 0.3)
        return 0.18 + 0.82 * (t * t * (3 - 2 * t))

    sheet(0.4, path, m["terry_blue"], amp=lambda s_: 0.03 * (1.0 - 0.6 * s_), waves=3.5, gather=gather,
          thickness=0.007)


def towel_on_bar(m):
    """The towel folded over the bar: origin on the bar axis; front half longer than the back."""
    r = 0.02
    path = [(r, -0.3 + i * 0.3 / 14) for i in range(15)]
    path += [(r * math.cos(a), r * math.sin(a)) for a in (math.pi * k / 12 for k in range(1, 12))]
    path += [(-r, -i * 0.36 / 16) for i in range(17)]
    sheet(0.4, path, m["terry_blue"], amp=lambda s_: 0.006 + 0.01 * abs(s_ - 0.45), waves=2.5, thickness=0.007)


def _label_band(r, z, h, m):
    cyl(r, h, (0, 0, z), m["label"])


def shampoo_bottle(m):
    cyl(0.035, 0.17, (0, 0, 0.085), m["teal"], bevel=0.012, segs=4)
    _label_band(0.0355, 0.075, 0.08, m)
    cyl(0.012, 0.02, (0, 0, 0.18), m["cap"])
    cyl(0.017, 0.03, (0, 0, 0.205), m["cap"], bevel=0.004)
    box((0.012, 0.045, 0.01), (0, -0.02, 0.215), m["cap"], bevel=0.003)


def conditioner_bottle(m):
    cyl(0.035, 0.15, (0, 0, 0.105), m["lavender"], scale=(1.3, 0.75, 1), bevel=0.014, segs=4)
    cyl(0.03, 0.03, (0, 0, 0.015), m["cap"], scale=(1.3, 0.75, 1), bevel=0.005)  # flip cap underneath
    _label_band(0.0352, 0.11, 0.07, m)
    bpy.context.active_object.scale = (1.3, 0.75, 1)
    bpy.ops.object.transform_apply(scale=True)


def body_wash_bottle(m):
    box((0.08, 0.045, 0.19), (0, 0, 0.095), m["peach"], bevel=0.016, segs=4)
    for side in (-1, 1):  # flat printed labels on the front and back
        box((0.058, 0.002, 0.075), (0, side * 0.0232, 0.09), m["label"], bevel=0.0008, segs=1)
    cyl(0.018, 0.03, (0, 0, 0.205), m["cap"], bevel=0.004)


def bar_soap_dish(m):
    dish = box((0.13, 0.095, 0.02), (0, 0, 0.01), m["ceramic"], bevel=0.008)
    dip = box((0.11, 0.075, 0.03), (0, 0, 0.027), m["ceramic"], bevel=0.01)
    cut(dish, dip)
    box((0.09, 0.06, 0.03), (0, 0, 0.025), m["soap"], bevel=0.012, segs=4)


def wardrobe(m):
    box((1.0, 0.58, 1.92), (0, 0, 1.0), m["oak"], bevel=0.006)
    box((1.0, 0.54, 0.06), (0, 0.01, 0.03), m["paint"], bevel=0.004)  # plinth
    box((1.04, 0.6, 0.03), (0, 0, 1.975), m["oak"], bevel=0.006)  # top
    for x in (-0.251, 0.251):
        box((0.495, 0.02, 1.84), (x, -0.3, 1.0), m["oak"], bevel=0.004)
        box((0.012, 0.025, 0.3), (x + (0.2 if x < 0 else -0.2), -0.325, 1.05), m["chrome"], bevel=0.004)


def table_lamp(m):
    sphere(0.08, (0, 0, 0.085), m["lamp_base"], scale=(1, 1, 1.05))
    cyl(0.03, 0.02, (0, 0, 0.01), m["lamp_base"], bevel=0.005)
    cyl(0.008, 0.16, (0, 0, 0.24), m["chrome"])
    bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=0.18, vertices=48, location=(0, 0, 0.36),
                                        end_fill_type="NOTHING")
    o = bpy.context.active_object
    _finish(o, m["shade"])
    for z in (0.27, 0.45):  # rolled rims top and bottom
        torus(0.14, 0.004, (0, 0, z), m["shade"])


def interior_door(m):
    box((0.8, 0.04, 2.0), (0.4, 0, 1.0), m["door"], bevel=0.003)
    for side in (-1, 1):
        for x in (0.2, 0.6):
            for h, z in ((0.62, 1.45), (0.82, 0.55)):
                box((0.28, 0.006, h + 0.02), (x, side * 0.021, z), m["door"], bevel=0.002)  # moulding
                box((0.24, 0.016, h - 0.02), (x, side * 0.026, z), m["door"], bevel=0.007, segs=3)  # raised panel


def pickup_ring(m):
    """Flat glowing ring laid around something the user can pick up; the controller pulses it."""
    torus(0.22, 0.01, (0, 0, 0), m["glow"])


def pickup_arrow(m):
    """Downward arrow, tip at the origin; the controller bobs it above the pickup."""
    cyl(0.0, 0.08, (0, 0, 0.04), m["glow"], r2=0.05)
    cyl(0.018, 0.09, (0, 0, 0.125), m["glow"])


def door_lever(m):
    cyl(0.03, 0.01, (0, -0.005, 0), m["chrome"], rot=(math.pi / 2, 0, 0), bevel=0.003)  # rose
    cyl(0.009, 0.05, (0, -0.03, 0), m["chrome"], rot=(math.pi / 2, 0, 0))  # neck
    box((0.12, 0.018, 0.016), (-0.055, -0.055, 0), m["chrome"], bevel=0.006)  # lever


def bath_mat(m):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=26, size=1, location=(0, 0, 0.016))
    top = bpy.context.active_object
    top.scale = (0.78, 0.48, 1)
    bpy.ops.object.transform_apply(scale=True)
    for v in top.data.vertices:  # soft pile: slightly uneven, sloping down at the edges
        edge = min(0.39 - abs(v.co.x), 0.24 - abs(v.co.y))
        v.co.z = 0.004 + min(1.0, edge / 0.03) * (0.012 + 0.002 * math.sin(v.co.x * 61) * math.sin(v.co.y * 47))
    top.data.materials.append(m["terry_white"])
    bpy.context.view_layer.objects.active = top
    bpy.ops.object.shade_smooth()
    box((0.8, 0.5, 0.004), (0, 0, 0.002), m["terry_white"], bevel=0.0015)  # backing


# ---------------------------------------------------------------- room shells
# Room coordinates are Lens Studio centimetres: x right, y = height above the floor, z towards the viewer.
# The user starts at x=0, z=0 facing -z. The door corner (shared front wall and left walls) stays fixed; the
# rooms extend to the right and away from the door. Bedroom: x BED_X0..BED_X1, z -195..BED_Z1. Bathroom
# behind the shared front wall: x BATH_X0..BATH_X1, z BATH_Z0..-205. Door opening: x -76..6, 0..202 cm high.

DOOR_X0, DOOR_X1, DOOR_H = -76, 6, 202
CEIL = 250
BED_X0, BED_X1, BED_Z1 = -180, 360, 337.5
BATH_X0, BATH_X1, BATH_Z0 = -140, 265, -733.75


def slab(x0, x1, h0, h1, z0, z1, m, tile):
    """Axis-aligned box from Lens cm ranges, with world-scale UVs (one repeat per `tile` metres)."""
    o = box(((x1 - x0) / 100, (z1 - z0) / 100, (h1 - h0) / 100),
            ((x0 + x1) / 200, -(z0 + z1) / 200, (h0 + h1) / 200), m, smooth=False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    o.select_set(False)
    box_uvs(o, tile)
    return o


def wall_with_door(z0, z1, xa, xb, m, tile):
    slab(xa, DOOR_X0, 0, CEIL, z0, z1, m, tile)
    slab(DOOR_X1, xb, 0, CEIL, z0, z1, m, tile)
    slab(DOOR_X0, DOOR_X1, DOOR_H, CEIL, z0, z1, m, tile)


def bedroom_shell(m):
    x0, x1, z1 = BED_X0, BED_X1, BED_Z1
    slab(x0, x1, -2, 0, -195, z1, m["parquet"], 1.0)  # floor
    slab(x0, x1, CEIL, CEIL + 2, -195, z1, m["ceiling"], 2.0)
    slab(x0 - 2, x0, 0, CEIL, -195, z1, m["plaster"], 1.5)  # left
    slab(x1, x1 + 2, 0, CEIL, -195, z1, m["plaster"], 1.5)  # right
    slab(x0, x1, 0, CEIL, z1, z1 + 2, m["plaster"], 1.5)  # back
    wall_with_door(-197, -195, x0, x1, m["plaster"], 1.5)  # front, bedroom face
    p = m["paint"]
    for a0, a1, b0, b1 in ((x0, x0 + 1.5, -195, z1), (x1 - 1.5, x1, -195, z1), (x0, x1, z1 - 1.5, z1),
                           (x0, DOOR_X0 - 7, -195, -193.5), (DOOR_X1 + 7, x1, -195, -193.5)):
        slab(a0, a1, 0, 9, b0, b1, p, 1.0)  # skirting boards
    slab(DOOR_X0 - 7, DOOR_X0, 0, DOOR_H + 7, -195, -193.5, p, 1.0)  # door casing
    slab(DOOR_X1, DOOR_X1 + 7, 0, DOOR_H + 7, -195, -193.5, p, 1.0)
    slab(DOOR_X0 - 7, DOOR_X1 + 7, DOOR_H, DOOR_H + 7, -195, -193.5, p, 1.0)


def bathroom_shell(m):
    x0, x1, z0 = BATH_X0, BATH_X1, BATH_Z0
    slab(x0, x1, -2, 0, z0, -205, m["floor_tile"], 0.6)
    slab(x0, x1, CEIL, CEIL + 2, z0, -205, m["ceiling"], 2.0)
    slab(x0 - 2, x0, 0, CEIL, z0, -205, m["wall_tile"], 0.9)  # left
    slab(x1, x1 + 2, 0, CEIL, z0, -205, m["wall_tile"], 0.9)  # right, behind the tub
    slab(x0, x1, 0, CEIL, z0 - 2, z0, m["wall_tile"], 0.9)  # far wall, shower end
    wall_with_door(-205, -203, x0, x1, m["wall_tile"], 0.9)  # near wall, bathroom face
    p = m["paint"]
    slab(DOOR_X0 - 2, DOOR_X0, 0, DOOR_H, -205, -195, p, 1.0)  # door jambs through the wall
    slab(DOOR_X1, DOOR_X1 + 2, 0, DOOR_H, -205, -195, p, 1.0)
    slab(DOOR_X0 - 2, DOOR_X1 + 2, DOOR_H, DOOR_H + 2, -205, -195, p, 1.0)


SHELLS = {"BedroomShell": bedroom_shell, "BathroomShell": bathroom_shell}

PROPS = {
    "Bathtub": bathtub, "ShowerCurtain": shower_curtain, "ShowerHead": shower_head, "Toilet": toilet,
    "VanitySink": vanity_sink, "BathMirror": bath_mirror, "TowelBar": towel_bar, "Towel": towel,
    "TowelHanging": towel_hanging, "TowelOnBar": towel_on_bar,
    "ShampooBottle": shampoo_bottle, "ConditionerBottle": conditioner_bottle, "BodyWashBottle": body_wash_bottle,
    "BarSoapDish": bar_soap_dish, "Wardrobe": wardrobe, "TableLamp": table_lamp, "InteriorDoor": interior_door,
    "DoorLever": door_lever, "BathMat": bath_mat, "PickupRing": pickup_ring, "PickupArrow": pickup_arrow,
}

for name, build in {**PROPS, **SHELLS}.items():
    if ONLY and name not in ONLY:
        continue
    reset()
    build(M())
    obj = join_all(name, uvs=name not in SHELLS)
    export(obj, name)
    preview(obj, name)
    if name == "Bathtub":  # look down into the basin with a person standing in it
        preview(obj, name, d=(0.35, -1.0, 1.25), suffix="_top", figure=(0.25, 0.0, 0.05), zoom=1.15)
