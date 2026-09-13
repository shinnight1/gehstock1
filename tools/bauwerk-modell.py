"""Macht aus einer Tripo-Ausfuhr ein Bauwerk fuer GehstockMon.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b \
        --factory-startup --python tools/bauwerk-modell.py -- <kennung> <datei.fbx>

Anders als die Figuren hat ein Bauwerk kein Skelett und keine Bewegung, steht
dafuer aber gross in der Landschaft - es darf also mehr Dreiecke behalten.

Heraus kommen zwei Dateien in src/assets/:

    gm-modell-<kennung>.glb           das Netz
    gm-modell-<kennung>-textur.webp   die Grundfarbe

Wie bei den Figuren wird hier nichts skaliert. Die Endgroesse setzt das Spiel
anhand der Huellbox.
"""
import bpy, os, sys, json

ZIEL_DREIECKE = 6000   # ein Bauwerk steht gross im Bild und darf mehr behalten
TEXTUR = 512

mit = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(mit) < 2:
    raise SystemExit("Aufruf: -- <kennung> <datei.fbx>")
KENNUNG, QUELLE = mit[0], mit[1]

HIER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIEL = os.path.join(HIER, "src", "assets")
AUS = os.path.join(ZIEL, "gm-modell-" + KENNUNG + ".glb")
AUS_TEX = os.path.join(ZIEL, "gm-modell-" + KENNUNG + "-textur.webp")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=QUELLE)
netze = [o for o in bpy.data.objects if o.type == 'MESH']
if len(netze) != 1:
    raise SystemExit("Erwartet wird genau ein Netz, gefunden: " + str(len(netze)))
mesh = netze[0]
rep = {"kennung": KENNUNG, "dreiecke_vorher": len(mesh.data.polygons)}

# Erst die Naehte verschweissen, sonst bleibt das Ausduennen weit ueber dem
# Ziel stehen: Tripo liefert das Netz in Inseln, an deren Raendern nichts
# zusammengezogen werden darf.
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0002)
bpy.ops.object.mode_set(mode='OBJECT')

d = mesh.modifiers.new("wenigerEcken", 'DECIMATE')
d.decimate_type = 'COLLAPSE'
d.ratio = min(1.0, ZIEL_DREIECKE / max(1, len(mesh.data.polygons)))
bpy.ops.object.modifier_apply(modifier=d.name)
bpy.ops.object.shade_smooth()
rep["dreiecke_nachher"] = len(mesh.data.polygons)

# Von den vier Texturen bleibt nur die Grundfarbe.
nt = mesh.data.materials[0].node_tree
grundfarbe = next((l.from_node for l in nt.links
                   if l.to_node.type == 'BSDF_PRINCIPLED'
                   and l.to_socket.name == 'Base Color'
                   and l.from_node.type == 'TEX_IMAGE'), None)
if grundfarbe is None:
    raise SystemExit("Die Grundfarbe haengt nicht wie erwartet am Material")
bildname, grundname = grundfarbe.image.name, grundfarbe.name
for n in [n.name for n in nt.nodes
          if n.type in ('TEX_IMAGE', 'NORMAL_MAP') and n.name != grundname]:
    nt.nodes.remove(nt.nodes[n])
for i in [i.name for i in bpy.data.images if i.name != bildname]:
    bpy.data.images.remove(bpy.data.images[i])

bild = bpy.data.images[bildname]
bild.scale(TEXTUR, TEXTUR)
bild.file_format = 'WEBP'
bild.filepath_raw = AUS_TEX
bild.save(quality=88)
rep["textur_bytes"] = os.path.getsize(AUS_TEX)

nt.nodes.remove(nt.nodes[grundname])
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
bsdf.inputs['Roughness'].default_value = 0.7
bsdf.inputs['Metallic'].default_value = 0.0

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=AUS, export_format='GLB',
    export_animations=False, export_yup=True,
    export_cameras=False, export_lights=False,
    export_skins=False, export_morph=False, export_tangents=False,
    export_materials='EXPORT', export_extras=False,
)
rep["bytes"] = os.path.getsize(AUS)
print("###JSON###")
print(json.dumps(rep, ensure_ascii=False))
