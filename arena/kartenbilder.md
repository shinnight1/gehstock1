# Kartenbilder — Namen und Bildprompts

Für jede Karte ein fertiger Prompt. Die Prompts sind auf Englisch, weil
Bildmodelle damit deutlich zuverlässiger arbeiten — der Rest bleibt Deutsch.

## Wohin die Bilder kommen

Generiert wird als PNG. Abgelegt wird zweimal:

```
arena/bildquellen/cards/<id>.png     Original in voller Aufloesung
arena/packages/client/public/assets/cards/<id>.webp   ausgeliefert
```

Der Dateiname ist die **id** aus der Tabelle unten, nicht der Anzeigename.
Also `steinwaechter`, nicht `Steinwächter`. Liegt keine Datei da,
zeichnet das Spiel weiter die Farbfläche — es bricht nichts.

**Warum zwei Fassungen:** Das Rohmaterial kam mit über 2 MB pro Bild, alle
sechzehn zusammen 31,8 MB. Angezeigt wird eine Karte nie größer als 62 px
hoch. Heruntergerechnet auf 512 px und als WebP kodiert sind es noch rund
80 KB — zusammen 1,3 MB statt 31,8. Die Originale bleiben unter
`bildquellen/` liegen, falls später größere Darstellungen dazukommen; der
Ordner wird nicht ausgeliefert.

## Worauf es technisch ankommt

- **Quadratisch, 1024 × 1024.** Das Spiel schneidet je nach Ansicht oben
  und unten etwas ab (`background-size: cover`), deshalb muss das Motiv
  mittig sitzen und rundherum Luft haben. Nichts Wichtiges an den Rand.
- **Kein Text, keine Zahlen, kein Rahmen im Bild.** Rahmen, Name und
  Elixirkosten zeichnet das Spiel selbst darüber.
- **Dunkler Hintergrund**, damit es zur Oberfläche passt. Alternativ
  transparent — dann sieht es in der Sammlung noch sauberer aus.
- **Licht von vorne oben links.** So ist auch der Renderer beleuchtet;
  Bilder mit Licht von rechts wirken daneben falsch.

## Der gemeinsame Stilsatz

Steckt in jedem Prompt unten schon drin. Falls du eigene Karten ergänzt,
hier zum Kopieren:

> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, subject centered with generous margin,
> no text, no frame, no border, square composition, 1024x1024

---

## Die 16 Sammelkarten

### Steinwächter · `steinwaechter` · Selten · 5 Elixir
Belagerungstank, läuft stur auf Türme zu. Grundfarbe `#8d99ab`.

> A colossal humanoid guardian built from weathered grey stone slabs,
> moss growing in the cracks, blunt fists like battering rams, hollow
> glowing eye sockets, slow and unstoppable posture mid-stride.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, cool grey-blue palette, subject centered
> with generous margin, no text, no frame, square composition, 1024x1024

### Frostkoloss · `frostkoloss` · Gewöhnlich · 4 Elixir
Zäher Nahkämpfer, schlägt zurück. Grundfarbe `#5aa9d6`.

> A massive armored warrior encased in pale ice-blue plate armor, jagged
> icicles growing from shoulders and gauntlets, frozen breath clouding
> the visor, heavy stance with a frost-rimed greatsword lowered.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, icy blue and steel palette, subject
> centered with generous margin, no text, no frame, 1024x1024

### Rattenschar · `rattenschar` · Gewöhnlich · 2 Elixir
Sechs schnelle, billige Angreifer. Grundfarbe `#a3927a`.

> A swarm of six scrappy rats charging forward in a tight wedge, matted
> brown fur, tiny rusted blades and scavenged scrap armor, eyes catching
> the light, frantic energy and motion blur at the edges of the group.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, warm brown and dust palette, group
> centered with generous margin, no text, no frame, 1024x1024

### Hundemeute · `hundemeute` · Gewöhnlich · 3 Elixir
Vier schnelle Beißer, reißen Tanks herunter. Grundfarbe `#c07a4a`.

> Four lean war hounds leaping forward in formation, short russet fur,
> studded leather harnesses, bared teeth and pinned ears, front hound
> mid-air with paws extended, the others fanning out behind.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, burnt orange and leather palette, group
> centered with generous margin, no text, no frame, 1024x1024

### Speerwerferinnen · `speerwerferinnen` · Gewöhnlich · 3 Elixir
Drei Werferinnen, treffen auch Luft. Grundfarbe `#b8935e`.

> Three hunter women in light leather and cloth wraps, arms drawn back
> mid-throw with slender javelins angled upward at the sky, braided
> hair, focused upward gaze, staggered depth so all three read clearly.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, tan and ochre palette, group centered
> with generous margin, no text, no frame, 1024x1024

### Hammergarde · `hammergarde` · Selten · 4 Elixir
Ein Schlag, viele Treffer. Grundfarbe `#9b7bc9`.

> A heavily built warrior in deep violet plate armor swinging an
> oversized two-handed warhammer in a wide downward arc, shockwave dust
> ring beginning at the impact point, purple energy glowing along the
> hammer head, wide braced stance.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, violet and gunmetal palette, subject
> centered with generous margin, no text, no frame, 1024x1024

### Flammenspeier · `flammenspeier` · Episch · 4 Elixir
Fegt Schwärme aus der Distanz weg, Boden wie Luft. Grundfarbe `#e2703a`.

> An armored fire-thrower soldier with a riveted brass pressure tank
> strapped to the back, hoses running to a long nozzle held in both
> hands, a cone of orange flame bursting forward, heat shimmer and
> embers in the air, soot-darkened faceplate.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, ember orange and iron palette, subject
> centered with generous margin, no text, no frame, 1024x1024

### Sturmfalken · `sturmfalken` · Gewöhnlich · 3 Elixir
Drei Flieger, kommen über alles hinweg. Grundfarbe `#6fb8e8`.

> Three falcons diving in tight formation, storm-blue and white plumage,
> wings swept back, talons extended forward, faint crackling static
> along the feather tips, wind streaks trailing behind them.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, sky blue and white palette, group
> centered with generous margin, no text, no frame, 1024x1024

### Wolkenwal · `wolkenwal` · Legendär · 5 Elixir
Zieht unbeirrt zum Turm, nur Luftabwehr hält ihn auf. Grundfarbe `#7f6ae0`.

> An enormous serene sky whale drifting through the air, deep violet
> skin with faint bioluminescent constellations along the flanks, long
> trailing fins, small clouds clinging to its body, calm half-closed
> eye, immense scale suggested by tiny wisps around it.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, deep violet and starlight palette,
> subject centered with generous margin, no text, no frame, 1024x1024

### Bogenschützin · `bogenschuetzin` · Gewöhnlich · 3 Elixir
Größte Reichweite im Deck, verträgt keinen Nahkampf. Grundfarbe `#d4b06a`.

> A hooded archer at full draw with a tall longbow, weathered green
> cloak, quiver over the shoulder, one eye sighting along the arrow,
> steady and quiet posture, faint golden light along the bowstring.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, warm gold and moss palette, subject
> centered with generous margin, no text, no frame, 1024x1024

### Blitzmagier · `blitzmagier` · Episch · 4 Elixir
Schlägt Getroffene zurück und bricht Angriffe. Grundfarbe `#59d3f0`.

> A lean mage in a high-collared dark coat, arcs of bright cyan
> lightning crackling between spread palms, hair and coat lifted by the
> discharge, sharp electric highlights on the face, small bolts jumping
> to the ground nearby.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, electric cyan and deep navy palette,
> subject centered with generous margin, no text, no frame, 1024x1024

### Bollwerk · `bollwerk` · Selten · 4 Elixir
Zieht Angreifer auf sich und schießt zurück, hält 30 Sekunden. Grundfarbe `#7d8a9c`.

> A squat fortified stone tower barely two storeys tall, thick grey
> masonry, narrow crossbow slits glowing faintly, iron reinforcement
> bands, a mounted repeating crossbow visible at the top, standing alone
> on bare packed earth.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, cold grey stone palette, structure
> centered with generous margin, no text, no frame, 1024x1024

### Krypta · `krypta` · Selten · 4 Elixir
Schickt alle 4,5 Sekunden zwei Diener los. Grundfarbe `#6b7c6a`.

> A low moss-covered stone crypt half sunk into the earth, heavy slab
> door pushed slightly ajar, sickly green light spilling from the gap,
> carved weathered symbols on the lintel, thin mist pooling around the
> base, a skeletal hand just visible at the threshold.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, mossy green and grey stone palette,
> structure centered with generous margin, no text, no frame, 1024x1024

### Feuersturm · `feuersturm` · Episch · 4 Elixir
Großer Einschlag, räumt eine Gruppe ab. Grundfarbe `#f0603c`.

> A burning meteor slamming into scorched ground, expanding ring of
> orange fire and shockwave dust, cracked glowing earth radiating from
> the impact, embers and debris thrown upward, seen from a slightly
> elevated angle.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, fierce orange and red palette, impact
> centered with generous margin, no text, no frame, no characters,
> 1024x1024

### Funkenregen · `funkenregen` · Gewöhnlich · 2 Elixir
Klein und billig, genau richtig gegen Schwärme. Grundfarbe `#f5c542`.

> A dense rain of glowing golden sparks falling in a tight column onto
> dark ground, small bright impact flashes where they land, thin trails
> of light behind each spark, warm glow lighting the dust below.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, bright gold and amber palette, effect
> centered with generous margin, no text, no frame, no characters,
> 1024x1024

### Frostschleier · `frostschleier` · Selten · 3 Elixir
Halbiert Tempo und Schlagzahl, vier Sekunden lang. Grundfarbe `#8fd9f2`.

> A creeping veil of pale blue frost mist spreading low across dark
> ground, delicate ice crystals forming and branching outward, frozen
> blades of grass caught mid-freeze, faint cold glow beneath the fog.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, pale ice blue and white palette, effect
> centered with generous margin, no text, no frame, no characters,
> 1024x1024

---

## Bonus: die interne Einheit

**Knochendiener** · `knochendiener` — keine Sammelkarte. Sie taucht weder
in Rolls noch im Deckbau auf, wird aber von der Krypta erzeugt und läuft
auf dem Feld herum. Ein Bild lohnt sich trotzdem, sobald Einheiten eigene
Grafiken bekommen. Grundfarbe `#c9c3b0`.

> A gaunt skeletal warrior rising from the dirt, bleached bone, tattered
> grave wrappings hanging from the ribs, a short pitted rusted sword in
> one hand, faint green glow in the eye sockets, hunched forward stance.
> Stylized semi-realistic game card art, painterly digital illustration,
> bold readable silhouette, dramatic rim lighting from the upper left,
> dark desaturated background, bone white and grave green palette,
> subject centered with generous margin, no text, no frame, 1024x1024

---

## Wenn die Bilder da sind

Ablegen, neu bauen, fertig:

```bash
node tools/deploy-paket.mjs
```

Die Bilder erscheinen dann automatisch in Sammlung, Deckbau und im
Roll-Ergebnis. Auf dem Spielfeld selbst laufen die Einheiten weiterhin
als Canvas-Figuren — dort wären PNGs erst dann sinnvoll, wenn es
Laufanimationen mit mehreren Einzelbildern gibt.

## Ein Hinweis zur Einheitlichkeit

Wenn du alle sechzehn in einer Sitzung erzeugst, bleibt der Stil
zuverlässiger gleich, als wenn du über Tage verteilt nachlegst. Falls
eine Karte aus der Reihe fällt, hilft es meist, sie zusammen mit einer
bereits gelungenen neu zu erzeugen und dabei auf diese zu verweisen.

---

# Nachtrag: die zehn neuen Karten

Dieselben Regeln wie oben — quadratisch 1024 × 1024, freigestellt auf
durchsichtigem Grund, Motiv mittig mit Luft am Rand. Dateiname ist die
**id**, nicht der Anzeigename.

Es werden **zwei** Bilder je Karte gebraucht:

| wohin | was | Größe |
| --- | --- | --- |
| `bildquellen/cards/<id>.png` → `assets/cards/<id>.webp` | Kartenbild, Porträt, mit Wucht | 1024 |
| `bildquellen/units/<id>.png` → `assets/units/<id>.webp` | Feldfigur, ganze Gestalt, von schräg oben | 1024 |

Umgerechnet wird mit:

```bash
node arena/tools/bilder-wandeln.mjs cards 512 0.85
```

```bash
node arena/tools/bilder-wandeln.mjs units 320 0.85
```

Solange nichts da ist, zeichnet das Spiel Farbflächen und Kapseln —
es bricht nichts, es sieht nur unfertig aus.

## Schildwache · `schildwache` · 2 Elixir · gewöhnlich

> A stoic armored sentinel bracing behind an oversized tower shield,
> weathered grey steel, dented rim, feet planted wide in a defensive
> stance, no weapon raised — purely defensive posture, muted slate and
> gunmetal palette, dramatic rim light from the left, fantasy game card
> art, painterly, transparent background, centered, 1024x1024

## Klingenschwärmer · `klingenschwaermer` · 3 Elixir · gewöhnlich

> Four small winged blade-creatures flying in tight formation, bodies
> like folded razors with translucent insect wings, pale green and steel,
> motion blur on the wingtips, fast and fragile looking, fantasy game
> card art, painterly, transparent background, centered, 1024x1024

## Sturmbock · `sturmbock` · 4 Elixir · gewöhnlich

> A massive armored battering ram on wheels shaped like a charging ram's
> skull, iron-banded oak beam, dust kicked up beneath, leaning forward
> mid-charge, warm rust and brown tones, fantasy game card art,
> painterly, transparent background, centered, 1024x1024

## Windstoß · `windstoss` · 2 Elixir · gewöhnlich · Zauber

> A burst of concentrated wind rendered as spiralling pale blue air
> currents and swept dust, a visible shockwave ring at its heart, no
> creature, no caster — the spell effect alone, luminous white-cyan,
> fantasy game spell icon, painterly, transparent background, centered,
> 1024x1024

## Glutschleuder · `glutschleuder` · 3 Elixir · selten

> A compact siege catapult loaded with a glowing ember cluster, iron
> frame and taut rope, sparks rising from the payload, warm orange glow
> lighting the mechanism from within, fantasy game card art, painterly,
> transparent background, centered, 1024x1024

## Schattenklinge · `schattenklinge` · 3 Elixir · selten

> A lithe hooded assassin mid-lunge, twin curved daggers, cloak
> dissolving into wisps of shadow at the hem, deep violet and charcoal
> with a single cold highlight along the blades, fast and lethal,
> fantasy game card art, painterly, transparent background, centered,
> 1024x1024

## Dornenwall · `dornenwall` · 4 Elixir · selten

> A defensive structure of interwoven thorned vines grown over a stone
> base, long barbed tendrils coiled and ready to lash outward, deep
> green and grey with dark red thorn tips, static and rooted, fantasy
> game card art, painterly, transparent background, centered, 1024x1024

## Sturmreiter · `sturmreiter` · 5 Elixir · episch

> An armored rider astride a great storm-eagle in flight, lance lowered,
> crackling static arcing across the feathers, deep indigo and violet
> plumage with bright electric highlights, powerful and airborne,
> fantasy game card art, painterly, transparent background, centered,
> 1024x1024

## Nebelbrut · `nebelbrut` · 5 Elixir · episch

> A hollow spire of pale bone and grey mist with an open maw at its top,
> faint moth-like shapes spilling out of the opening, drifting fog
> around its base, muted lavender and bone-white, a building not a
> creature, fantasy game card art, painterly, transparent background,
> centered, 1024x1024

## Titanenfaust · `titanenfaust` · 6 Elixir · legendär

> A colossal stone-and-iron giant raising one enormous fist for a
> ground-shattering strike, cracks glowing molten orange along its
> forearm, moss and age on the shoulders, immense weight and slowness in
> the pose, low heroic angle, fantasy game card art, painterly,
> transparent background, centered, 1024x1024

## Nebelfalter · `nebelfalter` · von der Nebelbrut ausgeworfen

Nicht sammelbar, taucht also nie in der Sammlung auf — aber auf dem Feld
schon. Deshalb reicht hier das **Feldbild** allein.

> A single small ghostly moth of pale violet mist, translucent ragged
> wings, faint trailing vapor, fragile and weightless, fantasy game
> creature, painterly, transparent background, centered, 1024x1024

## Wie die Feldbilder sich unterscheiden

Für `bildquellen/units/` gilt dasselbe Motiv, aber:

- **ganze Gestalt**, nicht Brustbild — Füße müssen im Bild sein
- **von schräg oben** gesehen, etwa 30 Grad, passend zur Kameraperspektive
- **neutrale Haltung**, keine extreme Pose: die Figur steht später ruhig
  auf dem Feld und wird nur 30 bis 60 Pixel hoch dargestellt
- **hoher Kontrast zur Silhouette**, weil bei dieser Größe nur der Umriss
  übrig bleibt

Hänge dafür an jeden Prompt oben an:

> full body, standing, seen from a 30 degree elevated angle, neutral
> pose, strong readable silhouette
