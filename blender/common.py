# Общие помощники сцены: материалы, bmesh-примитивы, ключи анимации.
# Таймлайн 1..240 играет роль прокрутки страницы: кадр 1 — верх, 240 — низ.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Quaternion, Euler, noise

F0, F1 = 1, 240
TAU = math.pi * 2

state = {'coll': None}


def set_coll(c):
    state['coll'] = c


def link(o):
    state['coll'].objects.link(o)
    return o


# ---------- материалы ----------
MATS = {}


def mat(name, base=(0.8, 0.8, 0.8), metal=0.0, rough=0.45, emit=None, estr=0.0,
        trans=0.0, ior=1.45, coat=0.0, alpha=1.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')

    def s(k, v):
        if k in b.inputs:
            b.inputs[k].default_value = v

    s('Base Color', (*base, 1)); s('Metallic', metal); s('Roughness', rough)
    s('Transmission Weight', trans); s('IOR', ior); s('Coat Weight', coat)
    if alpha < 1:
        s('Alpha', alpha)
    if emit:
        s('Emission Color', (*emit, 1)); s('Emission Strength', estr)
    # цвет и блеск в режиме Solid вьюпорта
    m.diffuse_color = (*(emit if emit and estr > 2 else base), 1)
    m.metallic = metal
    m.roughness = rough
    MATS[name] = m
    return m


# ---------- объекты ----------
def empty(name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), size=0.25):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    link(e)
    e.parent = parent
    e.location = loc
    e.rotation_euler = rot
    return e


def from_bm(name, bm, mats, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), smooth=False,
            bevel=0.0, bevel_seg=2):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    link(o)
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    if bevel:
        md = o.modifiers.new('Bevel', 'BEVEL')
        md.width = bevel
        md.segments = bevel_seg
        md.limit_method = 'ANGLE'
    return o


def dup(src, name, parent=None, loc=(0, 0, 0), rot=None, quat=None, scale=(1, 1, 1)):
    o = bpy.data.objects.new(name, src.data)
    link(o)
    o.parent = parent
    o.location = loc
    if quat is not None:
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = quat
    elif rot is not None:
        o.rotation_euler = rot
    o.scale = scale
    for md in src.modifiers:
        n = o.modifiers.new(md.name, md.type)
        for attr in ('width', 'segments', 'limit_method', 'thickness', 'use_even_offset',
                     'use_replace', 'offset'):
            if hasattr(md, attr):
                try:
                    setattr(n, attr, getattr(md, attr))
                except Exception:
                    pass
    return o


def faces_of(verts):
    return {f for v in verts for f in v.link_faces}


def set_mat(verts, idx):
    for f in faces_of(verts):
        f.material_index = idx


# ---------- примитивы bmesh ----------
def box(bm, loc, size, rot=None, mi=0):
    q = rot if rot is not None else Quaternion()
    if isinstance(q, Euler):
        q = q.to_quaternion()
    M = Matrix.LocRotScale(Vector(loc), q, Vector(size))
    v = bmesh.ops.create_cube(bm, size=1.0, matrix=M)['verts']
    set_mat(v, mi)
    return v


def cyl(bm, loc, r, h, seg=16, rot=None, r2=None, mi=0):
    q = rot if rot is not None else Quaternion()
    if isinstance(q, Euler):
        q = q.to_quaternion()
    M = Matrix.LocRotScale(Vector(loc), q, Vector((1, 1, 1)))
    v = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
                              radius2=r if r2 is None else r2, depth=h, matrix=M)['verts']
    set_mat(v, mi)
    return v


def ico(bm, loc, r, sub=2, scale=(1, 1, 1), rot=None, mi=0):
    q = rot if rot is not None else Quaternion()
    if isinstance(q, Euler):
        q = q.to_quaternion()
    M = Matrix.LocRotScale(Vector(loc), q, Vector(scale))
    v = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r, matrix=M)['verts']
    set_mat(v, mi)
    return v


def uvsphere(bm, loc, r, u=24, vseg=12, scale=(1, 1, 1), mi=0):
    M = Matrix.LocRotScale(Vector(loc), Quaternion(), Vector(scale))
    v = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=vseg, radius=r, matrix=M)['verts']
    set_mat(v, mi)
    return v


def circ(r, n, a0=0.0):
    return [(r * math.cos(a0 + TAU * i / n), r * math.sin(a0 + TAU * i / n)) for i in range(n)]


def ring_prism(bm, outer, inner, z0, z1, mi=0):
    """Кольцо с отверстием: внешний и внутренний контуры с равным числом точек."""
    n = len(outer)
    ob = [bm.verts.new((x, y, z0)) for x, y in outer]
    ot = [bm.verts.new((x, y, z1)) for x, y in outer]
    ib = [bm.verts.new((x, y, z0)) for x, y in inner]
    it = [bm.verts.new((x, y, z1)) for x, y in inner]
    fs = []
    for i in range(n):
        j = (i + 1) % n
        fs.append(bm.faces.new((ot[i], ot[j], it[j], it[i])))
        fs.append(bm.faces.new((ob[j], ob[i], ib[i], ib[j])))
        fs.append(bm.faces.new((ob[i], ob[j], ot[j], ot[i])))
        fs.append(bm.faces.new((ib[j], ib[i], it[i], it[j])))
    for f in fs:
        f.material_index = mi
    return ob + ot + ib + it


def disk_prism(bm, pts, z0, z1, mi=0):
    """Сплошная призма по контуру."""
    n = len(pts)
    b = [bm.verts.new((x, y, z0)) for x, y in pts]
    t = [bm.verts.new((x, y, z1)) for x, y in pts]
    fs = [bm.faces.new(t), bm.faces.new(list(reversed(b)))]
    for i in range(n):
        j = (i + 1) % n
        fs.append(bm.faces.new((b[i], b[j], t[j], t[i])))
    for f in fs:
        f.material_index = mi
    return b + t


def toothed(r, teeth, depth, fr=(0.0, 0.22, 0.48, 0.7)):
    """Контур шестерни / накатки: четыре точки на зуб."""
    pts, angs = [], []
    p = TAU / teeth
    for t in range(teeth):
        for f, rr in zip(fr, (r - depth, r, r, r - depth)):
            a = t * p + f * p
            pts.append((rr * math.cos(a), rr * math.sin(a)))
            angs.append(a)
    return pts, angs


def spin_profile(bm, prof, angle=TAU, steps=64, start=0.0, closed=False, mi=0):
    """Тело вращения вокруг оси Z. prof — [(радиус, z)]. closed=True — профиль замыкается
    в грань и вытягивается в сплошное тело с крышками на концах неполного оборота."""
    before_f, before_v = set(bm.faces), set(bm.verts)
    full = abs(angle - TAU) < 1e-6
    vs = [bm.verts.new((r * math.cos(start), r * math.sin(start), z)) for r, z in prof]
    geom = list(vs)
    if closed:
        f = bm.faces.new(vs)
        geom += [f] + list(f.edges)
    else:
        geom += [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=geom, cent=(0, 0, 0), axis=(0, 0, 1), angle=angle,
                   steps=steps, use_merge=full, use_duplicate=False)
    if full:
        bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v not in before_v], dist=1e-5)
    for f in bm.faces:
        if f not in before_f:
            f.material_index = mi


def curve_obj(name, pts, bevel, mats, parent=None, cyclic=False, res=4, loc=(0, 0, 0)):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (c[0], c[1], c[2], 1)
    sp.use_cyclic_u = cyclic
    for m in mats:
        cu.materials.append(m)
    o = bpy.data.objects.new(name, cu)
    link(o)
    o.parent = parent
    o.location = loc
    return o


def align_z(d):
    return Vector((0, 0, 1)).rotation_difference(Vector(d).normalized())


# ---------- анимация ----------
def _interp(kind):
    pe = bpy.context.preferences.edit
    old = pe.keyframe_new_interpolation_type
    if kind:
        pe.keyframe_new_interpolation_type = kind
    return pe, old


def key(o, f, loc=None, rot=None, scale=None, quat=None, interp=None):
    pe, old = _interp(interp)
    if loc is not None:
        o.location = loc
        o.keyframe_insert('location', frame=f)
    if rot is not None:
        o.rotation_euler = rot
        o.keyframe_insert('rotation_euler', frame=f)
    if quat is not None:
        o.rotation_quaternion = quat
        o.keyframe_insert('rotation_quaternion', frame=f)
    if scale is not None:
        o.scale = scale
        o.keyframe_insert('scale', frame=f)
    pe.keyframe_new_interpolation_type = old


def keyv(owner, path, f, v, interp=None):
    pe, old = _interp(interp)
    setattr(owner, path, v)
    owner.keyframe_insert(path, frame=f)
    pe.keyframe_new_interpolation_type = old


def spin(o, axis, turns, f0=F0, f1=F1, base=(0, 0, 0)):
    """Равномерное вращение на протяжении прокрутки."""
    a = list(base)
    key(o, f0, rot=tuple(a), interp='LINEAR')
    a[axis] += TAU * turns
    key(o, f1, rot=tuple(a), interp='LINEAR')


def rnd(a, b):
    return random.uniform(a, b)
