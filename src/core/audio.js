/* ------------------------------------------------------------------
   Klang - komplett synthetisch.

   Es gibt keine Audiodateien, weil die Offline-Einzeldatei sonst gross
   wuerde und Dateien unter file:// ohnehin nicht nachgeladen werden
   koennen. Alles entsteht aus Oszillatoren und einem Rauschpuffer.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var ctx = null, master = null, noiseBuf = null, blocked = false;

  function ensure() {
    if (ctx || blocked) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { blocked = true; return null; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = SG.settings.get('volume');
      master.connect(ctx.destination);
    } catch (e) { blocked = true; ctx = null; }
    return ctx;
  }

  function noise() {
    if (noiseBuf) return noiseBuf;
    var n = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    var r = U.rng(1337);
    for (var i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return noiseBuf;
  }

  function on() { return SG.settings.get('sound') && !blocked; }

  /* Ein Ton mit Huellkurve */
  function tone(o) {
    if (!ensure()) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2 && o.f2 !== o.f) {
      if (o.slide === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + o.d);
      else osc.frequency.linearRampToValueAtTime(o.f2, t0 + o.d);
    }
    var vol = (o.v === undefined ? 0.25 : o.v);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + (o.a || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    osc.connect(g);
    if (o.filter) {
      var bq = ctx.createBiquadFilter();
      bq.type = o.filter; bq.frequency.value = o.fc || 1200; bq.Q.value = o.q || 1;
      g.connect(bq); bq.connect(master);
    } else g.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.d + 0.02);
  }

  /* Rauschstoss */
  function hiss(o) {
    if (!ensure()) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    var bq = ctx.createBiquadFilter();
    bq.type = o.filter || 'bandpass';
    bq.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) bq.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2), t0 + o.d);
    bq.Q.value = o.q || 1.2;
    var g = ctx.createGain();
    var vol = (o.v === undefined ? 0.2 : o.v);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    src.connect(bq); bq.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + o.d + 0.02);
  }

  /* Notenmittelpunkt: A4 = 440 Hz, halbtonweise */
  function note(n) { return 440 * Math.pow(2, n / 12); }

  var LIB = {
    click:   function () { tone({ f: 900, f2: 620, d: 0.045, v: 0.16, type: 'triangle' }); },
    tick:    function () { tone({ f: 1500, d: 0.02, v: 0.09, type: 'square' }); },
    blip:    function () { tone({ f: 660, f2: 990, d: 0.08, v: 0.18, type: 'square' }); },
    select:  function () { tone({ f: 520, f2: 780, d: 0.09, v: 0.16, type: 'triangle' }); },
    place:   function () { tone({ f: 300, f2: 190, d: 0.07, v: 0.2, type: 'triangle' }); },
    move:    function () { tone({ f: 380, d: 0.035, v: 0.11, type: 'sine' }); },
    error:   function () { tone({ f: 220, f2: 130, d: 0.19, v: 0.22, type: 'sawtooth', filter: 'lowpass', fc: 900 }); },
    coin:    function () { tone({ f: note(16), d: 0.06, v: 0.16, type: 'square' });
                           tone({ f: note(23), d: 0.13, v: 0.14, type: 'square', delay: 0.055 }); },
    cash:    function () { [0, 4, 7, 12].forEach(function (s, i) {
                             tone({ f: note(s + 7), d: 0.16, v: 0.1, type: 'triangle', delay: i * 0.045 }); }); },
    jump:    function () { tone({ f: 300, f2: 700, d: 0.11, v: 0.19, type: 'square', slide: 'exp' }); },
    land:    function () { hiss({ f: 500, f2: 120, d: 0.09, v: 0.14, filter: 'lowpass' }); },
    hit:     function () { hiss({ f: 1600, f2: 300, d: 0.1, v: 0.2 });
                           tone({ f: 180, f2: 60, d: 0.12, v: 0.16, type: 'sawtooth' }); },
    laser:   function () { tone({ f: 1300, f2: 240, d: 0.13, v: 0.14, type: 'sawtooth', slide: 'exp' }); },
    explode: function () { hiss({ f: 900, f2: 60, d: 0.42, v: 0.3, filter: 'lowpass', q: 0.7 });
                           tone({ f: 120, f2: 38, d: 0.34, v: 0.2, type: 'sawtooth' }); },
    thud:    function () { tone({ f: 130, f2: 55, d: 0.16, v: 0.24, type: 'sine' }); },
    whoosh:  function () { hiss({ f: 300, f2: 2400, d: 0.22, v: 0.11 }); },
    clear:   function () { [0, 5, 9, 12].forEach(function (s, i) {
                             tone({ f: note(s + 12), d: 0.13, v: 0.13, type: 'square', delay: i * 0.04 }); }); },
    power:   function () { [0, 7, 12, 16, 19].forEach(function (s, i) {
                             tone({ f: note(s), d: 0.12, v: 0.12, type: 'triangle', delay: i * 0.05 }); }); },
    win:     function () { [0, 4, 7, 12, 16, 19].forEach(function (s, i) {
                             tone({ f: note(s + 4), d: 0.3, v: 0.13, type: 'triangle', delay: i * 0.085 }); }); },
    lose:    function () { [0, -3, -7, -12].forEach(function (s, i) {
                             tone({ f: note(s + 2), d: 0.32, v: 0.15, type: 'sawtooth', delay: i * 0.13,
                                    filter: 'lowpass', fc: 1400 }); }); },
    levelup: function () { [0, 5, 12, 17, 24].forEach(function (s, i) {
                             tone({ f: note(s), d: 0.2, v: 0.12, type: 'square', delay: i * 0.06 }); }); },
    alert:   function () { tone({ f: 880, d: 0.1, v: 0.15, type: 'square' });
                           tone({ f: 660, d: 0.14, v: 0.15, type: 'square', delay: 0.13 }); },
    ship:    function () { tone({ f: 92, f2: 78, d: 0.9, v: 0.16, type: 'sawtooth', filter: 'lowpass', fc: 260 }); },
    crane:   function () { hiss({ f: 260, f2: 180, d: 0.34, v: 0.07, filter: 'bandpass', q: 2.4 }); },
    build:   function () { tone({ f: 420, f2: 640, d: 0.1, v: 0.16, type: 'square' });
                           hiss({ f: 1800, f2: 700, d: 0.11, v: 0.1, delay: 0.05 }); },
    deal:    function () { hiss({ f: 2600, f2: 900, d: 0.055, v: 0.11 }); },
    card:    function () { hiss({ f: 1800, f2: 600, d: 0.07, v: 0.13 }); },
    swipe:   function () { hiss({ f: 700, f2: 1800, d: 0.1, v: 0.07 }); },
    pop:     function () { tone({ f: 700, f2: 1400, d: 0.05, v: 0.14, type: 'sine', slide: 'exp' }); },
    rotate:  function () { tone({ f: 480, f2: 620, d: 0.04, v: 0.11, type: 'square' }); },
    drop:    function () { tone({ f: 240, f2: 110, d: 0.09, v: 0.19, type: 'triangle' });
                           hiss({ f: 900, f2: 200, d: 0.08, v: 0.09, delay: 0.02 }); },
  };

  var A = SG.audio = {
    play: function (name, opts) {
      if (!on()) return;
      var f = LIB[name];
      if (!f) return;
      try {
        if (ctx && ctx.state === 'suspended') ctx.resume();
        f(opts || {});
      } catch (e) { /* Ton darf nie das Spiel stoeren */ }
    },
    /* Freier Ton fuer Spiele mit eigener Tonleiter */
    tone: function (o) { if (on()) { try { tone(o); } catch (e) { /* egal */ } } },
    note: note,
    available: function () { return !blocked; },

    /* iOS erlaubt Audio erst nach einer Nutzergeste */
    unlock: function () {
      if (!SG.settings.get('sound')) return;
      var c = ensure();
      if (!c) return;
      try {
        if (c.state === 'suspended') c.resume();
        var b = c.createBuffer(1, 1, 22050);
        var s = c.createBufferSource();
        s.buffer = b; s.connect(c.destination); s.start(0);
      } catch (e) { /* egal */ }
    },

    setVolume: function (v) {
      if (master) { try { master.gain.value = v; } catch (e) { /* egal */ } }
    },
  };

  SG.settings.on('change:volume', function (v) { A.setVolume(v); });
  SG.settings.on('change:sound', function (v) { if (v) A.unlock(); });
})(SG);
