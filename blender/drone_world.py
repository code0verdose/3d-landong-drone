# Полная ночная карта района для сайта дрона и режиссура камеры по секциям страницы.
#
# Карта в метрах (объекты окружения масштабируются ×3 — 1 м = 3 единицы сцены, как у дрона):
#   запад  — логистический склад 36 × 24 × 8 м (на крыше стартовая площадка), двор с фурами,
#            жилой дом в 8 этажей вдоль маршрута, офисы и склады, набережная;
#   река   — 36 м шириной, вода на 4 м ниже улицы, мост с пробкой на главной улице (север);
#   восток — набережная, парк с фонтаном, жилая улица, дом получателя с крыльцом и мишенью;
#   фон    — город по периметру, уходит в туман на сайте.
# Ничего не появляется и не исчезает: мир сплошной, камера выбирает ракурсы.
#
# Камера: в каждой секции — композиция относительно дрона (азимут, высота, дистанция и смещение
# в кадре, чтобы дрон не попадал под карточку текста); между секциями параметры плавно
# переходят друг в друга, поэтому дрон всё время в кадре. Запекается в пустышки «Камера»
# и «Цель камеры», сайт ставит по ним камеру. Проверки: камера не в здании, обзор не закрыт,
# дрон в кадре, в секциях — не под текстом.
import math, random
import bpy, bmesh
from mathutils import Vector, Euler
from mathutils.bvhtree import BVHTree
from common import *
from drone_flight import drone_body, start_pad, parcel_obj, bake_flight, BW, BD, BH, BELLY, START, G, Z0, H1

M = 3.0
ROOF_H = 8.0                        # высота склада: на его крыше стартовая площадка
S = G - ROOF_H * M                  # улица в единицах сцены
VFOV = math.radians(34)             # как у камеры сайта
ASPECT = 1.6                        # композиция под десктоп 16:10


def U(x, y, z):
    """Метры карты → единицы сцены."""
    return Vector((x * M, y * M, S + z * M))


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- материалы (ночь)

MN = ['asphalt', 'road', 'sidewalk', 'mark', 'grass', 'water', 'stone', 'concrete', 'profile', 'roof', 'skylight', 'winsoft',
      'metal', 'win', 'win2', 'dark', 'neon', 'mint', 'lamp', 'red', 'leaf', 'leaf2', 'trunk', 'wood',
      'white', 'brick', 'door', 'glass', 'tyre', 'head', 'tail', 'solar', 'trailer', 'yellow', 'reflect',
      'car0', 'car1', 'car2', 'car3', 'car4']
I = {k: n for n, k in enumerate(MN)}
CARS = ['car0', 'car1', 'car2', 'car3', 'car4']


def world_mats():
    p = 'Город · '
    d = {
        'asphalt': mat(p + 'асфальт', (0.03, 0.03, 0.034), rough=0.92),
        'road': mat(p + 'дорога', (0.02, 0.02, 0.024), rough=0.55),
        'sidewalk': mat(p + 'тротуар', (0.07, 0.07, 0.074), rough=0.9),
        'mark': mat(p + 'разметка', (0.8, 0.8, 0.74), rough=0.6, emit=(0.8, 0.8, 0.74), estr=0.35),
        'grass': mat(p + 'газон', (0.022, 0.05, 0.026), rough=0.95),
        'water': mat(p + 'вода', (0.008, 0.016, 0.03), metal=0.2, rough=0.05, coat=1.0),
        'stone': mat(p + 'камень', (0.075, 0.072, 0.07), rough=0.85),
        'concrete': mat(p + 'бетон', (0.085, 0.085, 0.09), rough=0.9),
        'profile': mat(p + 'профлист', (0.12, 0.13, 0.14), metal=0.5, rough=0.5),
        'roof': mat(p + 'кровля', (0.032, 0.032, 0.036), rough=0.75),
        'skylight': mat(p + 'зенитный фонарь', (0.03, 0.04, 0.06), rough=0.5, emit=(0.35, 0.5, 0.75), estr=0.22),
        'winsoft': mat(p + 'окно мягкое', (0.9, 0.66, 0.42), emit=(0.95, 0.66, 0.4), estr=0.75),
        'metal': mat(p + 'металл', (0.3, 0.31, 0.33), metal=0.8, rough=0.4),
        'win': mat(p + 'окно тёплое', (1.0, 0.72, 0.42), emit=(1.0, 0.68, 0.38), estr=1.3),
        'win2': mat(p + 'окно холодное', (0.16, 0.2, 0.3), emit=(0.4, 0.52, 0.8), estr=0.32),
        'dark': mat(p + 'окно тёмное', (0.015, 0.018, 0.025), rough=0.45, coat=0.15),
        'neon': mat(p + 'неон', (1.0, 0.45, 0.1), emit=(1.0, 0.42, 0.08), estr=3.5),
        'mint': mat(p + 'подсветка', (0.26, 0.85, 0.63), emit=(0.26, 0.85, 0.63), estr=3.0),
        'lamp': mat(p + 'фонарь', (1.0, 0.75, 0.45), emit=(1.0, 0.7, 0.4), estr=6.0),
        'red': mat(p + 'заградогонь', (1.0, 0.05, 0.04), emit=(1.0, 0.05, 0.04), estr=5.0),
        'leaf': mat(p + 'листва', (0.04, 0.1, 0.05), rough=0.8),
        'leaf2': mat(p + 'хвоя', (0.02, 0.07, 0.05), rough=0.8),
        'trunk': mat(p + 'ствол', (0.1, 0.065, 0.04), rough=0.9),
        'wood': mat(p + 'дерево', (0.2, 0.11, 0.055), rough=0.7),
        'white': mat(p + 'штукатурка', (0.2, 0.195, 0.19), rough=0.92),
        'brick': mat(p + 'кирпич', (0.11, 0.045, 0.032), rough=0.9),
        'door': mat(p + 'дверь', (0.05, 0.045, 0.04), rough=0.3, coat=0.6),
        'glass': mat(p + 'стекло авто', (0.01, 0.012, 0.016), rough=0.3, coat=0.3),
        'tyre': mat(p + 'шина', (0.01, 0.01, 0.01), rough=0.9),
        'head': mat(p + 'фары', (1.0, 0.95, 0.85), emit=(1.0, 0.95, 0.85), estr=5.0),
        'tail': mat(p + 'стоп-сигналы', (1.0, 0.05, 0.03), emit=(1.0, 0.05, 0.03), estr=3.0),
        'solar': mat(p + 'солнечная панель', (0.02, 0.03, 0.08), metal=0.4, rough=0.5),
        'trailer': mat(p + 'фура', (0.3, 0.31, 0.33), rough=0.6),
        'yellow': mat(p + 'разметка жёлтая', (0.8, 0.55, 0.05), rough=0.5),
        'reflect': mat(p + 'блик на воде', (1.0, 0.72, 0.45), emit=(1.0, 0.7, 0.42), estr=1.1),
        'car0': mat(p + 'кузов синий', (0.02, 0.05, 0.12), metal=0.6, rough=0.3, coat=1.0),
        'car1': mat(p + 'кузов серебро', (0.25, 0.25, 0.26), metal=0.7, rough=0.3, coat=1.0),
        'car2': mat(p + 'кузов белый', (0.45, 0.45, 0.46), metal=0.3, rough=0.3, coat=1.0),
        'car3': mat(p + 'кузов красный', (0.22, 0.02, 0.02), metal=0.5, rough=0.3, coat=1.0),
        'car4': mat(p + 'кузов чёрный', (0.012, 0.012, 0.015), metal=0.6, rough=0.3, coat=1.0),
    }
    return [d[k] for k in MN]


# ---------------------------------------------------------------- примитивы в метрах

LIGHTS = []                          # (x, y, z основания, высота) — пятна света от фонарей на сайте


def B(bm, x0, x1, y0, y1, z0, z1, mi, rot=None):
    box(bm, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), rot=rot, mi=mi)


def facade(bm, axis, fixed, a0, a1, z0, z1, facing, rng, lit=0.45, cool=0.15, floor=3.0, pitch=2.8,
           w=1.4, h=1.6, first=0.8):
    """Окна по фасаду: axis 'x' — фасад вдоль X на y = fixed, 'y' — вдоль Y на x = fixed."""
    floors = max(1, int((z1 - z0 - first) // floor))
    n = max(1, int((a1 - a0) // pitch))
    step = (a1 - a0) / n
    for f in range(floors):
        zc = z0 + first + f * floor + floor * 0.5
        if zc + h / 2 > z1 - 0.3:
            break
        for k in range(n):
            a = a0 + step * (k + 0.5)
            r = rng.random()
            mi = I['win'] if r < lit else I['win2'] if r < lit + cool else I['dark']
            if axis == 'x':
                box(bm, (a, fixed + facing * 0.06, zc), (w, 0.12, h), mi=mi)
            else:
                box(bm, (fixed + facing * 0.06, a, zc), (0.12, w, h), mi=mi)


def roof_kit(bm, x0, x1, y0, y1, h, rng, antenna=0.3):
    for (a0, a1, b0, b1) in ((x0, x1, y0, y0 + 0.25), (x0, x1, y1 - 0.25, y1), (x0, x0 + 0.25, y0, y1), (x1 - 0.25, x1, y0, y1)):
        B(bm, a0, a1, b0, b1, h, h + 0.7, I['concrete'])
    for _ in range(rng.randint(1, 3)):
        cx = rng.uniform(x0 + 2, x1 - 2)
        cy = rng.uniform(y0 + 2, y1 - 2)
        B(bm, cx - 0.8, cx + 0.8, cy - 0.55, cy + 0.55, h, h + 1.0, I['metal'])
        cyl(bm, (cx, cy, h + 1.05), 0.3, 0.1, 10, mi=I['roof'])
    if rng.random() < antenna:
        ax, ay = x0 + 1.2, y1 - 1.2
        cyl(bm, (ax, ay, h + 2.5), 0.05, 5.0, 6, mi=I['metal'])
        uvsphere(bm, (ax, ay, h + 5.05), 0.12, 8, 6, mi=I['red'])


def building(bm, x0, x1, y0, y1, h, rng, wall='concrete', sides='SEWN', lit=0.45, floor=3.0, kit=True, first=0.8):
    B(bm, x0, x1, y0, y1, 0, h, I[wall])
    for sd in sides:
        if sd == 'S':
            facade(bm, 'x', y0, x0 + 0.6, x1 - 0.6, 0, h, -1, rng, lit, floor=floor, first=first)
        elif sd == 'N':
            facade(bm, 'x', y1, x0 + 0.6, x1 - 0.6, 0, h, 1, rng, lit, floor=floor, first=first)
        elif sd == 'W':
            facade(bm, 'y', x0, y0 + 0.6, y1 - 0.6, 0, h, -1, rng, lit, floor=floor, first=first)
        elif sd == 'E':
            facade(bm, 'y', x1, y0 + 0.6, y1 - 0.6, 0, h, 1, rng, lit, floor=floor, first=first)
    if kit:
        roof_kit(bm, x0, x1, y0, y1, h, rng, antenna=0.4 if h > 20 else 0.15)


def pitched_house(bm, x0, x1, y0, y1, h, rise, rng, facing, wall='white'):
    """Двускатный дом: стены, крыша, фронтоны, окна, дверь на улицу (facing −1 — на юг)."""
    B(bm, x0, x1, y0, y1, 0, h, I[wall])
    d = y1 - y0
    ang = math.atan2(rise, d / 2)
    L = math.hypot(d / 2, rise) + 0.6
    cx = (x0 + x1) / 2
    for s in (-1, 1):
        box(bm, (cx, (y0 + y1) / 2 + s * d / 4, h + rise / 2), (x1 - x0 + 0.8, L, 0.22),
            rot=Euler((s * -ang, 0, 0)), mi=I['roof'] if wall == 'white' else I['brick'])
    for x in (x0, x1):
        v = [bm.verts.new((x, y0, h)), bm.verts.new((x, y1, h)), bm.verts.new((x, (y0 + y1) / 2, h + rise))]
        f = bm.faces.new(v if x == x1 else list(reversed(v)))
        f.material_index = I[wall]
    B(bm, x0 + (x1 - x0) * 0.7, x0 + (x1 - x0) * 0.7 + 0.7, (y0 + y1) / 2 + 0.6, (y0 + y1) / 2 + 1.3, h, h + rise + 0.8, I['brick'])
    fy = y0 if facing < 0 else y1
    facade(bm, 'x', fy, x0 + 0.8, x1 - 0.8, 0, h, facing, rng, lit=0.55, floor=2.9, pitch=2.9, first=0.6)
    B(bm, cx - 0.5, cx + 0.5, fy + facing * 0.05 - 0.04, fy + facing * 0.05 + 0.04, 0.0, 2.1, I['door'])


def tree(bm, x, y, h, rng, kind=None):
    kind = kind or ('fir' if rng.random() < 0.3 else 'oak')
    cyl(bm, (x, y, h * 0.22), 0.1 + h * 0.012, h * 0.44, 7, mi=I['trunk'])
    if kind == 'fir':
        for k in range(3):
            z = h * (0.28 + k * 0.2)
            cyl(bm, (x, y, z + h * 0.16), h * (0.24 - k * 0.055), h * 0.34, 9, r2=0.05, mi=I['leaf2'])
    else:
        ico(bm, (x, y, h * 0.64), h * 0.27, sub=1, scale=(1, 1, 0.85), mi=I['leaf'])
        ico(bm, (x + h * 0.12, y - h * 0.08, h * 0.5), h * 0.19, sub=1, mi=I['leaf'])


def lamp(bm, x, y, h=7.0, dx=0.0, dy=0.0, z0=0.0):
    """Фонарь со штангой в сторону дороги; позиция уходит в LIGHTS для пятна света на сайте."""
    cyl(bm, (x, y, z0 + h / 2), 0.07, h, 8, mi=I['metal'])
    ax, ay = x + dx * 1.1, y + dy * 1.1
    if dx or dy:
        B(bm, min(x, ax) - 0.05, max(x, ax) + 0.05, min(y, ay) - 0.05, max(y, ay) + 0.05, z0 + h - 0.05, z0 + h + 0.05, I['metal'])
    B(bm, ax - 0.25, ax + 0.25, ay - 0.14, ay + 0.14, z0 + h - 0.16, z0 + h - 0.04, I['lamp'])
    LIGHTS.append((ax, ay, z0, h))


def car(bm, x, y, dirx, rng, color=None, z0=0.0):
    L = rng.uniform(4.2, 4.8)
    W = 1.8
    mi = I[color or rng.choices(CARS, weights=(25, 18, 8, 14, 35))[0]]
    B(bm, x - L / 2, x + L / 2, y - W / 2, y + W / 2, z0 + 0.3, z0 + 1.0, mi)
    cl = L * 0.5
    cx = x - dirx * L * 0.06
    B(bm, cx - cl / 2, cx + cl / 2, y - W / 2 + 0.12, y + W / 2 - 0.12, z0 + 1.0, z0 + 1.5, I['glass'])
    for wx in (x - L * 0.32, x + L * 0.32):
        for s in (-1, 1):
            cyl(bm, (wx, y + s * (W / 2 - 0.08), z0 + 0.33), 0.33, 0.22, 10, rot=Euler((math.pi / 2, 0, 0)), mi=I['tyre'])
    front, back = x + dirx * L / 2, x - dirx * L / 2
    for s in (-1, 1):
        box(bm, (front + dirx * 0.02, y + s * 0.6, z0 + 0.74), (0.06, 0.34, 0.14), mi=I['head'])
        box(bm, (back - dirx * 0.02, y + s * 0.64, z0 + 0.8), (0.06, 0.3, 0.12), mi=I['tail'])


def truck(bm, x, y0, rng):
    """Фура у ворот склада: полуприцеп вдоль Y кабиной на юг."""
    B(bm, x - 1.25, x + 1.25, y0 - 13.6, y0, 1.2, 4.0, I['trailer'])
    B(bm, x - 1.25, x + 1.25, y0 - 16.2, y0 - 13.9, 0.6, 3.4, I['car1'])
    B(bm, x - 1.15, x + 1.15, y0 - 16.25, y0 - 15.9, 2.1, 3.1, I['glass'])
    for wy in (y0 - 1.5, y0 - 2.8, y0 - 11.0, y0 - 14.8):
        for s in (-1, 1):
            cyl(bm, (x + s * 1.05, wy, 0.5), 0.5, 0.3, 10, rot=Euler((0, math.pi / 2, 0)), mi=I['tyre'])
    for s in (-1, 1):
        box(bm, (x + s * 0.8, y0 - 16.28, 1.0), (0.3, 0.06, 0.18), mi=I['head'])


def bench(bm, x, y, along='x'):
    if along == 'x':
        B(bm, x - 0.9, x + 0.9, y - 0.25, y + 0.25, 0.42, 0.48, I['wood'])
        B(bm, x - 0.9, x + 0.9, y + 0.2, y + 0.26, 0.48, 0.9, I['wood'])
    else:
        B(bm, x - 0.25, x + 0.25, y - 0.9, y + 0.9, 0.42, 0.48, I['wood'])
        B(bm, x + 0.2, x + 0.26, y - 0.9, y + 0.9, 0.48, 0.9, I['wood'])


def road_x(bm, x0, x1, y0, y1, lanes=2):
    """Дорога вдоль X: полотно, осевая двойная, пунктир полос, тротуары."""
    B(bm, x0, x1, y0, y1, 0.0, 0.02, I['road'])
    cy = (y0 + y1) / 2
    for s in (-0.12, 0.12):
        B(bm, x0, x1, cy + s - 0.05, cy + s + 0.05, 0.02, 0.03, I['mark'])
    if lanes == 4:
        for ly in (y0 + (cy - y0) / 2, cy + (y1 - cy) / 2):
            x = x0 + 1.0
            while x < x1 - 3:
                B(bm, x, x + 3.0, ly - 0.06, ly + 0.06, 0.02, 0.03, I['mark'])
                x += 9.0
    B(bm, x0, x1, y0 - 2.2, y0, 0.0, 0.15, I['sidewalk'])
    B(bm, x0, x1, y1, y1 + 2.2, 0.0, 0.15, I['sidewalk'])


# ---------------------------------------------------------------- куски карты

def ground(bm, rng):
    # берега, вода, набережные
    B(bm, -130, 42, -110, 130, -0.3, 0.0, I['asphalt'])
    B(bm, 78, 260, -110, 130, -0.3, 0.0, I['asphalt'])
    B(bm, 42, 78, -110, 130, -4.1, -4.0, I['water'])
    for wx0, wx1 in ((41.4, 42.2), (77.8, 78.6)):
        B(bm, wx0, wx1, -110, 130, -4.1, 0.9, I['stone'])
    for x in (37.5, 82.5):
        B(bm, x - 4.5, x + 4.5, -110, 130, 0.0, 0.06, I['stone'])
    # главная улица с мостом (север) и жилая улица (восток)
    road_x(bm, -130, 36, 27, 37, lanes=4)
    road_x(bm, 84, 260, 27, 37, lanes=4)
    road_x(bm, 86, 260, -27, -19, lanes=2)
    # двор склада и газоны у набережной
    B(bm, -22, 22, -38, -12, 0.0, 0.02, I['sidewalk'])
    for k in range(6):
        x = -14 + k * 5.6
        B(bm, x - 0.06, x + 0.06, -26, -12.2, 0.02, 0.03, I['yellow'])
    # блики городских огней на воде — полосы к камере
    for k in range(40):
        r = random.Random(700 + k)
        x = r.uniform(43.5, 76.5)
        y0 = r.uniform(-60, 22)
        B(bm, x - 0.08, x + 0.08, y0, y0 + r.uniform(2, 7), -3.99, -3.985, I['reflect'])


def west_bank(bm, rng):
    # склад старта: профлист, ворота с отбойниками и фонарями, светящаяся полоса-логотип
    B(bm, -18, 18, -12, 12, 0.0, ROOF_H - 0.03, I['profile'])
    for k in range(9):
        z = 0.9 + k * 0.8
        B(bm, -18.05, 18.05, -12.05, 12.05, z, z + 0.04, I['concrete'])
    for k in range(4):
        x = -13 + k * 7.5
        B(bm, x - 1.6, x + 1.6, -12.08, -12.0, 0.0, 3.2, I['door'])
        B(bm, x - 1.9, x + 1.9, -12.3, -12.0, 1.1, 1.3, I['yellow'])
        B(bm, x - 0.2, x + 0.2, -12.18, -12.05, 3.6, 3.8, I['lamp'])
        LIGHTS.append((x, -14.5, 0.0, 4.0))
    B(bm, -8, 8, -12.1, -12.02, 5.6, 6.1, I['neon'])
    facade(bm, 'y', 18, -10, 10, 0, 7.5, 1, rng, lit=0.6, floor=3.5, first=1.0)
    # крыша: парапет, фонари зенитные, вентиляция, выход, антенна с заградогнём
    top = ROOF_H - 0.03
    for (a0, a1, b0, b1) in ((-18, 18, -12, -11.7), (-18, 18, 11.7, 12), (-18, -17.7, -12, 12), (17.7, 18, -12, 12)):
        B(bm, a0, a1, b0, b1, top, top + 0.8, I['concrete'])
    for sy in (-7.5, 7.0):
        for sx in (-12, 9):
            B(bm, sx - 3.5, sx + 3.5, sy - 0.6, sy + 0.6, top, top + 0.35, I['skylight'])
    for vx, vy in ((-14, -9), (-8.5, 10.0), (14, -9), (6, 9.5), (-6, -9.6)):
        B(bm, vx - 0.9, vx + 0.9, vy - 0.6, vy + 0.6, top, top + 1.1, I['metal'])
        cyl(bm, (vx, vy, top + 1.15), 0.35, 0.1, 12, mi=I['roof'])
    # станция дронов вокруг стартовой площадки: соседняя площадка, шкаф зарядки, разметка, дорожки
    for (a0, a1, b0, b1) in ((-1.4, 1.4, -2.0, -1.92), (-1.4, 1.4, 1.2, 1.28), (-1.4, -1.32, -2.0, 1.28), (1.32, 1.4, -2.0, 1.28)):
        B(bm, a0, a1, b0, b1, top, top + 0.012, I['yellow'])
    px, py = 1.8, 5.6
    cyl(bm, (px, py, top + 0.03), 0.8, 0.06, 40, mi=I['roof'])
    ring = [(x + px, y + py) for x, y in circ(0.76, 40)]
    ring_in = [(x + px, y + py) for x, y in circ(0.7, 40)]
    ring_prism(bm, ring, ring_in, top + 0.06, top + 0.07, mi=I['mint'])
    for (a0, a1, b0, b1) in ((px - 1.6, px + 1.6, py - 1.6, py - 1.5), (px - 1.6, px + 1.6, py + 1.5, py + 1.6),
                             (px - 1.6, px - 1.5, py - 1.6, py + 1.6), (px + 1.5, px + 1.6, py - 1.6, py + 1.6)):
        B(bm, a0, a1, b0, b1, top, top + 0.012, I['yellow'])
    B(bm, 2.3, 3.5, 2.6, 3.4, top, top + 1.6, I['concrete'])
    B(bm, 2.28, 3.52, 2.56, 2.62, top + 0.3, top + 1.4, I['dark'])
    B(bm, 2.35, 3.45, 2.54, 2.58, top + 1.45, top + 1.52, I['mint'])
    B(bm, 2.4, 2.6, 2.52, 2.57, top + 0.9, top + 1.0, I['neon'])
    B(bm, -0.5, 0.5, 2.4, 12, top, top + 0.02, I['sidewalk'])
    B(bm, -12.0, -0.5, 8.5, 9.5, top, top + 0.02, I['sidewalk'])
    # выход на крышу — на западном краю, чтобы не стоять за дроном в кадре взлёта
    B(bm, -15.0, -12.0, 7.5, 10.5, top, top + 2.8, I['concrete'])
    B(bm, -14.0, -13.0, 7.46, 7.52, top, top + 2.1, I['door'])
    B(bm, -13.7, -13.3, 7.42, 7.5, top + 2.3, top + 2.45, I['lamp'])
    cyl(bm, (-16.3, -10.2, top + 3.0), 0.06, 6.0, 6, mi=I['metal'])
    uvsphere(bm, (-16.3, -10.2, top + 6.05), 0.13, 8, 6, mi=I['red'])
    # двор: две фуры у ворот, контейнеры, будка охраны, забор
    truck(bm, -13, -12.3, rng)
    truck(bm, 2, -12.3, rng)
    for k, (cx, cy, cz) in enumerate(((10, -28, 0), (10, -31, 0), (10, -28, 2.6))):
        B(bm, cx - 3.0, cx + 3.0, cy - 1.2, cy + 1.2, cz, cz + 2.6, I[['car3', 'car0', 'trailer'][k]])
    B(bm, -21, -18, -36, -33, 0, 2.6, I['white'])
    facade(bm, 'x', -36, -20.5, -18.5, 0, 2.6, -1, rng, lit=1.0, floor=2.5, first=0.2)
    B(bm, -24, 24, -38.1, -37.9, 0, 1.8, I['metal'])
    lamp(bm, -16, -20, 8, dx=1)
    lamp(bm, 16, -20, 8, dx=-1)
    # жилой дом вдоль маршрута: 8 этажей, балконы на юг — окна, мимо которых летит дрон
    B(bm, 22, 36, 4.3, 22, 0, 24, I['white'])
    facade(bm, 'x', 4.3, 22.6, 35.4, 3.0, 24, -1, rng, lit=0.55, cool=0.06, floor=3.0, pitch=3.5, w=1.6, h=1.8, first=0.4)
    facade(bm, 'y', 36, 5, 21.4, 0, 24, 1, rng, lit=0.5)
    facade(bm, 'y', 22, 5, 21.4, 0, 24, -1, rng, lit=0.5)
    for f in range(1, 8):
        z = 3.0 * f + 0.1
        for bx in (24.6, 29.0, 33.4):
            B(bm, bx - 1.6, bx + 1.6, 3.1, 4.3, z - 0.12, z, I['concrete'])
            B(bm, bx - 1.6, bx + 1.6, 3.1, 3.18, z, z + 1.0, I['glass'])
    B(bm, 22.3, 35.7, 4.1, 4.3, 0.4, 2.8, I['win'])
    B(bm, 25, 33, 4.02, 4.1, 3.0, 3.5, I['neon'])
    roof_kit(bm, 22, 36, 4.3, 22, 24, rng, antenna=1.0)
    # офис и склады к северу, склад к западу
    building(bm, 4, 20, 15, 25, 13, rng, wall='concrete', sides='SE', lit=0.5, floor=3.3)
    building(bm, -44, -2, 15, 25, 10, rng, wall='profile', sides='S', lit=0.25, floor=5.0, first=2.0)
    building(bm, -62, -24, -30, 10, 9, rng, wall='profile', sides='SE', lit=0.2, floor=4.5, first=2.0)
    # набережная: деревья и фонари
    for y in range(-60, 26, 9):
        tree(bm, 37.2, y + rng.uniform(-1, 1), rng.uniform(8, 10), rng, 'oak')
    for y in range(-58, 26, 12):
        lamp(bm, 40.6, y, 5.5)
    # главная улица: фонари, припаркованные машины
    for x in range(-110, 36, 22):
        lamp(bm, x, 25.6, 8, dy=1)
        lamp(bm, x + 11, 38.4, 8, dy=-1)
    for x in (-96, -70, -47, -20, 6):
        car(bm, x, 28.3, 1, rng)


def bridge(bm, rng):
    """Мост на главной улице поперёк реки: настил, арки, перила, фонари, пробка с фарами."""
    B(bm, 36, 84, 26.4, 37.6, -0.7, 0.02, I['stone'])
    B(bm, 36, 84, 27, 37, 0.02, 0.04, I['road'])
    for s in (-0.12, 0.12):
        B(bm, 36, 84, 32 + s - 0.05, 32 + s + 0.05, 0.04, 0.05, I['mark'])
    for px in (54, 66):
        B(bm, px - 1.2, px + 1.2, 26.8, 37.2, -4.1, -0.7, I['stone'])
    # арки: ступенчатые своды между опорами
    for a0, a1 in ((42, 54), (54, 66), (66, 78)):
        n = 7
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            zc = -0.7 - 2.6 * (1 - (2 * ((t0 + t1) / 2) - 1) ** 2)
            B(bm, a0 + (a1 - a0) * t0, a0 + (a1 - a0) * t1, 26.6, 26.9, zc, -0.7, I['stone'])
            B(bm, a0 + (a1 - a0) * t0, a0 + (a1 - a0) * t1, 37.1, 37.4, zc, -0.7, I['stone'])
    for y in (26.5, 37.5):
        B(bm, 36, 84, y - 0.08, y + 0.08, 0.9, 1.05, I['metal'])
        for x in range(36, 85, 2):
            B(bm, x - 0.04, x + 0.04, y - 0.04, y + 0.04, 0.0, 0.95, I['metal'])
    for x in range(40, 84, 8):
        lamp(bm, x, 26.7, 6.5, dy=1)
        lamp(bm, x + 4, 37.3, 6.5, dy=-1)
        for yy in (26.7, 37.3):
            B(bm, x - 0.1 + (4 if yy > 30 else 0), x + 0.1 + (4 if yy > 30 else 0), yy - 22, yy - 4, -3.99, -3.985, I['reflect'])
    # пробка: плотный поток в обе стороны
    r = random.Random(55)
    for lane_y, dirx in ((28.8, 1), (31.0, 1), (33.0, -1), (35.2, -1)):
        x = 20.0 + r.uniform(0, 4)
        while x < 100:
            car(bm, x, lane_y, dirx, r)
            x += r.uniform(5.6, 7.2)
    # катер у восточной набережной
    B(bm, 70, 77, -22, -19.5, -4.0, -2.9, I['car2'])
    B(bm, 72, 75, -21.5, -20, -2.9, -1.9, I['glass'])
    B(bm, 70.8, 71.1, -20.9, -20.6, -2.9, -0.6, I['metal'])


def park(bm, rng):
    """Парк на восточном берегу: газон, дорожки, фонтан, скамейки, фонари, деревья."""
    B(bm, 86, 124, -17, 25, 0.0, 0.04, I['grass'])
    B(bm, 104.2, 105.8, -17, 25, 0.04, 0.07, I['stone'])
    B(bm, 86, 124, 3.2, 4.8, 0.04, 0.07, I['stone'])
    box(bm, (105, 4, 0.055), (54, 1.6, 0.03), rot=Euler((0, 0, math.radians(47))), mi=I['stone'])
    # фонтан
    cyl(bm, (105, 4, 0.3), 4.2, 0.6, 40, mi=I['stone'])
    cyl(bm, (105, 4, 0.62), 3.8, 0.05, 40, mi=I['water'])
    cyl(bm, (105, 4, 1.4), 0.35, 2.2, 12, mi=I['stone'])
    cyl(bm, (105, 4, 2.55), 0.9, 0.14, 20, mi=I['stone'])
    ring = [(x + 105, y + 4) for x, y in circ(3.7, 40)]
    ring_in = [(x + 105, y + 4) for x, y in circ(3.55, 40)]
    ring_prism(bm, ring, ring_in, 0.62, 0.66, mi=I['mint'])
    for a in range(0, 360, 60):
        bx = 105 + 6.2 * math.cos(math.radians(a))
        by = 4 + 6.2 * math.sin(math.radians(a))
        bench(bm, bx, by, 'x' if abs(math.sin(math.radians(a))) > 0.5 else 'y')
    for y in (-12, -1, 10, 20):
        lamp(bm, 103.6, y, 4.2)
    for x in (91, 116):
        lamp(bm, x, 2.6, 4.2)
    placed = 0
    while placed < 34:
        x, y = rng.uniform(87, 123), rng.uniform(-15, 24)
        if abs(x - 105) < 2.5 or abs(y - 4) < 2.2 or math.hypot(x - 105, y - 4) < 7.5:
            continue
        tree(bm, x, y, rng.uniform(7, 13), rng)
        placed += 1
    # набережная восточного берега
    for y in range(-60, 26, 10):
        tree(bm, 83.2, y + rng.uniform(-1, 1), rng.uniform(7.5, 10), rng, 'oak')
    for y in range(-56, 26, 12):
        lamp(bm, 79.6, y, 5.5)
    for x in range(88, 260, 24):
        lamp(bm, x, 25.6, 8, dy=1)
        lamp(bm, x + 12, 38.4, 8, dy=-1)


def residential(bm, rng):
    """Жилая улица: дома по обе стороны, палисадники, деревья во дворах, фонари, машины."""
    # северная сторона (фасады на юг), кроме участка получателя 138–150
    pitched_house(bm, 126, 136, -12, -2, 6.0, 3.2, rng, -1, wall='white')
    pitched_house(bm, 152, 162, -12, -2, 6.5, 3.4, rng, -1, wall='brick')
    building(bm, 164, 176, -12, -1, 10, rng, wall='white', sides='SE', lit=0.55, floor=3.2)
    pitched_house(bm, 178, 188, -12, -2, 6.0, 3.0, rng, -1, wall='white')
    building(bm, 190, 204, -13, -1, 7.5, rng, wall='brick', sides='SW', lit=0.5, floor=3.2)
    pitched_house(bm, 206, 216, -12, -2, 6.5, 3.3, rng, -1, wall='brick')
    # палисадники и живые изгороди
    for x0, x1 in ((126, 136), (152, 162), (164, 176), (178, 188), (190, 204), (206, 216)):
        B(bm, x0, x1, -17, -12, 0.0, 0.03, I['grass'])
        B(bm, x0, x0 + (x1 - x0) / 2 - 0.7, -17.4, -16.9, 0.0, 0.9, I['leaf'])
        B(bm, x0 + (x1 - x0) / 2 + 0.7, x1, -17.4, -16.9, 0.0, 0.9, I['leaf'])
    # деревья во дворах за домами
    for _ in range(24):
        x = rng.uniform(126, 220)
        y = rng.uniform(1, 22)
        tree(bm, x, y, rng.uniform(7, 12), rng)
    # южная сторона (фасады на север)
    for k, x0 in enumerate(range(90, 220, 13)):
        h = rng.uniform(6.0, 9.0)
        if k % 3 == 1:
            building(bm, x0, x0 + 11, -44, -32, h + 2, rng, wall='white', sides='NE', lit=0.5, floor=3.1)
        else:
            pitched_house(bm, x0, x0 + 11, -44, -32, h, 3.2, rng, 1, wall='brick' if k % 2 else 'white')
        B(bm, x0, x0 + 11, -32, -29, 0.0, 0.03, I['grass'])
    # фонари и машины вдоль улицы — не перед домом получателя
    for x in range(92, 260, 20):
        lamp(bm, x, -17.6, 7, dy=-1)
        # напротив дома получателя фонарей нет: там стоит камера финального кадра
        if not 128 < x + 10 < 158:
            lamp(bm, x + 10, -28.4, 7, dy=1)
    for x in (96, 112, 124, 168, 181, 199, 226):
        car(bm, x, -20.2, -1, rng)
    for x in (101, 131, 158, 190, 214):
        car(bm, x, -25.8, 1, rng)


def skyline(bm, rng):
    """Город по периметру: кварталы за главной улицей и на востоке, в тумане на сайте."""
    r = random.Random(4242)
    x = -130.0
    while x < 250:
        w = r.uniform(10, 18)
        d = r.uniform(12, 20)
        h = r.uniform(18, 70) if x > -60 else r.uniform(12, 30)
        y0 = 42 + r.uniform(0, 8)
        building(bm, x, x + w, y0, y0 + d, h, r, wall=r.choice(['concrete', 'white', 'brick']), sides='SEW',
                 lit=0.35, floor=3.2, kit=h < 40)
        if h > 40:
            uvsphere(bm, (x + w / 2, y0 + d / 2, h + 0.3), 0.25, 8, 6, mi=I['red'])
        x += w + r.uniform(3, 9)
    y = -60.0
    while y < 40:
        d = r.uniform(12, 18)
        h = r.uniform(15, 45)
        building(bm, 232, 250, y, y + d, h, r, wall=r.choice(['concrete', 'white']), sides='WS', lit=0.35, kit=True)
        y += d + r.uniform(4, 8)


def destination(bm, rng):
    """Дом получателя: 2 этажа, фасад на юг, дверь 0.95 × 2.1 м с козырьком, крыльцо, дорожка,
    мишень под посылку на дорожке перед ступенью. Возвращает центр мишени и лампу у двери (м)."""
    x0, x1, y0, y1, h = 138.0, 150.0, -12.0, -2.0, 7.0
    B(bm, x0, x1, y0, y1, 0, h, I['white'])
    B(bm, x0 - 0.3, x1 + 0.3, y0 - 0.3, y1 + 0.3, h, h + 0.25, I['roof'])
    for (a0, a1, b0, b1) in ((x0, x1, y0, y0 + 0.2), (x0, x1, y1 - 0.2, y1), (x0, x0 + 0.2, y0, y1), (x1 - 0.2, x1, y0, y1)):
        B(bm, a0, a1, b0, b1, h + 0.25, h + 0.75, I['white'])
    for k in range(3):
        bx = x0 + 2.5 + k * 2.6
        box(bm, (bx, y0 + 5.0, h + 0.75), (2.2, 1.4, 0.06), rot=Euler((math.radians(-25), 0, 0)), mi=I['solar'])
    # цоколь и облицовка первого этажа деревом
    B(bm, x0 - 0.02, x1 + 0.02, y0 - 0.04, y0 + 0.02, 0.0, 0.3, I['concrete'])
    B(bm, x0 + 6.0, x1, y0 - 0.06, y0 - 0.02, 0.3, 3.3, I['wood'])
    # дверь с коробкой, ручкой и боковым витражом
    dx = 141.8
    B(bm, dx - 0.6, dx + 0.6, y0 - 0.08, y0, 0.3, 2.55, I['roof'])
    B(bm, dx - 0.475, dx + 0.475, y0 - 0.12, y0 - 0.06, 0.3, 2.4, I['door'])
    B(bm, dx + 0.28, dx + 0.32, y0 - 0.2, y0 - 0.12, 1.1, 1.7, I['metal'])
    B(bm, dx + 0.7, dx + 1.0, y0 - 0.08, y0 - 0.02, 0.35, 2.4, I['winsoft'])
    # козырёк над дверью — не над мишенью
    B(bm, dx - 1.5, dx + 1.5, y0 - 1.3, y0, 2.7, 2.85, I['concrete'])
    # окна: большое у гостиной, лента второго этажа, маленькое у входа
    B(bm, 144.4, 148.0, y0 - 0.1, y0, 0.75, 2.95, I['roof'])
    B(bm, 144.55, 147.85, y0 - 0.13, y0 - 0.05, 0.85, 2.85, I['winsoft'])
    B(bm, x0 + 0.8, x1 - 0.8, y0 - 0.1, y0, 3.95, 5.75, I['roof'])
    for k in range(4):
        wx0 = x0 + 0.95 + k * 2.6
        B(bm, wx0, wx0 + 2.4, y0 - 0.13, y0 - 0.05, 4.05, 5.65, I['winsoft'] if k == 2 else I['dark'])
    B(bm, 139.0, 140.2, y0 - 0.12, y0 - 0.04, 1.0, 2.2, I['dark'])
    # лампа у двери и номер дома
    B(bm, dx + 1.1, dx + 1.3, y0 - 0.2, y0 - 0.06, 2.05, 2.4, I['lamp'])
    B(bm, dx - 1.35, dx - 0.95, y0 - 0.1, y0 - 0.04, 2.0, 2.3, I['mint'])
    # боковые фасады
    facade(bm, 'y', x0, y0 + 1.5, y1 - 1.5, 0, h, -1, rng, lit=0.5, floor=3.4, pitch=3.0, first=0.9)
    facade(bm, 'y', x1, y0 + 1.5, y1 - 1.5, 0, h, 1, rng, lit=0.5, floor=3.4, pitch=3.0, first=0.9)
    # крыльцо, ступень, дорожка, газон, изгородь с проходом, кашпо, столбики-фонари, почтовый ящик
    B(bm, dx - 1.4, dx + 1.4, y0 - 1.7, y0, 0.0, 0.3, I['stone'])
    B(bm, dx - 1.2, dx + 1.2, y0 - 2.2, y0 - 1.7, 0.0, 0.15, I['stone'])
    B(bm, dx - 0.65, dx + 0.65, -17.0, y0 - 2.2, 0.0, 0.03, I['stone'])
    B(bm, x0, dx - 0.65, -17.0, y0, 0.0, 0.025, I['grass'])
    B(bm, dx + 0.65, x1, -17.0, y0, 0.0, 0.025, I['grass'])
    B(bm, x0, dx - 0.9, -17.4, -16.9, 0.0, 0.9, I['leaf'])
    B(bm, dx + 0.9, x1, -17.4, -16.9, 0.0, 0.9, I['leaf'])
    for s in (-1, 1):
        B(bm, dx + s * 1.9 - 0.4, dx + s * 1.9 + 0.4, y0 - 1.1, y0 - 0.3, 0.0, 0.6, I['concrete'])
        ico(bm, (dx + s * 1.9, y0 - 0.7, 0.95), 0.45, sub=1, mi=I['leaf'])
        for by in (-16.3, -14.2):
            cyl(bm, (dx + s * 0.95, by, 0.3), 0.06, 0.6, 8, mi=I['metal'])
            cyl(bm, (dx + s * 0.95, by, 0.63), 0.07, 0.06, 8, mi=I['lamp'])
    cyl(bm, (dx + 1.6, -16.6, 0.55), 0.05, 1.1, 6, mi=I['metal'])
    B(bm, dx + 1.4, dx + 1.8, -16.75, -16.45, 1.0, 1.3, I['car4'])
    # мишень ⌀1.2 м на дорожке перед ступенью
    mx, my = dx, -15.4
    cyl(bm, (mx, my, 0.04), 0.62, 0.02, 40, mi=I['roof'])
    ring = [(x + mx, y + my) for x, y in circ(0.58, 40)]
    ring_in = [(x + mx, y + my) for x, y in circ(0.52, 40)]
    ring_prism(bm, ring, ring_in, 0.05, 0.056, mi=I['mint'])
    for k in range(4):
        a = TAU * k / 4
        box(bm, (mx + 0.36 * math.cos(a), my + 0.36 * math.sin(a), 0.053), (0.18, 0.03, 0.006), rot=Euler((0, 0, a)), mi=I['mark'])
    return Vector((mx, my, 0.05)), Vector((dx + 1.2, y0 - 0.5, 2.25))


def world_obj(P, name, fill, mats, rng):
    bm = bmesh.new()
    out = fill(bm, rng)
    o = from_bm(name, bm, mats, P, loc=(0, 0, S))
    o.scale = (M, M, M)
    return o, out


# ---------------------------------------------------------------- камера

def shot_cam(subject, az, el, dist, sx, sy):
    """Камера и точка взгляда: дрон (subject) виден в кадре со смещением sx, sy (доли ширины/высоты кадра)."""
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam = subject + d * dist
    fwd = (subject - cam).normalized()
    right = fwd.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(fwd).normalized()
    th = math.tan(VFOV / 2)
    tw = th * ASPECT
    # объект правее центра на sx·ширины → точка взгляда левее объекта на столько же
    target = subject - right * (sx * 2 * tw * dist) - up * (sy * 2 * th * dist)
    return cam, target


def project(cam, target, p):
    fwd = (target - cam).normalized()
    right = fwd.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(fwd).normalized()
    v = p - cam
    z = v.dot(fwd)
    if z <= 0.01:
        return None
    th = math.tan(VFOV / 2)
    return (v.dot(right) / z / (th * ASPECT), v.dot(up) / z / th)


# ключевые ракурсы: кадр → (азимут, возвышение, дистанция в ед., смещение x, смещение y)
# азимут 0 — камера к югу от дрона и смотрит на север, 90 — с востока; sx > 0 — дрон правее центра
SHOTS = [
    (1, (28, 22, 14, 0.2, -0.04)),       # первый экран: подбор коробки на крыше, текст слева
    (76, (28, 22, 15, 0.2, -0.02)),
    (101, (38, 11, 16, 0.2, 0.02)),      # «Держит коробку»: взлёт над крышей склада, за ним город, текст справа
    (125, (30, 4, 20, 0.2, 0.0)),        # «Не слышно из окна»: вдоль фасада с окнами, текст слева
    (149, (-30, 22, 25, 0.19, 0.06)),    # «Над пробками»: река и мост с пробкой, текст справа
    (173, (-82, 16, 20, 0.2, -0.02)),    # «Знает двор»: из-за спины на дом впереди, текст слева
    (192, (5, 8, 30, 0.14, -0.113)),     # финал: неподвижный кадр на дверь, текст справа; сверху место под дрон
]
TEXT_SIDE = {1: 'left', 76: 'left', 101: 'right', 125: 'left', 149: 'right', 173: 'left'}
# сторона дрона в кадре: +1 — правее центра (текст слева), −1 — левее; меняется только между секциями
SIDE_KEYS = [(1, 1), (76, 1), (101, -1), (125, 1), (149, -1), (173, 1), (192, -1)]
PORCH_SHOT = (5, 8, 30, 0.14, -0.113)    # финал: неподвижный кадр на дверь, текст справа


def key_params(f):
    ks = SHOTS
    if f <= ks[0][0]:
        return ks[0][1]
    for (f0, p0), (f1, p1) in zip(ks, ks[1:]):
        if f0 <= f <= f1:
            t = smooth((f - f0) / (f1 - f0))
            return tuple(a + (b - a) * t for a, b in zip(p0, p1))
    return ks[-1][1]


def side_sign(f):
    ks = SIDE_KEYS
    if f <= ks[0][0]:
        return ks[0][1]
    for (f0, s0), (f1, s1) in zip(ks, ks[1:]):
        if f0 <= f <= f1:
            return s0 + (s1 - s0) * smooth((f - f0) / (f1 - f0))
    return ks[-1][1]


def bake_camera(P, flight, parcel_at, porch_point):
    cam_e = empty('Камера', P, size=0.4)
    tgt_e = empty('Цель камеры', P, size=0.3)
    track = {}
    for f in range(F0, F1 + 1):
        d, _ = flight[f]
        if f >= 192:
            subj = porch_point.copy()
        elif f <= 76:
            # на крыше в кадре и дрон, и коробка: смотрим на середину между ними
            pc = parcel_at(f)
            subj = Vector(((d.x + pc.x) / 2, (d.y + pc.y) / 2, (d.z + pc.z) / 2 + 0.3))
        else:
            # в полёте — центр дрона с коробкой; от середины пары переходим плавно, без скачка кадра
            pc = parcel_at(76)
            d76 = flight[76][0]
            mid76 = Vector(((d76.x + pc.x) / 2, (d76.y + pc.y) / 2, (d76.z + pc.z) / 2 + 0.3)) - d76
            w = smooth((f - 76) / 12)
            subj = d + mid76.lerp(Vector((0, 0, -0.35)), w)
            # заезд последнего блока: ракурс поворачивается к фасаду, камера держит дрон, пока он
            # не подлетит к двери, и только потом переходит на неподвижную точку крыльца
            if f >= 184:
                subj = subj.lerp(porch_point, smooth((f - 184) / (192 - 184)))
        az, el, dist, sx, sy = key_params(f)
        cam, tgt = shot_cam(subj, az, el, dist, sx * side_sign(f), sy)
        key(cam_e, f, loc=tuple(cam), interp='LINEAR')
        key(tgt_e, f, loc=tuple(tgt), interp='LINEAR')
        track[f] = (cam, tgt, subj)
    return track


# ---------------------------------------------------------------- сюжет

def build_map_story(P):
    """Полная карта, полёт и камера. Возвращает покадровый полёт и отчёт проверок."""
    LIGHTS.clear()
    rng = random.Random(2026)
    mats = world_mats()
    b = drone_body(P)
    drone, yaw_g, pitch_g, ants, legs = b['drone'], b['yaw'], b['pitch'], b['ants'], b['legs']
    start_pad(P, b)
    parcel = parcel_obj(P)
    cord = mat('Трос', (0.85, 0.86, 0.9), metal=0.6, rough=0.3)
    bm = bmesh.new()
    cyl(bm, (0, 0, -0.5), 0.01, 1.0, 10, mi=0)
    tether = from_bm('Трос', bm, [cord], P)

    world = []
    for n, fn in enumerate((ground, west_bank, bridge, park, residential, skyline)):
        o, _ = world_obj(P, f'Окружение {n:02d}', fn, mats, rng)
        world.append(o)
    home, (mat_m, lamp_m) = world_obj(P, 'Площадка у двери', destination, mats, rng)
    world.append(home)
    mat_u = U(*mat_m)
    for k, (x, y, z0, h) in enumerate(LIGHTS):
        e = empty(f'Свет фонаря {k:02d}', P, loc=tuple(U(x, y, z0)), size=0.2)
        e.scale = (h, h, h)
    empty('Свет у двери', P, loc=tuple(U(*lamp_m)), size=0.2)

    # раскладка и шасси как в остальных вариантах
    for h, s in ((ants[0], -1), (ants[1], 1)):
        key(h, F0, rot=(0, -math.pi / 2, 0)); key(h, 12, rot=(0, -math.pi / 2, 0)); key(h, 30, rot=(0, -0.22, s * 0.12))
    for h, s in legs:
        key(h, F0, rot=(0, 0, 0)); key(h, 72, rot=(0, 0, 0)); key(h, 88, rot=(s * math.radians(58), 0, 0))
    key(yaw_g, F0, rot=(0, 0, 0))
    key(pitch_g, F0, rot=(0, 0, 0)); key(pitch_g, 60, rot=(0, math.radians(35), 0)); key(pitch_g, 200, rot=(0, math.radians(55), 0))

    # маршрут в метрах: крыша склада → вдоль окон жилого дома → над рекой → над парком → к двери
    hover_z = mat_m.z + 3.8
    pts = [(F0, (0, 0, Z0)), (28, (0, 0, Z0)), (44, (0, 0, H1)), (54, (0, START.y, H1)), (64, (0, START.y, H1))]
    path_m = [
        (76, (0, START.y / M, (H1 + 0.8 - S) / M)), (88, (5, -1.0, 11.0)), (101, (13, -1.5, 14.0)),
        (113, (21, -0.8, 15.5)), (125, (29, 0.2, 16.0)), (137, (44, 1.5, 17.0)), (149, (60, 3.0, 18.0)),
        (161, (84, 0.0, 18.5)), (173, (108, -6.0, 18.0)), (180, (124, -10.0, 13.0)), (186, (138.6, -14.4, 6.4)),
        (192, (mat_m.x - 0.4, mat_m.y + 0.2, hover_z + 0.9)), (204, (mat_m.x, mat_m.y, hover_z)),
        (219, (mat_m.x, mat_m.y, hover_z)), (228, (mat_m.x, mat_m.y, hover_z + 0.5)), (F1, (151, -6.0, 16.0)),
    ]
    pts += [(f, tuple(U(*p))) for f, p in path_m]
    flight = bake_flight(drone, pts)

    # трос и коробка: подбор на крыше, доставка на мишень
    L_pick = H1 - BELLY - (G + BH)
    L_drop = (U(0, 0, hover_z).z) - BELLY - (mat_u.z + BH)
    tl = [(F0, 0.001), (54, 0.001), (60, L_pick), (64, L_pick), (76, 0.001), (206, 0.001),
          (216, L_drop), (219, L_drop), (228, 0.001), (F1, 0.001)]
    Lc = {}
    for a, c in zip(tl, tl[1:]):
        for f in range(a[0], c[0] + 1):
            t = (f - a[0]) / max(1, c[0] - a[0])
            Lc[f] = a[1] + (c[1] - a[1]) * t * t * (3 - 2 * t)
    parcel_pos = {}
    released = None
    for f in range(F0, F1 + 1):
        d, yaw = flight[f]
        L = Lc[f]
        key(tether, f, loc=(d.x, d.y, d.z - BELLY), scale=(1, 1, max(L, 0.001)), interp='LINEAR')
        if f < 60:
            loc, rz = START.copy(), 0.0
        elif f <= 216:
            loc, rz = Vector((d.x, d.y, d.z - BELLY - L - BH / 2)), yaw
            if f == 216:
                released = (loc.copy(), rz)
        else:
            loc, rz = released
        key(parcel, f, loc=tuple(loc), rot=(0, 0, rz), interp='LINEAR')
        parcel_pos[f] = loc
    bpy.context.scene.frame_set(F0)

    porch_point = mat_u + Vector((0, 0, 1.9 * M))
    track = bake_camera(P, flight, lambda f: parcel_pos[f], porch_point)
    return flight, track, world, parcel_pos


def check_map(P, flight, track, world):
    """Проверки: дрон не задевает мир, камера не внутри зданий, обзор на дрон не закрыт,
    дрон в кадре на всём пути, а в секциях — не под карточкой текста."""
    dg = bpy.context.evaluated_depsgraph_get()
    trees = [(o.name, BVHTree.FromObject(o, dg), o.matrix_world.copy()) for o in world]
    PW = P.matrix_world
    rep = []

    def nearest(p):
        best = (1e9, None)
        for name, t, mw in trees:
            inv = mw.inverted()
            loc, _, _, dist = t.find_nearest(inv @ (PW @ p))
            if loc is None:
                continue
            dw = ((mw @ loc) - (PW @ p)).length
            if dw < best[0]:
                best = (dw, name)
        return best

    def blocked(a, b):
        # луч от камеры к дрону: пересечение с миром раньше, чем в 1.5 ед. до дрона
        wa, wb = PW @ a, PW @ b
        dvec = wb - wa
        L = dvec.length
        for name, t, mw in trees:
            inv = mw.inverted()
            la, lb = inv @ wa, inv @ wb
            dl = (lb - la)
            hit = t.ray_cast(la, dl.normalized(), dl.length)
            if hit[0] is not None:
                dw = ((mw @ hit[0]) - wa).length
                if dw < L - 1.5:
                    return name
        return None

    drone_hits, cam_hits, occl, offscreen, undertext = [], [], [], [], []
    for f in range(64, F1 + 1):
        d, _ = flight[f]
        if f < 229:
            dist, name = nearest(d)
            if dist < 2.0 and not (f < 90 and name == 'Окружение 01'):
                drone_hits.append((f, name, round(dist, 2)))
        cam, tgt, subj = track[f]
        dist, name = nearest(cam)
        if dist < 3.0:
            cam_hits.append((f, name, round(dist, 2)))
        b = blocked(cam, d)
        if b:
            occl.append((f, b))
        pr = project(cam, tgt, d)
        if f <= 228 and (pr is None or abs(pr[0]) > 0.92 or abs(pr[1]) > 0.92):
            offscreen.append((f, None if pr is None else (round(pr[0], 2), round(pr[1], 2))))
        if f in TEXT_SIDE and pr is not None:
            side = TEXT_SIDE[f]
            # карточка: слева x ∈ [−0.92, −0.30], справа x ∈ [0.22, 0.88] в долях полуширины кадра
            if (side == 'right' and pr[0] > 0.12) or (side == 'left' and pr[0] < -0.2):
                undertext.append((f, side, round(pr[0], 2)))

    def fmt(name, items):
        if not items:
            return f'   {name}: нет'
        return f'   {name}: {len(items)} — ' + ', '.join(str(i) for i in items[:6])
    rep.append(fmt('дрон задевает мир', drone_hits))
    rep.append(fmt('камера ближе 3 ед. к миру', cam_hits))
    rep.append(fmt('обзор на дрон закрыт', occl))
    rep.append(fmt('дрон вне кадра', offscreen))
    rep.append(fmt('дрон под карточкой текста', undertext))
    return rep
