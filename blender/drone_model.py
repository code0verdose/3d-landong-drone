# Сам дрон: обтекаемый корпус, батарея, подвес с камерой, складные антенны, убирающееся шасси,
# четыре складных луча с винтами. Раскладка лучей (кадры 3–26) и вращение винтов заложены здесь;
# сюжет, карта и камера — в drone_flight.py и drone_world.py.
import math
import bmesh
from mathutils import Vector, Euler
from common import *

STEEL = lambda: mat('Сталь полированная', (0.78, 0.79, 0.81), metal=1, rough=0.18)
GLASS = lambda: mat('Оптическое стекло', (0.85, 0.93, 1.0), rough=0.0, trans=1.0, ior=1.6, emit=(0.4, 0.6, 1.0), estr=0.15)
RUBBER = lambda: mat('Резина', (0.012, 0.012, 0.014), rough=0.85)
CYAN = lambda: mat('Акцент бирюзовый', (0.1, 0.8, 1.0), emit=(0.1, 0.8, 1.0), estr=5.0)


def loft(bm, rings, cap=True, mi=0):
    """Соединяет кольца вершин равной длины; торцы — n-угольники."""
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])).material_index = mi
    if cap:
        bm.faces.new(rings[0]).material_index = mi
        bm.faces.new(list(reversed(rings[-1]))).material_index = mi


def superellipse(cx, cy, cz, hw, hh, seg, ex=2.6, axis='x'):
    """Точки сечения-суперэллипса в плоскости, перпендикулярной оси."""
    pts = []
    for k in range(seg):
        a = TAU * k / seg
        c, s = math.cos(a), math.sin(a)
        u = hw * math.copysign(abs(c) ** (2 / ex), c)
        w = hh * math.copysign(abs(s) ** (2 / ex), s)
        pts.append((cx, cy + u, cz + w) if axis == 'x' else (cx + u, cy, cz + w))
    return pts


# ---------- ирисовая диафрагма: общий расчёт лепестка ----------
# Параметры подобраны численно: 12 таких лепестков при повороте на 50° вокруг осей
# полностью перекрывают просвет радиуса 1.35, а при 0° прячутся в кольце 1.36…2.1.
IRIS_RC, IRIS_ARC, IRIS_W, IRIS_A0, IRIS_P, IRIS_PIV = 1.72, 90, 0.7, -15, 0.35, 1.87


def drone_body(P):
    """Сам дрон с раскладкой лучей и винтами; сюжет вокруг него строит вызывающий."""
    shell = mat('Корпус дрона', (0.12, 0.12, 0.13), metal=0.3, rough=0.35)
    gloss = mat('Глянец', (0.01, 0.01, 0.012), rough=0.08, coat=1.0)
    prop_m = mat('Пропеллер', (0.75, 0.76, 0.78), rough=0.35)
    batt_m = mat('Батарея', (0.2, 0.2, 0.22), metal=0.2, rough=0.5)
    led_g = mat('Индикатор зелёный', (0.1, 1.0, 0.35), emit=(0.1, 1.0, 0.35), estr=6)
    led_r = mat('Огонь красный', (1.0, 0.05, 0.05), emit=(1.0, 0.05, 0.05), estr=8)
    led_w = mat('Огонь белый', (1.0, 1.0, 1.0), emit=(1.0, 0.95, 0.9), estr=8)
    pad_m = mat('Площадка', (0.035, 0.035, 0.04), metal=0.2, rough=0.55)
    paint = mat('Разметка площадки', (0.9, 0.9, 0.9), rough=0.5)
    orange = mat('Маяк оранжевый', (1.0, 0.45, 0.05), emit=(1.0, 0.4, 0.03), estr=5)
    glass, steel, rubber = GLASS(), STEEL(), RUBBER()
    drone = empty('Дрон', P)
    drone.scale = (1.9, 1.9, 1.9)

    # фюзеляж: обтекаемый корпус из сечений-суперэллипсов
    bm = bmesh.new()
    secs = [(-0.5, 0.17, 0.07, 0.02), (-0.47, 0.23, 0.1, 0.03), (-0.36, 0.265, 0.125, 0.04),
            (-0.1, 0.28, 0.14, 0.04), (0.18, 0.27, 0.135, 0.035), (0.34, 0.225, 0.115, 0.02),
            (0.45, 0.16, 0.09, 0.01), (0.52, 0.09, 0.055, 0.005)]
    loft(bm, [[bm.verts.new(p) for p in superellipse(x, 0, zc, hw, hh, 32)] for x, hw, hh, zc in secs], mi=0)
    uvsphere(bm, (0.1, 0, 0.1), 0.4, 32, 16, scale=(1, 0.58, 0.2), mi=1)
    # вентиляционные прорези по бокам
    for s in (-1, 1):
        for k in range(7):
            box(bm, (-0.25 + k * 0.045, s * 0.272, 0.02), (0.018, 0.02, 0.07), mi=1)
    # датчики препятствий: стереопары спереди, сзади, по бокам и снизу
    def sensor(loc, d):
        q = align_z(d)
        cyl(bm, loc, 0.04, 0.03, 20, rot=q, mi=1)
        cyl(bm, Vector(loc) + Vector(d).normalized() * 0.012, 0.027, 0.012, 20, rot=q, mi=2)
    for s in (-1, 1):
        sensor((0.475, s * 0.1, 0.03), (1, 0, 0))
        sensor((-0.49, s * 0.08, 0.02), (-1, 0, 0))
        sensor((0.15 + s * 0.06, 0.278, 0.05), (0, 1, 0))
        sensor((0.15 + s * 0.06, -0.278, 0.05), (0, -1, 0))
        sensor((0.12, s * 0.07, -0.1), (0, 0, -1))
    cyl(bm, (0.2, 0, -0.1), 0.02, 0.02, 12, mi=3)
    from_bm('Фюзеляж', bm, [shell, gloss, glass, led_r], drone, bevel=0.008, bevel_seg=2)

    # батарея с рёбрами хвата и индикатором заряда
    bm = bmesh.new()
    box(bm, (-0.24, 0, 0.17), (0.38, 0.34, 0.1), mi=0)
    for k in range(6):
        box(bm, (-0.36 + k * 0.05, 0, 0.222), (0.014, 0.3, 0.01), mi=1)
    for s in (-1, 1):
        box(bm, (-0.24, s * 0.172, 0.17), (0.12, 0.012, 0.05), mi=1)
    for k in range(4):
        box(bm, (-0.432, -0.054 + k * 0.036, 0.19), (0.012, 0.022, 0.014), mi=2 if k < 3 else 1)
    cyl(bm, (-0.432, 0, 0.15), 0.018, 0.012, 14, rot=Euler((0, math.pi / 2, 0)), mi=1)
    from_bm('Батарея', bm, [batt_m, gloss, led_g], drone, bevel=0.01, bevel_seg=2)

    # подвес: рыскание → кронштейн → тангаж с камерой
    yaw = empty('Подвес рыскание', drone, loc=(0.38, 0, -0.1))
    bm = bmesh.new()
    cyl(bm, (0, 0, -0.015), 0.045, 0.03, 24, mi=0)
    box(bm, (0.0, 0.0, -0.04), (0.05, 0.19, 0.02), mi=0)
    box(bm, (0.0, 0.088, -0.1), (0.04, 0.016, 0.12), mi=0)
    cyl(bm, (0.0, 0.088, -0.13), 0.035, 0.025, 20, rot=Euler((math.pi / 2, 0, 0)), mi=1)
    from_bm('Кронштейн подвеса', bm, [shell, gloss], yaw, bevel=0.005)
    pitch = empty('Подвес тангаж', yaw, loc=(0.0, 0, -0.13))
    bm = bmesh.new()
    box(bm, (0.01, 0, 0), (0.11, 0.14, 0.1), mi=0)
    cyl(bm, (0.075, 0, 0), 0.042, 0.04, 28, rot=Euler((0, math.pi / 2, 0)), mi=1)
    cyl(bm, (0.1, 0, 0), 0.036, 0.012, 28, rot=Euler((0, math.pi / 2, 0)), mi=2)
    cyl(bm, (0.098, 0, 0), 0.044, 0.008, 28, rot=Euler((0, math.pi / 2, 0)), mi=3)
    cyl(bm, (0, -0.075, 0), 0.03, 0.02, 20, rot=Euler((math.pi / 2, 0, 0)), mi=1)
    box(bm, (-0.03, 0, 0.052), (0.03, 0.06, 0.006), mi=1)
    from_bm('Камера подвеса', bm, [shell, gloss, glass, steel], pitch, bevel=0.006, smooth=False)

    # складные антенны на корме
    ants = []
    for s in (-1, 1):
        h = empty(f'Антенна {s}', drone, loc=(-0.44, s * 0.14, 0.08))
        bm = bmesh.new()
        cyl(bm, (0, 0, 0), 0.018, 0.04, 12, rot=Euler((math.pi / 2, 0, 0)), mi=0)
        box(bm, (0, 0, 0.14), (0.035, 0.012, 0.26), mi=1)
        cyl(bm, (0, 0, 0.275), 0.0175, 0.012, 12, rot=Euler((math.pi / 2, 0, 0)), mi=1)
        from_bm(f'Антенна {s} лопасть', bm, [shell, gloss], h, bevel=0.004)
        ants.append(h)

    # убирающееся шасси
    legs = []
    for s in (-1, 1):
        h = empty(f'Шасси {s}', drone, loc=(0, s * 0.19, -0.08))
        bm = bmesh.new()
        for x in (-0.24, 0.24):
            d = Vector((0, s * 0.1, -0.24))
            cyl(bm, Vector((x, 0, 0)) + d / 2, 0.014, d.length, 10, rot=align_z(d), mi=0)
        cyl(bm, (0, s * 0.1, -0.25), 0.018, 0.82, 14, rot=Euler((0, math.pi / 2, 0)), mi=0)
        for x in (-0.41, 0.41):
            uvsphere(bm, (x, s * 0.1, -0.25), 0.022, 12, 8, mi=1)
        for x in (-0.3, 0.3):
            cyl(bm, (x, s * 0.1, -0.25), 0.024, 0.08, 14, rot=Euler((0, math.pi / 2, 0)), mi=1)
        from_bm(f'Шасси {s} полоз', bm, [shell, rubber], h, smooth=True)
        legs.append((h, s))

    # винт: профиль лопасти с толщиной, стреловидная законцовка, шаг убывает к концу
    bm_all = bmesh.new()
    NS = 16
    for flip in (0, math.pi):
        rings = []
        for i in range(NS + 1):
            t = i / NS
            r = 0.04 + 0.52 * t
            c = (0.05 + 0.065 * math.sin(math.pi * (0.2 + 0.8 * t)) ** 0.7) * (1 - t ** 5) ** 0.35 + 0.012
            beta = math.radians(26 - 17 * t)
            sweep = -0.035 * t ** 2
            th = 0.011 * (1 - 0.65 * t) + 0.002
            cam = 0.008 * (1 - 0.5 * t)
            sec = []
            us = [0, 0.08, 0.25, 0.5, 0.75, 1.0]
            for u in us:
                sec.append((u, cam * 4 * u * (1 - u) + th * 2.6 * math.sqrt(u) * (1 - u)))
            for u in reversed(us[1:-1]):
                sec.append((u, cam * 4 * u * (1 - u) - th * 0.8 * math.sqrt(u) * (1 - u)))
            ring = []
            for u, z in sec:
                y = (u - 0.35) * c + sweep
                yy = y * math.cos(beta) - z * math.sin(beta)
                zz = y * math.sin(beta) + z * math.cos(beta)
                ring.append(bm_all.verts.new((r * math.cos(flip) - yy * math.sin(flip),
                                              r * math.sin(flip) + yy * math.cos(flip), zz)))
            rings.append(ring)
        loft(bm_all, rings, mi=0)
    cyl(bm_all, (0, 0, 0), 0.036, 0.045, 20, mi=1)
    uvsphere(bm_all, (0, 0, 0.022), 0.03, 16, 8, scale=(1, 1, 0.5), mi=1)
    prop_src = from_bm('_пропеллер', bm_all, [prop_m, steel], None, smooth=True)
    prop_src.hide_render = True; prop_src.hide_viewport = True

    for i, (sx, sy) in enumerate(((1, 1), (1, -1), (-1, 1), (-1, -1))):
        hinge = empty(f'Шарнир луча {i + 1}', drone, loc=(sx * 0.33, sy * 0.2, -0.02 if sx < 0 else 0.0))
        bm = bmesh.new()
        box(bm, (0.5, 0, 0), (1.0, 0.07, 0.055), mi=0)
        box(bm, (0.5, 0, -0.03), (0.8, 0.04, 0.01), mi=2)
        cyl(bm, (0.02, 0, 0), 0.05, 0.08, 20, mi=1)
        cyl(bm, (1.0, 0, 0.03), 0.1, 0.12, 28, mi=1)
        cyl(bm, (1.0, 0, 0.11), 0.105, 0.05, 28, mi=0)
        for k in range(16):
            a = TAU * k / 16
            box(bm, (1.0 + 0.1 * math.cos(a), 0.1 * math.sin(a), 0.03), (0.02, 0.008, 0.1), rot=Euler((0, 0, a)), mi=0)
        cyl(bm, (1.0, 0, -0.04), 0.03, 0.025, 14, mi=3)
        from_bm(f'Луч {i + 1}', bm, [shell, steel, gloss, led_r if sx > 0 else led_g], hinge, bevel=0.01)
        prop = empty(f'Пропеллер {i + 1}', hinge, loc=(1.0, 0, 0.15))
        dup(prop_src, f'Лопасти {i + 1}', prop)
        open_a = math.atan2(sy, sx)
        fold_a = 0.0 if sx > 0 else math.pi
        # задние лучи сложены на 180°: раскрытие должно идти к 135° и 225°, а не к −135°,
        # иначе интерполяция через ноль проворачивает луч на 315° сквозь корпус
        if sx < 0 and open_a < 0:
            open_a += TAU
        a0, a1 = (3, 22) if sx > 0 else (7, 26)
        key(hinge, F0, rot=(0, 0, fold_a)); key(hinge, a0, rot=(0, 0, fold_a)); key(hinge, a1, rot=(0, 0, open_a))
        key(prop, F0, rot=(0, 0, 0), interp='LINEAR'); key(prop, 18, rot=(0, 0, 0), interp='LINEAR')
        key(prop, F1, rot=(0, 0, TAU * 40 * (1 if sx * sy > 0 else -1)), interp='LINEAR')

    return dict(drone=drone, yaw=yaw, pitch=pitch, ants=ants, legs=legs,
                pad_m=pad_m, paint=paint, orange=orange, steel=steel)
