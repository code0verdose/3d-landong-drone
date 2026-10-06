# Общие части сюжета дрона: сам дрон, стартовая площадка, коробка и расчёт полёта.
# Полёт считается покадрово: позиция — гладкая монотонная кривая по опорным точкам, курс, тангаж
# и крен выводятся из скорости и ускорения, как у настоящего мультикоптера (наклон вперёд при разгоне,
# назад при торможении, крен в повороте). Карта района и камера — в drone_world.py.
import math
import bpy, bmesh
from mathutils import Vector, Euler
from common import *
from drone_model import drone_body, CYAN

G = -1.27                      # уровень стартовой площадки (крыша склада)
BW, BD, BH = 1.2, 0.9, 0.75    # коробка 40 × 30 × 25 см (1 м = 3 единицы сцены)
BELLY = 0.27                   # от центра дрона до брюха, где крепится трос
PAD_R = 2.4                    # стартовая площадка ≈ 1.6 м в диаметре
Z0 = G + 0.67                  # полозья стоят на площадке
H1 = G + 2.2                   # зависание над коробкой при подборе
START = Vector((0.0, -1.55, G + BH / 2))

def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def wrap_angle(a):
    return (a + math.pi) % TAU - math.pi


def monotone(xs, ys):
    """Монотонная кубическая интерполяция (Фрич — Карлсон): без выбросов, зависания остаются ровными."""
    n = len(xs)
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [0.0] * n
    for i in range(1, n - 1):
        m[i] = 0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2
    for i in range(n - 1):
        if d[i] == 0:
            m[i] = m[i + 1] = 0.0
            continue
        a, b = m[i] / d[i], m[i + 1] / d[i]
        s = a * a + b * b
        if s > 9:
            t = 3 / math.sqrt(s)
            m[i], m[i + 1] = t * a * d[i], t * b * d[i]

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        i = max(k for k in range(n - 1) if xs[k] <= x)
        h = xs[i + 1] - xs[i]
        t = (x - xs[i]) / h
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
                + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1])
    return f


def start_pad(P, b):
    """Стартовая площадка ≈ 1.6 м: основание, разметка, огни по кругу."""
    k = PAD_R / 1.7
    bm = bmesh.new()
    disk_prism(bm, circ(1.7 * k, 128), G - 0.07, G, mi=0)
    ring_prism(bm, circ(1.74 * k, 128), circ(1.7 * k, 128), G - 0.08, G + 0.005, mi=1)
    ring_prism(bm, circ(1.6 * k, 128), circ(1.56 * k, 128), G, G + 0.008, mi=2)
    ring_prism(bm, circ(0.78 * k, 96), circ(0.72 * k, 96), G, G + 0.005, mi=3)
    for j in range(12):
        a = TAU * j / 12
        box(bm, (1.2 * k * math.cos(a), 1.2 * k * math.sin(a), G + 0.002), (0.55 * k, 0.012, 0.006), rot=Euler((0, 0, a)), mi=1)
    # буква H строго в центре круга
    for y in (-0.22, 0.22):
        box(bm, (0, y * k, G + 0.003), (0.62 * k, 0.1 * k, 0.008), mi=3)
    box(bm, (0, 0, G + 0.003), (0.1 * k, 0.36 * k, 0.008), mi=3)
    for j in range(8):
        a = TAU * j / 8 + TAU / 16
        cyl(bm, (1.66 * k * math.cos(a), 1.66 * k * math.sin(a), G + 0.015), 0.035 * k, 0.03, 14, mi=4)
    from_bm('Посадочная площадка', bm, [b['pad_m'], b['steel'], CYAN(), b['paint'], b['orange']], P, smooth=False)


def parcel_obj(P):
    kraft = mat('Картон', (0.62, 0.45, 0.27), rough=0.85)
    tape = mat('Скотч', (1.0, 0.45, 0.08), rough=0.4, emit=(1.0, 0.4, 0.05), estr=0.6)
    label = mat('Этикетка', (0.95, 0.95, 0.93), rough=0.6)
    bm = bmesh.new()
    box(bm, (0, 0, 0), (BW, BD, BH), mi=0)
    box(bm, (0, 0, BH / 2 + 0.002), (BW + 0.004, 0.09, 0.004), mi=1)
    box(bm, (BW / 2 + 0.002, 0, 0), (0.004, 0.09, BH + 0.004), mi=1)
    box(bm, (-BW / 2 - 0.002, 0, 0), (0.004, 0.09, BH + 0.004), mi=1)
    box(bm, (0.25, -BD / 2 - 0.002, 0.06), (0.36, 0.004, 0.22), mi=2)
    return from_bm('Посылка', bm, [kraft, tape, label], P, loc=START, bevel=0.01)


def bake_flight(drone, pts):
    """Позиция по монотонной кривой; курс по направлению полёта, тангаж и крен из скорости и ускорения."""
    fs = [f for f, _ in pts]
    fx = monotone(fs, [p[0] for _, p in pts])
    fy = monotone(fs, [p[1] for _, p in pts])
    fz = monotone(fs, [p[2] for _, p in pts])
    pos = {f: Vector((fx(f), fy(f), fz(f))) for f in range(F0 - 1, F1 + 2)}
    yaw = pitch = roll = 0.0
    out = {}
    for f in range(F0, F1 + 1):
        v = (pos[f + 1] - pos[f - 1]) / 2
        a = pos[f + 1] - 2 * pos[f] + pos[f - 1]
        sp = math.hypot(v.x, v.y)
        w = clamp((sp - 0.05) / 0.25)
        if sp > 1e-4:
            yaw += wrap_angle(math.atan2(v.y, v.x) - yaw) * 0.16 * w
        c, s = math.cos(yaw), math.sin(yaw)
        v_f = v.x * c + v.y * s
        a_f = a.x * c + a.y * s
        a_l = -a.x * s + a.y * c
        # нос вниз — вращение +Y; разгон и крейсер наклоняют вперёд, торможение — назад
        tp = clamp(0.3 * v_f + 7.0 * a_f, -0.3, 0.34)
        # поворот влево (ускорение в +Y корпуса) — крен влево, это вращение −X
        tr = clamp(-7.0 * a_l, -0.28, 0.28)
        pitch += (tp - pitch) * 0.22
        roll += (tr - roll) * 0.22
        key(drone, f, loc=tuple(pos[f]), rot=(roll, pitch, yaw), interp='LINEAR')
        out[f] = (pos[f].copy(), yaw)
    return out
