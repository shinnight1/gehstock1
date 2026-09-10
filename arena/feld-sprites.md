# Einheiten-Sprites fürs Schlachtfeld

Diese Prompts sind für die Figuren, die tatsächlich über die Arena laufen —
nicht zu verwechseln mit `kartenbilder.md`, das die Symbole für Sammlung,
Deckbau und Roll-Bildschirm liefert. Beides sieht bewusst unterschiedlich
aus: dort Dreiviertelansicht wie ein Poster, hier Draufsicht wie eine
Spielfigur auf einem Spielbrett.

## Warum der Blickwinkel anders sein muss

Die Kamera in `packages/client/src/render/kamera.ts` schaut fast senkrecht
von oben, nur leicht nach vorn geneigt (`SKALA_HINTEN = 0.78` — die Tiefe
wird über 32 Kacheln nur mild gestaucht, das ist eine steile Draufsicht,
kein Schrägblick). Eine Figur, die frontal wie ein Porträt gezeichnet ist,
würde auf dem Feld verzerrt und falsch beleuchtet wirken.

## Wohin die Bilder kommen — und was noch fehlt

Für die Kartensymbole gibt es bereits einen Ladepfad
(`assets/cards/<id>.png`, siehe `kartenkachel.ts`). Für die Feldfiguren
gibt es **noch keinen** — `render/einheit.ts` zeichnet aktuell nur
Kapsel-Formen aus Primitiven, lädt kein Bild pro Karte. Um diese Sprites
wirklich im Spiel zu sehen, muss ich den Renderer danach erweitern. Das
ist ein separater Schritt; sag Bescheid, wenn ich ihn angehen soll,
sobald Bilder da sind.

## Technische Vorgaben

- **Quadratisch, 1024 × 1024, transparenter Hintergrund.** Kein
  Kartenrahmen, kein Boden, kein Schatten im Bild — den zeichnet das
  Spiel selbst (`schatten()` in `perspektive.ts`). Ein eingebackener
  zweiter Schatten sähe doppelt aus.
- **Steile Draufsicht**, fast senkrecht von oben mit nur leichter
  Neigung nach vorn — als würde man auf eine Tischminiatur aus etwa
  60–70 Grad über der Horizontalen blicken. Kein Seitenprofil, kein
  Frontalporträt.
- **Licht von vorne oben links.** Deckt sich mit der Beleuchtung der
  Türme und Brücken im Renderer — Licht von rechts wirkt neben allem
  anderen falsch.
- **Eine einzelne Figur, auch bei Schwarmkarten.** Rattenschar,
  Hundemeute, Speerwerferinnen und Sturmfalken setzen mehrere Kopien
  derselben Grafik — das Bild zeigt nur ein Exemplar.
- **Neutrale Kampfhaltung, kein starker Rechts-Links-Drall.** Die Figur
  läuft je nach Spielverlauf nach oben oder unten über das Feld, wird
  aber nicht gespiegelt oder gedreht. Eine Pose, die nicht stark zu
  einer Seite lehnt, liest sich in beide Laufrichtungen richtig.
- **Kräftige, einfache Silhouette.** Die Figuren werden auf dem Feld
  sehr klein dargestellt — feine Details verschwinden, eine klare
  Kontur bleibt. Leicht überzeichnete Proportionen (größerer Kopf,
  größere Waffe) helfen der Lesbarkeit aus der Distanz.

## Der gemeinsame Stilsatz

> Stylized fantasy game unit, viewed from a steep three-quarter top-down
> angle (looking down from roughly 60-70 degrees above horizontal, almost
> overhead), bold simplified silhouette with slightly exaggerated
> proportions for readability at small size, dramatic rim lighting from
> the upper left, transparent background, no cast shadow, no ground, no
> card frame, no text, neutral ready stance without strong left-right
> lean, single figure only, 1024x1024

---

## Die 13 Feldeinheiten

### Steinwächter · `steinwaechter`
Belagerungstank, läuft stur zu Türmen.

> A colossal humanoid guardian built from weathered grey stone slabs,
> moss in the cracks, blunt ram-like fists, hollow glowing eye sockets,
> viewed from a steep three-quarter top-down angle showing the top of
> the shoulders and the forward-lowered fists, heavy grounded stance.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, cool grey-blue palette, transparent
> background, no cast shadow, no ground, no text, neutral stance without
> strong left-right lean, single figure only, 1024x1024

### Frostkoloss · `frostkoloss`
Zäher Nahkämpfer.

> A massive warrior in pale ice-blue plate armor, jagged icicles on
> shoulders and gauntlets, a frost-rimed greatsword held low and ready,
> viewed from a steep three-quarter top-down angle showing the top of
> the helm and shoulders, wide braced stance.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, icy blue and steel palette, transparent
> background, no cast shadow, no ground, no text, neutral stance without
> strong left-right lean, single figure only, 1024x1024

### Rattenschar · `rattenschar`
Einzelnes Exemplar — das Spiel setzt sechs davon.

> A single scrappy war rat on its hind legs, matted brown fur, a tiny
> rusted blade gripped in one paw, patched scrap-leather harness, viewed
> from a steep three-quarter top-down angle showing the top of the head
> and back, alert scrappy posture.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, warm brown and dust palette, transparent
> background, no cast shadow, no ground, no text, neutral stance without
> strong left-right lean, single figure only, 1024x1024

### Hundemeute · `hundemeute`
Einzelnes Exemplar — das Spiel setzt vier davon.

> A single lean war hound mid-stride, short russet fur, a studded
> leather harness, bared teeth and pinned ears, viewed from a steep
> three-quarter top-down angle showing the top of the back and head,
> lunging forward posture.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, burnt orange and leather palette,
> transparent background, no cast shadow, no ground, no text, neutral
> stance without strong left-right lean, single figure only, 1024x1024

### Speerwerferinnen · `speerwerferinnen`
Einzelnes Exemplar — das Spiel setzt drei davon.

> A single hunter woman in light leather and cloth wraps, braided hair,
> a slender javelin held ready at shoulder height angled upward, viewed
> from a steep three-quarter top-down angle showing the top of the
> shoulders and the raised javelin, focused ready stance.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, tan and ochre palette, transparent
> background, no cast shadow, no ground, no text, neutral stance without
> strong left-right lean, single figure only, 1024x1024

### Hammergarde · `hammergarde`
Flächenschaden, ein Schlag trifft viele.

> A heavily built warrior in deep violet plate armor gripping an
> oversized two-handed warhammer with a faint violet glow along the
> head, viewed from a steep three-quarter top-down angle showing the top
> of the shoulders and the hammer held ready across the body, wide
> grounded stance.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, violet and gunmetal palette, transparent
> background, no cast shadow, no ground, no text, neutral stance without
> strong left-right lean, single figure only, 1024x1024

### Flammenspeier · `flammenspeier`
Flächenschaden aus der Distanz, trifft auch Luft.

> An armored soldier with a riveted brass pressure tank on the back,
> hoses running to a long nozzle held in both hands in front of the
> body, faint heat shimmer around the nozzle tip, viewed from a steep
> three-quarter top-down angle showing the top of the tank and
> shoulders, braced ready stance.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, ember orange and iron palette,
> transparent background, no cast shadow, no ground, no text, neutral
> stance without strong left-right lean, single figure only, 1024x1024

### Sturmfalken · `sturmfalken`
Einzelnes Exemplar — das Spiel setzt drei davon. Fliegt, schwebt im
Spiel über seinem Schatten.

> A single falcon with storm-blue and white plumage, wings spread flat
> and level, talons tucked, faint crackling static along the feather
> tips, viewed from directly above showing the full wingspan silhouette,
> gliding posture.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, sky blue and white palette, transparent
> background, no cast shadow, no ground, no text, symmetrical stance,
> single figure only, 1024x1024

### Wolkenwal · `wolkenwal`
Fliegt, zieht zu Türmen.

> An enormous serene sky whale seen from directly above, deep violet
> skin with faint bioluminescent constellations along the back, long
> trailing fins spread to the sides, small wisps of cloud clinging to
> the body, calm drifting posture.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, deep violet and starlight palette,
> transparent background, no cast shadow, no ground, no text,
> symmetrical stance, single figure only, 1024x1024

### Bogenschützin · `bogenschuetzin`
Fernkampf, größte Reichweite.

> A hooded archer with a tall longbow drawn partway, weathered green
> cloak, quiver over the shoulder, viewed from a steep three-quarter
> top-down angle showing the top of the hood and the bow held across
> the body, steady watchful stance.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, warm gold and moss palette, transparent
> background, no cast shadow, no ground, no text, neutral stance without
> strong left-right lean, single figure only, 1024x1024

### Blitzmagier · `blitzmagier`
Fernkampf, stößt Getroffene zurück.

> A lean mage in a high-collared dark coat, arcs of bright cyan
> lightning crackling between spread palms held in front of the body,
> hair lifted by the discharge, viewed from a steep three-quarter
> top-down angle showing the top of the coat and shoulders, coiled ready
> stance.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, electric cyan and deep navy palette,
> transparent background, no cast shadow, no ground, no text, neutral
> stance without strong left-right lean, single figure only, 1024x1024

### Knochendiener · `knochendiener`
Interne Einheit, nur aus der Krypta. Kein Sammelkarte, aber läuft mit
über das Feld.

> A gaunt skeletal warrior, bleached bone, tattered grave wrappings, a
> short pitted rusted sword held ready, faint green glow in the eye
> sockets, viewed from a steep three-quarter top-down angle showing the
> top of the skull and shoulders, hunched shambling stance.
> Stylized fantasy game unit, bold simplified silhouette with slightly
> exaggerated proportions for readability at small size, dramatic rim
> lighting from the upper left, bone white and grave green palette,
> transparent background, no cast shadow, no ground, no text, neutral
> stance without strong left-right lean, single figure only, 1024x1024

---

## Die 2 Gebäude

Gebäude stehen fest und drehen sich nie — hier darf die Vorderseite klar
erkennbar zur Kamera zeigen, anders als bei den Einheiten.

### Bollwerk · `bollwerk`
Defensiv, zieht Angreifer auf sich.

> A squat fortified stone tower barely two storeys tall, thick grey
> masonry with iron reinforcement bands, narrow glowing crossbow slits,
> a mounted repeating crossbow visible at the top facing forward, viewed
> from a steep three-quarter top-down angle showing the roof and the
> front face of the structure.
> Stylized fantasy game structure, bold simplified silhouette, dramatic
> rim lighting from the upper left, cold grey stone palette, transparent
> background, no cast shadow, no ground, no text, 1024x1024

### Krypta · `krypta`
Spawner, schickt Knochendiener los.

> A low moss-covered stone crypt half sunk into the earth, a heavy slab
> door pushed ajar with sickly green light spilling out, carved
> weathered symbols on the lintel, viewed from a steep three-quarter
> top-down angle showing the roof slabs and the front doorway.
> Stylized fantasy game structure, bold simplified silhouette, dramatic
> rim lighting from the upper left, mossy green and grey stone palette,
> transparent background, no cast shadow, no ground, no text, 1024x1024

---

## Die 3 Zauber

Feuersturm, Funkenregen und Frostschleier haben keine stehende Figur —
sie sind ein Einschlag, kein Körper. Dafür reichen die Effektbilder aus
`kartenbilder.md` bereits aus; ein zweites Set brauchen sie nicht.

---

## Wenn die Bilder da sind

Erst mal nur ablegen — schadet nicht, wird aber noch nirgends gelesen:

```
arena/packages/client/public/assets/units/<id>.png
```

(Eigener Ordner `units/`, nicht `cards/` — sonst kollidiert der Dateiname
mit dem Kartensymbol, das oft bewusst anders aussieht.)

Damit sie tatsächlich über das Feld laufen, muss `render/einheit.ts`
noch lernen, pro Karte ein Bild zu laden und statt der Kapsel-Form zu
zeichnen, mit Fallback auf die Primitiven wie beim Turm. Sag Bescheid,
wenn ich das bauen soll, sobald die ersten Bilder stehen — lohnt sich am
meisten, wenn gleich mehrere auf einmal fertig sind, statt für jedes
einzelne einen neuen Durchlauf zu machen.
