# Сцена сайта дрона: полная карта района, полёт и камера → drone-map.blend и drone.glb для сайта.
# Запуск из корня проекта: Blender -b --factory-startup --python blender/build_drone_map.py
# Таймлайн 1..240 — это прокрутка страницы: 1–76 первый экран, 101/125/149/173 — секции, 192–240 — финал.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import common
from common import *
import drone_world as dw

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
GLB = argv[0] if argv else os.path.join(HERE, '..', 'public', 'models')
BLEND = os.path.join(HERE, 'drone-map.blend')

sc = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
sc.frame_start, sc.frame_end = F0, F1
sc.render.fps = 30
sc.render.engine = 'BLENDER_EEVEE'
world = bpy.data.worlds.new('Ночь')
sc.world = world
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (0.006, 0.006, 0.01, 1)

coll = bpy.data.collections.new('Дрон · карта района')
sc.collection.children.link(coll)
common.set_coll(coll)
P = empty('Дрон pivot')
flight, track, world_objs, _ = dw.build_map_story(P)
report = ['проверки полёта и камеры:'] + dw.check_map(P, flight, track, world_objs)

# выгрузка: всё, кроме света, камер и скрытых служебных объектов (исходник пропеллера)
bpy.ops.object.select_all(action='DESELECT')
for o in coll.all_objects:
    if o.type in ('LIGHT', 'CAMERA') or o.hide_render or o.name.startswith('_'):
        continue
    o.select_set(True)
path = os.path.join(GLB, 'drone.glb')
bpy.ops.export_scene.gltf(
    filepath=path, export_format='GLB', use_selection=True, use_visible=False,
    export_apply=True, export_animations=True, export_animation_mode='SCENE',
    export_frame_range=True, export_force_sampling=True, export_anim_slide_to_zero=True,
    export_optimize_animation_size=True, export_anim_scene_split_object=False,
    export_morph=False, export_lights=False, export_cameras=False, export_extras=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
)
report.append(f'выгружен {path}: {os.path.getsize(path) / 1048576:.2f} МБ')

# в файле для работы — «Камера сайта»: повторяет запечённый путь, как на сайте
# (вертикальный угол 34°, кадр 16:10); ползунок таймлайна = прокрутка страницы
cam_e = next(o for o in coll.all_objects if o.name == 'Камера')
tgt_e = next(o for o in coll.all_objects if o.name == 'Цель камеры')
cd = bpy.data.cameras.new('Камера сайта')
cd.sensor_fit = 'VERTICAL'
cd.sensor_height = 24.0
cd.lens = 24.0 / (2 * math.tan(math.radians(17)))
cd.clip_start, cd.clip_end = 0.3, 3000
cam = bpy.data.objects.new('Камера сайта', cd)
coll.objects.link(cam)
c = cam.constraints.new('COPY_LOCATION'); c.target = cam_e
c = cam.constraints.new('TRACK_TO'); c.target = tgt_e
c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = 1440, 900
sc.frame_set(101)
bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
report.append(f'сохранён {BLEND}')

print('\n'.join(['== СЦЕНА ДРОНА =='] + report))
