// Music and sound effects, all synthesized with the Web Audio API (no audio files).
//
// SFX.music(name)  starts a looping track: "menu", "draft", "beauty" or "clash"
// SFX.<sound>()    plays a one-shot (draw, place, select, tick, reroll, whoosh, impact, win, lose...)
// SFX.effect(name, kinds) plays the sound for a card effect: a signature sound for the big ones
//                  (Sharingan, ZA WARUDO, Gear 5...), otherwise one picked from the effect's layers.
//
// Browsers only allow audio after the player interacts, so nothing plays until the first click.
// Music and sound can be muted separately; the choice is remembered in this browser.

window.SFX = (() => {
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v ? "1" : "0"); } catch (e) { /* storage blocked: fine */ } },
  };
  let musicOn = store.get("ad-music", true);
  let sfxOn = store.get("ad-sfx", true);
  let ctx = null, master, musicBus, sfxBus, noiseBuf;
  const MUSIC_VOL = 0.28, SFX_VOL = 0.7;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -14; master.ratio.value = 4;
      master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? MUSIC_VOL : 0; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? SFX_VOL : 0; sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const now = () => ctx.currentTime;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- building blocks ----------
  function tone(freq, dur, o = {}) {
    const t = o.when ?? now();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t + (o.slideTime ?? dur));
    if (o.vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vibrato; lg.gain.value = freq * 0.03;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
    }
    const peak = o.gain ?? 0.3, a = o.attack ?? 0.005, r = o.release ?? dur * 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = o.filter; f.Q.value = o.q ?? 1;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + a + r + 0.05);
  }
  function noise(dur, o = {}) {
    const t = o.when ?? now();
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = o.filter || "bandpass"; f.frequency.setValueAtTime(o.freq ?? 1500, t); f.Q.value = o.q ?? 1;
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + dur);
    const peak = o.gain ?? 0.3, a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, dur));
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  // drums (also used by the music)
  const kick = (t, dest, v = 1) => tone(150, 0.32, { when: t, slideTo: 42, slideTime: 0.12, gain: 0.9 * v, release: 0.3, dest });
  const snare = (t, dest, v = 1) => { noise(0.18, { when: t, freq: 1800, q: 0.8, gain: 0.45 * v, dest }); tone(190, 0.12, { when: t, slideTo: 120, gain: 0.25 * v, dest }); };
  const hat = (t, dest, v = 1, open = false) => noise(open ? 0.2 : 0.045, { when: t, filter: "highpass", freq: 7500, gain: 0.16 * v, dest });
  const clap = (t, dest, v = 1) => [0, 0.012, 0.024].forEach((d) => noise(0.12, { when: t + d, freq: 1400, q: 1.2, gain: 0.25 * v, dest }));

  // ---------- one-shot sounds ----------
  const S = {
    click() { tone(880, 0.06, { type: "triangle", gain: 0.15 }); },
    select() { tone(660, 0.08, { type: "triangle", gain: 0.18 }); tone(990, 0.12, { type: "triangle", gain: 0.15, when: now() + 0.06 }); },
    draw() { noise(0.35, { freq: 400, sweepTo: 4000, q: 0.7, gain: 0.25, attack: 0.15 }); tone(523, 0.3, { type: "triangle", gain: 0.12, when: now() + 0.15 }); },
    place() { tone(180, 0.12, { type: "square", slideTo: 90, gain: 0.18, filter: 900 }); noise(0.06, { freq: 3000, gain: 0.12 }); },
    tick() { tone(1400, 0.04, { type: "square", gain: 0.07, filter: 3000 }); },
    reroll() { for (let i = 0; i < 6; i++) tone(400 + i * 120, 0.06, { type: "triangle", gain: 0.12, when: now() + i * 0.045 }); noise(0.3, { freq: 2000, sweepTo: 6000, gain: 0.12, attack: 0.1 }); },
    whoosh() { noise(0.4, { freq: 300, sweepTo: 2500, q: 0.6, gain: 0.3, attack: 0.2 }); },
    countTick() { tone(1200 + Math.random() * 200, 0.03, { type: "sine", gain: 0.06 }); },
    impact() {
      kick(now(), sfxBus, 1.2);
      noise(0.5, { filter: "lowpass", freq: 900, sweepTo: 120, gain: 0.6 });
      noise(0.15, { freq: 3500, gain: 0.3 });
    },
    drumroll(sec = 2) { for (let t = 0; t < sec; t += 0.045) snare(now() + t, sfxBus, 0.25 + 0.5 * (t / sec)); },
    win() {
      const t = now();
      [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36]].forEach(([m, d]) => tone(mtof(m), 0.5, { type: "square", gain: 0.12, filter: 3000, when: t + d }));
      [60, 64, 67, 72].forEach((m) => tone(mtof(m + 12), 1.4, { type: "triangle", gain: 0.1, when: t + 0.5, release: 1.3 }));
      kick(t + 0.5, sfxBus); clap(t + 0.5, sfxBus);
    },
    lose() {
      const t = now();
      [[67, 0], [66, 0.3], [65, 0.6], [64, 0.9]].forEach(([m, d], i) =>
        tone(mtof(m - 12), i === 3 ? 1.2 : 0.35, { type: "sawtooth", gain: 0.13, filter: 1200, when: t + d, vibrato: i === 3 ? 6 : 0 }));
    },
  };

  // Effect sounds, by layer kind.
  const KIND = {
    zap() { for (let i = 0; i < 5; i++) noise(0.08, { freq: 2500 + Math.random() * 3000, q: 3, gain: 0.25, when: now() + i * 0.06 }); tone(90, 0.4, { type: "sawtooth", gain: 0.08, filter: 600 }); },
    slash() { [0, 0.12].forEach((d) => noise(0.18, { freq: 6000, sweepTo: 1500, q: 2, gain: 0.3, when: now() + d, attack: 0.02 })); },
    boom() { S.impact(); },
    quake() { noise(1.2, { filter: "lowpass", freq: 200, gain: 0.7, attack: 0.05 }); kick(now(), sfxBus, 1.3); },
    flash() { noise(0.6, { filter: "highpass", freq: 3000, gain: 0.2, attack: 0.01 }); },
    aura() { noise(1.2, { freq: 500, sweepTo: 1500, q: 0.5, gain: 0.18, attack: 0.4 }); tone(110, 1.2, { type: "sawtooth", gain: 0.06, filter: 500, attack: 0.3 }); },
    shimmer() { [72, 76, 79, 84].forEach((m, i) => tone(mtof(m), 0.6, { type: "sine", gain: 0.08, when: now() + i * 0.07 })); },
  };
  const sparkle = () => [84, 88, 91, 96, 100].forEach((m, i) => tone(mtof(m), 0.5, { type: "sine", gain: 0.07, when: now() + i * 0.06 }));
  const sad = () => S.lose();

  // Signature sounds for specific effects.
  const SIGNATURE = {
    "SHARINGAN"() { noise(0.6, { freq: 200, sweepTo: 1200, gain: 0.25, attack: 0.3 }); tone(1760, 1.2, { type: "sine", gain: 0.12, vibrato: 7, when: now() + 0.25 }); tone(110, 1, { type: "sawtooth", gain: 0.08, filter: 400 }); },
    "ZA WARUDO"() {
      noise(0.9, { freq: 200, sweepTo: 5000, gain: 0.35, attack: 0.8 });
      S.impact();
      for (let i = 0; i < 4; i++) tone(1000, 0.05, { type: "square", gain: 0.08, filter: 2500, when: now() + 1 + i * 0.5 });
    },
    "GEAR 5"() { const t = now(); [0, 0.18, 0.36, 0.45, 0.63].forEach((d, i) => tone(i % 2 ? 260 : 200, 0.25, { slideTo: 120, gain: 0.5, when: t + d })); },
    "SERIOUS PUNCH"() { S.impact(); KIND.quake(); tone(55, 1.4, { type: "sine", gain: 0.5, release: 1.3 }); },
    "HAKAI"() { tone(55, 1.5, { type: "sawtooth", gain: 0.15, filter: 300, attack: 0.3 }); tone(82, 1.5, { type: "sine", gain: 0.2, attack: 0.3 }); noise(1, { freq: 600, sweepTo: 150, gain: 0.2, attack: 0.5 }); },
    "INFINITE VOID"() { tone(40, 2.2, { type: "sine", gain: 0.4, attack: 0.5 }); [88, 95, 100].forEach((m, i) => tone(mtof(m), 1.6, { gain: 0.05, when: now() + 0.3 + i * 0.2, vibrato: 5 })); },
    "ERASE"() { noise(1.2, { filter: "highpass", freq: 1000, gain: 0.35, attack: 1 }); },
    "ARISE"() { [33, 40, 45].forEach((m) => tone(mtof(m), 1.8, { type: "sawtooth", gain: 0.12, filter: 700, attack: 0.6 })); setTimeout(() => sfxOn && ctx && S.impact(), 450); },
    "EXCALIBUR"() { noise(1, { freq: 300, sweepTo: 6000, gain: 0.3, attack: 0.9 }); [60, 64, 67, 72].forEach((m) => tone(mtof(m), 1.6, { type: "sawtooth", gain: 0.06, filter: 2500, attack: 0.4, when: now() + 0.6 })); },
    "STAR PLATINUM"() { for (let i = 0; i < 12; i++) { kick(now() + i * 0.07, sfxBus, 0.6); noise(0.05, { freq: 2500, gain: 0.2, when: now() + i * 0.07 }); } },
    "ZAFKIEL"() { for (let i = 0; i < 6; i++) tone(i % 2 ? 900 : 1200, 0.05, { type: "square", gain: 0.08, filter: 2500, when: now() + i * 0.25 }); tone(65, 1.5, { gain: 0.25, attack: 0.3 }); },
  };
  SIGNATURE["MANGEKYŌ SHARINGAN"] = SIGNATURE["SHARINGAN"];
  SIGNATURE["KAMUI"] = SIGNATURE["SHARINGAN"];
  ["CERTIFIED BUM", "GET IN THE ROBOT", "RED FLAG"].forEach((n) => (SIGNATURE[n] = sad));
  ["RIZZ", "DARLING", "MERO MERO MELLOW", "HEART OF GOLD", "STUNNING", "COSPLAY QUEEN", "EYE CONTACT", "DRIP CHECK", "THE PEOPLE'S CHAMP", "MUSIC OF UTA"].forEach((n) => (SIGNATURE[n] = sparkle));
  const KIND_ORDER = ["quake", "boom", "zap", "slash", "flash", "aura"];

  function effect(name, kinds) {
    if (!sfxOn || !ensure()) return;
    if (name && SIGNATURE[name]) return SIGNATURE[name]();
    const k = KIND_ORDER.find((x) => kinds && kinds.has(x));
    (KIND[k] || KIND.shimmer)();
  }

  // ---------- music ----------
  // Patterns are 16 steps per bar ("x" = hit). Chords are [root midi note, "m" | "M"].
  const TRACKS = {
    menu: { bpm: 84, chords: [[57, "m"], [53, "M"], [48, "M"], [55, "M"]], kick: "x...............", snare: "", hat: "", bass: "x.......x.......", arp: "x..x..x..x..x...", arpOct: 2, pad: true, lead: "triangle" },
    draft: { bpm: 100, chords: [[57, "m"], [53, "M"], [48, "M"], [55, "M"]], kick: "x.....x...x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", bass: "x.x.x.x.x.x.x.x.", arp: "x.xxx.xxx.xxx.xx", arpOct: 2, pad: true, lead: "triangle" },
    beauty: { bpm: 108, chords: [[53, "M"], [55, "M"], [52, "m"], [57, "m"]], kick: "x.......x.......", snare: "", clap: "....x.......x...", hat: "..x...x...x...x.", bass: "x..x..x.x..x..x.", arp: "x.x.x.x.x.x.x.x.", arpOct: 2, pad: true, lead: "sine", bell: true },
    clash: { bpm: 140, chords: [[50, "m"], [46, "M"], [48, "M"], [45, "M"]], kick: "x...x...x...x...", snare: "....x.......x..x", hat: "..x...x...x...x.", openHat: true, bass: "xxxxxxxxxxxxxxxx", arp: "xxxxxxxxxxxxxxxx", arpOct: 2, pad: false, lead: "sawtooth" },
  };
  let seq = null;

  function chordNotes([root, q]) { return [root, root + (q === "m" ? 3 : 4), root + 7]; }

  function playStep(s, step, t) {
    const T = s.T, pos = step % 16, bar = Math.floor(step / 16) % T.chords.length;
    const ch = chordNotes(T.chords[bar]), out = s.out, sp = 60 / T.bpm / 4;
    if (T.kick[pos] === "x") kick(t, out, 0.8);
    if (T.snare && T.snare[pos] === "x") snare(t, out, 0.7);
    if (T.clap && T.clap[pos] === "x") clap(t, out, 0.8);
    if (T.hat && T.hat[pos] === "x") hat(t, out, 0.8, T.openHat && pos % 4 === 2);
    if (T.bass[pos] === "x") tone(mtof(ch[0] - 12), sp * 1.8, { when: t, type: "sawtooth", gain: 0.16, filter: 420, q: 4, release: sp * 1.6, dest: out });
    if (T.arp[pos] === "x") {
      const seqNotes = [ch[0], ch[1], ch[2], ch[1] + 12, ch[2], ch[1]];
      const m = seqNotes[step % seqNotes.length] + 12 * (T.arpOct - 1);
      tone(mtof(m), sp * 1.5, { when: t, type: T.lead, gain: T.lead === "sawtooth" ? 0.05 : 0.08, filter: T.lead === "sawtooth" ? 2200 : undefined, release: sp * 1.4, dest: out });
      if (T.bell && pos % 4 === 0) tone(mtof(m + 12), 0.6, { when: t, type: "sine", gain: 0.04, release: 0.6, dest: out });
    }
    if (T.pad && pos === 0) ch.forEach((n) => tone(mtof(n), sp * 16, { when: t, type: "sawtooth", gain: 0.035, filter: 900, attack: 0.4, release: sp * 15, dest: out }));
  }

  function schedule() {
    const s = seq;
    if (!s) return;
    const sp = 60 / s.T.bpm / 4;
    while (s.next < now() + 0.15) { playStep(s, s.step, s.next); s.step++; s.next += sp; }
  }

  function music(name) {
    if (!ensure()) return;
    if (seq && seq.name === name) return;
    stopMusic();
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now());
    out.gain.exponentialRampToValueAtTime(1, now() + 1.2);
    out.connect(musicBus);
    seq = { name, T: TRACKS[name], step: 0, next: now() + 0.1, out };
    seq.timer = setInterval(schedule, 25);
  }
  function stopMusic() {
    if (!seq) return;
    const s = seq; seq = null;
    clearInterval(s.timer);
    s.out.gain.setTargetAtTime(0.0001, now(), 0.25);
    setTimeout(() => s.out.disconnect(), 2000);
  }

  // Wrap one-shots so they're silent when sound is off (and never throw before audio exists).
  const api = {};
  Object.keys(S).forEach((k) => (api[k] = (...a) => { if (sfxOn && ensure()) S[k](...a); }));
  // Live getters (Object.assign would copy them as fixed values).
  Object.defineProperty(api, "musicOn", { get: () => musicOn });
  Object.defineProperty(api, "sfxOn", { get: () => sfxOn });
  return Object.assign(api, {
    unlock: ensure,
    music,
    stopMusic,
    effect,
    setMusic(on) { musicOn = on; store.set("ad-music", on); if (ctx) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, now(), 0.1); },
    setSfx(on) { sfxOn = on; store.set("ad-sfx", on); if (ctx) sfxBus.gain.setTargetAtTime(on ? SFX_VOL : 0, now(), 0.05); },
  });
})();
