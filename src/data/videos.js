/* ------------------------------------------------------------------
   Das Regal von Gehstockflix.

   Jedes Video ist ein YouTube-Verweis. Gespeichert wird nur die
   Kennung — Vorschaubild und Abspieladresse rechnet sich der
   Bildschirm daraus zusammen, damit hier keine langen Adressen
   herumliegen, die man beim Nachtragen falsch abschreiben kann.

   Ein neues Video eintragen: die Kennung aus der Adresse nehmen
   (youtu.be/KENNUNG oder ?v=KENNUNG) und eine Zeile in die passende
   Reihe schreiben. Sonst ist nichts zu tun — Bild, Kachel und
   Abspieler entstehen von selbst.

   Achtung: Gehstockflix braucht Netz. In der Offline-Einzeldatei
   laedt weder Vorschaubild noch Abspieler; der Bildschirm sagt das
   dann auch.
   ------------------------------------------------------------------ */

(function (SG) {
  var F = SG.flix;

  /* id     Kennung bei YouTube
     titel  Name auf der Kachel
     kanal  wer es hochgeladen hat
     text   ein, zwei Saetze fuer den Kopf und die Infokarte */
  function V(id, titel, kanal, text) {
    return { id: id, titel: titel, kanal: kanal, text: text };
  }

  F.KATALOG = [
    {
      titel: 'Musicals',
      videos: [
        V('PaOSgk1WQFU', 'AfD-Lied', 'AfD TV',
          'Wahlkampflied vom Parteikanal der AfD.'),
        V('230GQb56o1E', 'Alice für Deutschland', 'Song Factory',
          'Rocknummer über die AfD-Vorsitzende, hochgeladen von der Song Factory.'),
        V('OQP4EPjMUMw', 'Vision 2026 — Alles ist möglich', 'the white rabbit',
          'Lied vom AfD-Wahlkampfauftakt in Magdeburg.'),
        V('xLF_SVOYz5g', 'Aufstehen für Deutschland', 'Herzschlag Nation',
          'AfD-Song vom Kanal Herzschlag Nation.'),
        V('QauHTyWkMZU', 'Ostdeutschland', 'Björn Banane',
          'Rapstück von Björn Banane.'),
        V('gX3KyAVFG08', 'Darf ich nicht', 'Björn Banane & Onkel Menga',
          'Musikvideo von Björn Banane zusammen mit Onkel Menga.'),
      ],
    },
    {
      titel: 'Dokus',
      videos: [
        V('Z3saAMLRW_g', 'Mangal gegen Haus des Döners', 'Holle21614',
          'Undercover-Vergleich: Lukas Podolskis Dönerladen gegen die Konkurrenz.'),
        V('xk-JN2RFS1c', 'Der Podolski-Döner im Test', 'Gamerstime',
          'GTime probiert den Döner von Mangal x LP10.'),
        V('W8Bj0yLqbX4', 'Tiefkühl-Dönerfleisch im Test', 'Holle21614',
          'Wie gut ist das Dönerfleisch von Lukas Podolski aus der Tiefkühltruhe?'),
        V('4R4DdSGQivo', '100 Jahre Gymnasium Leoninum', 'Gymnasium Leoninum Handrup',
          'Rückblick auf das Jubiläumsjahr 2023 der Schule in Handrup.'),
        V('9mmVa6O-hzQ', 'Python lernen in 10 Minuten', 'Programmieren lernen',
          'Kurzes Einsteiger-Tutorial auf Deutsch.'),
        V('EJZNky4hWwY', 'Das passiert, wenn du Kokain nimmst', 'tomatolix',
          'Selbstversuch-Reportage von tomatolix.'),
      ],
    },
    {
      titel: 'Action',
      videos: [
        V('xwFjWwBRQmI', 'Avatar but in Germany', 'Schlantologie',
          'Parodie-Trailer: Avatar, aber auf deutsch und in Deutschland.'),
        V('bB6YVsZIlQI', 'Nur mit 20 € von der Tankstelle überleben', 'Kelvin und Marvin',
          'Challenge: einen Tag lang nur von dem leben, was die Tankstelle hergibt.'),
        V('FFJN8g1H3vk', 'Bloody Mary um 3 Uhr nachts', 'Kelvin und Marvin',
          'Grusel-Challenge zur Geisterstunde.'),
      ],
    },
  ];

  /* ---------------------------------------------------------- Adressen */

  /* mqdefault gibt es zu jedem Video und ist echtes 16:9 - genau das,
     was die Kacheln brauchen. maxresdefault ist gross genug fuer den
     Kopf, fehlt aber bei aelteren Videos; dort faellt das Bild im
     Fehlerfall auf hqdefault zurueck (siehe flix.js). */
  F.bild = function (id, gross) {
    return 'https://i.ytimg.com/vi/' + id + '/'
      + (gross ? 'maxresdefault' : 'mqdefault') + '.jpg';
  };

  F.ersatzBild = function (id) {
    return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
  };

  /* nocookie passt zur Referrer-Policy der Seite: YouTube erfaehrt so
     wenig wie moeglich darueber, wer hier zuschaut. */
  F.einbetten = function (id) {
    return 'https://www.youtube-nocookie.com/embed/' + id
      + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
  };

  F.beiYoutube = function (id) {
    return 'https://www.youtube.com/watch?v=' + id;
  };

  /* ---------------------------------------------------------- Zugriff */

  F.alle = function () {
    var out = [];
    F.KATALOG.forEach(function (reihe) {
      reihe.videos.forEach(function (v) { out.push(v); });
    });
    return out;
  };

  F.anzahl = function () { return F.alle().length; };

  /* Wer oben im Kopf steht. Leer lassen heisst: bei jedem Besuch ein
     anderer. Eine Kennung eintragen heisst: immer dieses Video. */
  F.TOP = '';

  F.topVideo = function () {
    var alle = F.alle();
    if (!alle.length) return null;
    for (var i = 0; i < alle.length; i++) if (alle[i].id === F.TOP) return alle[i];
    return alle[Math.floor(Math.random() * alle.length)];
  };
})(SG);
