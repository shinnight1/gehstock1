"""Macht aus den Tripo-Ausfuhren die Spielermodelle fuer GehstockMon.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b \
        --factory-startup --python tools/skin-modelle.py -- <ordner> [skin-id ...]

Erwartet einen Ordner mit einem Unterordner je Skin, darin zwei FBX-Dateien
mit demselben Skelett - eine mit der Lauf-, eine mit der Standbewegung - und
ein PNG, dessen Name die Skin-Kennung aus X.SKINS traegt. Welche FBX welche
Bewegung enthaelt, wird am Namen der Aktion erkannt, nicht am Dateinamen.

Je Skin entstehen zwei Dateien in src/assets/, die der Build als Daten-URI
einbettet:

    gm-modell-<id>.glb           Netz, Skelett und die beiden Bewegungen
    gm-modell-<id>-textur.webp   die Grundfarbe

Was hier bewusst NICHT passiert: skalieren. Eine Skalierung am Skelett laesst
das Netz im Spiel auseinanderfliegen, weil die Bindematrizen der Knochen
davon nichts mitbekommen. Die Endgroesse setzt src/games/gehstockmon/2-welt.js
anhand der Huellbox.
"""
import bpy, os, sys, glob, json

ZIEL_DREIECKE = 2600   # der Spieler ist am Bildschirm rund 120 px gross
TEXTUR = 320
TAKT = 2               # nur jedes zweite Bild der Bewegung ausgeben

mit = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WURZEL = mit[0] if mit else r"C:\Users\Luis\Desktop\GehstockMon-Skins\Skin-Bilder"
NUR = set(mit[1:])

HIER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIEL = os.path.join(HIER, "src", "assets")


def aktion_von(pfad):
    """Importiert eine FBX und meldet Aktion samt neuen Objekten."""
    alte_aktionen = set(bpy.data.actions.keys())
    alte_objekte = set(bpy.data.objects.keys())
    bpy.ops.import_scene.fbx(filepath=pfad, automatic_bone_orientation=False)
    neu = [a for k, a in bpy.data.actions.items() if k not in alte_aktionen]
    if len(neu) != 1:
        raise SystemExit("Erwartet wurde genau eine Animation in " + pfad)
    return neu[0], [o for k, o in bpy.data.objects.items() if k not in alte_objekte]


def baue(ordner, skin, lauf=None, stehen=None):
    fbx = [lauf, stehen] if lauf else sorted(glob.glob(os.path.join(ordner, "*.fbx")))
    if len(fbx) != 2:
        raise SystemExit(skin + ": erwartet werden genau zwei FBX-Dateien")

    # Erst hineinschauen, welche Datei welche Bewegung traegt.
    rollen = {}
    for pfad in fbx:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=pfad, automatic_bone_orientation=False)
        name = bpy.data.actions[0].name.lower()
        rollen["stehen" if "idle" in name else "laufen"] = pfad
    if set(rollen) != {"stehen", "laufen"}:
        raise SystemExit(skin + ": Stand und Lauf liessen sich nicht zuordnen")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    laufen, behalten = aktion_von(rollen["laufen"], )
    laufen.name = "laufen"; laufen.use_fake_user = True
    stehen, doppelt = aktion_von(rollen["stehen"])
    stehen.name = "stehen"; stehen.use_fake_user = True
    for o in doppelt:                  # zweites Skelett und Netz wieder raus
        bpy.data.objects.remove(o, do_unlink=True)

    mesh = next(o for o in behalten if o.type == 'MESH')
    arm = next(o for o in behalten if o.type == 'ARMATURE')
    rep = {"skin": skin, "dreiecke_vorher": len(mesh.data.polygons)}

    # Netz auf eine feste Zielgroesse bringen. Die Ausfuhren schwanken zwischen
    # 18.000 und 189.000 Dreiecken, ein festes Verhaeltnis taugt dafuer nicht.
    bpy.context.view_layer.objects.active = mesh
    # Erst die Naehte verschweissen: Tripo liefert das Netz in Inseln, und an
    # deren Raendern darf das Ausduennen nichts zusammenziehen. Ohne diesen
    # Schritt bleibt es weit ueber dem Ziel stehen.
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0002)
    bpy.ops.object.mode_set(mode='OBJECT')
    rep["ecken_verschweisst"] = len(mesh.data.vertices)

    d = mesh.modifiers.new("wenigerEcken", 'DECIMATE')
    d.decimate_type = 'COLLAPSE'
    d.ratio = min(1.0, ZIEL_DREIECKE / max(1, len(mesh.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=d.name)
    rep["dreiecke_nachher"] = len(mesh.data.polygons)

    # Weiches Schattieren spart mehr als das Ausduennen: harte Kanten zwingen
    # den glTF-Ausgang, an jeder Kante die Eckpunkte zu verdoppeln, und an
    # einem Eckpunkt haengen Lage, Normale, Naht und vier Knochengewichte.
    bpy.ops.object.shade_smooth()
    rep["ecken_vorher"] = len(mesh.data.vertices)

    # Von den vier Texturen bleibt nur die Grundfarbe. Normal, Rauheit und
    # Metall kosten das Dreifache und sind bei dieser Bildgroesse nicht zu sehen.
    #
    # Verglichen wird ueber Typ und Namen, nicht mit "is": bpy legt bei jedem
    # Zugriff einen neuen Wrapper an, ein Identitaetsvergleich geht daneben.
    nt = mesh.data.materials[0].node_tree
    grundfarbe = next((l.from_node for l in nt.links
                       if l.to_node.type == 'BSDF_PRINCIPLED'
                       and l.to_socket.name == 'Base Color'
                       and l.from_node.type == 'TEX_IMAGE'), None)
    if grundfarbe is None:
        raise SystemExit(skin + ": die Grundfarbe haengt nicht wie erwartet am Material")
    bildname, grundname = grundfarbe.image.name, grundfarbe.name
    for n in [n.name for n in nt.nodes
              if n.type in ('TEX_IMAGE', 'NORMAL_MAP') and n.name != grundname]:
        nt.nodes.remove(nt.nodes[n])
    for i in [i.name for i in bpy.data.images if i.name != bildname]:
        bpy.data.images.remove(bpy.data.images[i])

    # Die Grundfarbe kommt als eigene Datei neben das Modell, nicht hinein:
    # three laedt eingebettete Bilder ueber blob:-Adressen, und die sind in der
    # Offline-Einzeldatei unter file:// nicht verlaesslich.
    aus_tex = os.path.join(ZIEL, "gm-modell-" + skin + "-textur.webp")
    bild = bpy.data.images[bildname]
    bild.scale(TEXTUR, TEXTUR)
    bild.file_format = 'WEBP'
    bild.filepath_raw = aus_tex
    bild.save(quality=86)
    rep["textur_bytes"] = os.path.getsize(aus_tex)

    nt.nodes.remove(nt.nodes[grundname])
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.62
    bsdf.inputs['Metallic'].default_value = 0.0

    # Beide Bewegungen als NLA-Spuren. Der glTF-Ausgang macht daraus je einen
    # benannten Clip - genau das, was der Mixer im Spiel erwartet.
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
    rep["takte"] = {a.name: round(a.frame_range[1] - a.frame_range[0]) for a in (stehen, laufen)}

    aus = os.path.join(ZIEL, "gm-modell-" + skin + ".glb")
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(
        filepath=aus, export_format='GLB',
        export_animations=True, export_animation_mode='NLA_TRACKS',
        export_force_sampling=True, export_bake_animation=True,
        export_frame_step=TAKT,
        export_yup=True, export_cameras=False, export_lights=False,
        export_skins=True, export_morph=False, export_tangents=False,
        export_materials='EXPORT', export_extras=False,
        export_optimize_animation_size=True,
    )
    rep["glb_bytes"] = os.path.getsize(aus)
    return rep


bericht = []

# Eine einzelne Figur ausserhalb der Ordnerstruktur:
#     -- --figur <kennung> <lauf.fbx> <stehen.fbx>
if mit and mit[0] == "--figur":
    bericht.append(baue(None, mit[1], mit[2], mit[3]))
    print("###JSON###")
    print(json.dumps(bericht, ensure_ascii=False))
    raise SystemExit(0)

for ordner in sorted(glob.glob(os.path.join(WURZEL, "*"))):
    if not os.path.isdir(ordner):
        continue
    png = glob.glob(os.path.join(ordner, "*.png"))
    if not png:
        bericht.append({"ordner": os.path.basename(ordner), "fehler": "kein PNG, keine Kennung"})
        continue
    skin = os.path.splitext(os.path.basename(png[0]))[0].lower()
    if NUR and skin not in NUR:
        continue
    bericht.append(baue(ordner, skin))

print("###JSON###")
print(json.dumps(bericht, ensure_ascii=False))
