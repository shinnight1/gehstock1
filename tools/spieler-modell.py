"""Macht aus zwei Tripo-Ausgaben das Spielermodell fuer GehstockMon.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b \
        --factory-startup --python tools/spieler-modell.py -- LAUF.fbx STEHEN.fbx

Erwartet werden zwei FBX-Dateien mit demselben Skelett, jede mit genau einer
Animation: einmal der Laufschritt, einmal der Stand. Tripo legt pro Ausfuhr
nur eine Animation ab, deshalb die zwei Dateien. Ohne Argumente gelten die
Pfade unten.

Heraus kommen zwei Dateien in src/assets/, die der Build als Daten-URI
einbettet:

    gm-spieler.glb           Netz, Skelett und die beiden Bewegungen
    gm-spieler-textur.webp   die Grundfarbe

Was hier bewusst NICHT passiert: skalieren. Eine Skalierung am Skelett laesst
das Netz im Spiel auseinanderfliegen, weil die Bindematrizen der Knochen
davon nichts mitbekommen. Die Endgroesse setzt src/games/gehstockmon/2-welt.js
anhand der Huellbox.
"""
import bpy, os, sys, json

# Standardpfade, falls beim Aufruf keine mitgegeben werden.
LAUF   = os.path.join(os.path.expanduser("~"), "Downloads", "spieler.fbx")
STEHEN = os.path.join(os.path.expanduser("~"), "Downloads", "spielerlauf.fbx")
if "--" in sys.argv:
    mit = sys.argv[sys.argv.index("--") + 1:]
    if len(mit) >= 2:
        LAUF, STEHEN = mit[0], mit[1]

HIER    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT     = os.path.join(HIER, "src", "assets", "gm-spieler.glb")
OUT_TEX = os.path.join(HIER, "src", "assets", "gm-spieler-textur.webp")
TEXTUR   = 512
DREIECKE = 0.22


def hole_aktion(pfad, name):
    """Importiert eine FBX nur wegen ihrer Animation und meldet, was neu kam."""
    alte_aktionen = set(bpy.data.actions.keys())
    alte_objekte = set(bpy.data.objects.keys())
    bpy.ops.import_scene.fbx(filepath=pfad, automatic_bone_orientation=False)
    neu = [a for k, a in bpy.data.actions.items() if k not in alte_aktionen]
    if len(neu) != 1:
        raise SystemExit("Erwartet wurde genau eine Animation in " + pfad)
    neu[0].name = name
    neu[0].use_fake_user = True
    return neu[0], [o for k, o in bpy.data.objects.items() if k not in alte_objekte]


bpy.ops.wm.read_factory_settings(use_empty=True)

laufen, behalten_obj = hole_aktion(LAUF, "laufen")
stehen, doppelt = hole_aktion(STEHEN, "stehen")
for o in doppelt:                  # zweites Skelett und zweites Netz wieder raus
    bpy.data.objects.remove(o, do_unlink=True)

mesh = next(o for o in behalten_obj if o.type == 'MESH')
arm = next(o for o in behalten_obj if o.type == 'ARMATURE')
rep = {"dreiecke_vorher": len(mesh.data.polygons)}

# Netz ausduennen: der Spieler ist am Bildschirm rund 120 px gross,
# 24k Dreiecke sind dafuer Verschwendung.
bpy.context.view_layer.objects.active = mesh
d = mesh.modifiers.new("wenigerEcken", 'DECIMATE')
d.decimate_type = 'COLLAPSE'
d.ratio = DREIECKE
bpy.ops.object.modifier_apply(modifier=d.name)
rep["dreiecke_nachher"] = len(mesh.data.polygons)

# Von den vier Texturen bleibt nur die Grundfarbe. Normal, Rauheit und Metall
# kosten das Dreifache und sind bei dieser Bildgroesse nicht zu sehen.
#
# Verglichen wird ueber Typ und Namen, nicht mit "is": bpy legt bei jedem
# Zugriff einen neuen Wrapper an, ein Identitaetsvergleich geht daneben.
nt = mesh.data.materials[0].node_tree
grundfarbe = next((l.from_node for l in nt.links
                   if l.to_node.type == 'BSDF_PRINCIPLED'
                   and l.to_socket.name == 'Base Color'
                   and l.from_node.type == 'TEX_IMAGE'), None)
if grundfarbe is None:
    raise SystemExit("Die Grundfarbe haengt nicht wie erwartet am Material.")
bildname, grundname = grundfarbe.image.name, grundfarbe.name
for n in [n.name for n in nt.nodes
          if n.type in ('TEX_IMAGE', 'NORMAL_MAP') and n.name != grundname]:
    nt.nodes.remove(nt.nodes[n])
for i in [i.name for i in bpy.data.images if i.name != bildname]:
    bpy.data.images.remove(bpy.data.images[i])

# Die Grundfarbe kommt als eigene Datei neben das Modell, nicht hinein: three
# laedt eingebettete Bilder ueber blob:-Adressen, und die sind in der
# Offline-Einzeldatei unter file:// nicht verlaesslich. Der Rest des Spiels
# holt seine Bilder ohnehin schon aus SG.assets.
bild = bpy.data.images[bildname]
bild.scale(TEXTUR, TEXTUR)
bild.file_format = 'WEBP'
bild.filepath_raw = OUT_TEX
bild.save(quality=88)
rep["textur"] = list(bild.size)
rep["textur_bytes"] = os.path.getsize(OUT_TEX)

nt.nodes.remove(nt.nodes[grundname])
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
bsdf.inputs['Roughness'].default_value = 0.62
bsdf.inputs['Metallic'].default_value = 0.0

# Bewusst wird hier nichts skaliert und nichts verschoben. Eine Skalierung
# am Skelett laesst das Netz auseinanderfliegen, weil die Bindematrizen der
# Knochen davon nichts mitbekommen. Die Endgroesse setzt das Spiel selbst,
# gemessen an der Huellbox des geladenen Modells.
bpy.context.view_layer.update()
hoch = [(mesh.matrix_world @ v.co).z for v in mesh.data.vertices]
rep["hoehe"] = round(max(hoch) - min(hoch), 4)
rep["boden"] = round(min(hoch), 4)

# Beide Animationen als NLA-Spuren anlegen. Der glTF-Ausgang macht daraus je
# einen benannten Clip - genau das, was der Mixer im Spiel erwartet.
if not arm.animation_data:
    arm.animation_data_create()
arm.animation_data.action = None
for spur in list(arm.animation_data.nla_tracks):
    arm.animation_data.nla_tracks.remove(spur)
for aktion in (stehen, laufen):
    spur = arm.animation_data.nla_tracks.new()
    spur.name = aktion.name
    streifen = spur.strips.new(aktion.name, int(aktion.frame_range[0]), aktion)
    streifen.name = aktion.name
    if hasattr(streifen, "action_slot") and len(aktion.slots):
        streifen.action_slot = aktion.slots[0]
rep["spuren"] = [t.name for t in arm.animation_data.nla_tracks]

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_force_sampling=True, export_bake_animation=True,
    export_yup=True, export_cameras=False, export_lights=False,
    export_skins=True, export_morph=False, export_tangents=False,
    export_materials='EXPORT', export_extras=False,
    export_optimize_animation_size=True,
)
rep["bytes"] = os.path.getsize(OUT)
print("###JSON###")
print(json.dumps(rep, indent=1))
