// Visual effects that play when a character card appears.
//
// Two canvases sit around the character card: #fxBack (behind it) and #fxFront
// (over it, under the UI). An effect is a list of layers; each layer draws one
// thing (particles, lightning, a spinning symbol...) every frame.
//
// Which effect a character gets:
//   1. SPECIAL[id] if they have a signature effect (Madara's Sharingan, Gojo's Infinite Void...)
//   2. otherwise the "bum" effect if their BUM rating is 85+ (Mineta, Yamcha, Megumi...)
//   3. otherwise a GENERAL effect for their best stat, if it is 80+
//      (IQ -> floating equations, Speed -> speed lines, Strength -> ground cracks...)
//
// To give a character a signature effect, add an entry to SPECIAL below.

window.FX = (() => {
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    const r = hex.length === 4 ? ((n >> 8) & 15) * 17 : (n >> 16) & 255;
    const g = hex.length === 4 ? ((n >> 4) & 15) * 17 : (n >> 8) & 255;
    const b = hex.length === 4 ? (n & 15) * 17 : n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); };
  const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

  // ---------- canvas plumbing ----------
  const canvases = { back: document.getElementById("fxBack"), front: document.getElementById("fxFront") };
  const ctx = { back: canvases.back.getContext("2d"), front: canvases.front.getContext("2d") };
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    for (const c of Object.values(canvases)) {
      c.width = W * dpr; c.height = H * dpr;
      c.style.width = W + "px"; c.style.height = H + "px";
    }
  }
  window.addEventListener("resize", resize);
  resize();

  let main = [];       // layers of the current character effect
  let transient = [];  // short one-off layers (impacts) with an end time
  let anchorEl = null;
  let raf = null, last = 0;

  function anchor() {
    if (anchorEl && anchorEl.isConnected) {
      const r = anchorEl.getBoundingClientRect();
      if (r.width) return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
    return { x: W / 2 - 150, y: H / 2 - 200, w: 300, h: 400, cx: W / 2, cy: H / 2 };
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    for (const g of Object.values(ctx)) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); }
    const A = anchor();
    const run = (L) => {
      const g = ctx[L.layer || "back"];
      g.save();
      L.draw(g, (now - L.t0) / 1000, dt, A);
      g.restore();
    };
    main.forEach(run);
    transient = transient.filter((L) => now < L.end);
    transient.forEach(run);
    raf = main.length || transient.length ? requestAnimationFrame(frame) : null;
  }
  function ensureRunning() {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  const stamp = (layers) => { const t0 = performance.now(); layers.forEach((L) => (L.t0 = t0)); return layers; };

  // ---------- screen shake ----------
  function shake(ms = 400, px = 10) {
    const b = document.body;
    b.style.setProperty("--shake", px + "px");
    b.classList.remove("shake");
    void b.offsetWidth;
    b.classList.add("shake");
    clearTimeout(shake.t);
    shake.t = setTimeout(() => b.classList.remove("shake"), ms);
  }

  // =====================================================================
  // Layer builders
  // =====================================================================

  // Run a function once, `time` seconds in.
  const at = (time, fn) => ({ draw(g, t) { if (!this.done && t >= time) { this.done = true; fn(); } } });

  const tint = (color, alpha) => ({
    draw(g, t) { g.fillStyle = rgba(color, alpha * easeOut(t / 0.4)); g.fillRect(0, 0, W, H); },
  });

  const glow = (color, alpha = 0.55, scale = 1) => ({
    draw(g, t, dt, A) {
      const r = Math.max(A.w, A.h) * 0.85 * scale * (1 + 0.06 * Math.sin(t * 3));
      const grd = g.createRadialGradient(A.cx, A.cy, 0, A.cx, A.cy, r);
      grd.addColorStop(0, rgba(color, alpha * easeOut(t / 0.3)));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    },
  });

  const flash = (color = "#ffffff", dur = 0.45, alpha = 0.85) => ({
    layer: "front", kind: "flash",
    draw(g, t) {
      if (t > dur) return;
      g.fillStyle = rgba(color, alpha * (1 - t / dur));
      g.fillRect(0, 0, W, H);
    },
  });

  function drawShape(g, o, p, s, a) {
    g.globalAlpha = a;
    switch (o.shape) {
      case "flame": {
        const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 2);
        grd.addColorStop(0, p.color);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.fillRect(p.x - s * 2, p.y - s * 2, s * 4, s * 4);
        break;
      }
      case "line": {
        g.strokeStyle = p.color; g.lineWidth = s; g.lineCap = "round";
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); g.stroke();
        break;
      }
      case "drop": {
        g.strokeStyle = p.color; g.lineWidth = s;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
        break;
      }
      case "text": {
        g.fillStyle = p.color;
        g.font = `${o.fontWeight || 600} ${Math.round(s)}px ${o.font || "Oswald, Arial"}`;
        g.textAlign = "center";
        if (o.textGlow) { g.shadowColor = p.color; g.shadowBlur = 12; }
        g.fillText(p.text, p.x, p.y);
        break;
      }
      default: {
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        if (o.shape === "square") g.fillRect(-s / 2, -s / 2, s, s);
        else if (o.shape === "confetti") { g.scale(Math.cos(p.rot * 3), 1); g.fillRect(-s / 2, -s / 4, s, s / 2); }
        else if (o.shape === "feather") { g.beginPath(); g.ellipse(0, 0, s * 2.2, s * 0.6, 0, 0, TAU); g.fill(); }
        else if (o.shape === "shard") {
          g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, s * 0.6); g.lineTo(-s * 0.5, s * 0.8); g.closePath();
          g.fill(); g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 1.5; g.stroke();
        } else if (o.shape === "page") {
          g.fillRect(-s * 1.5, -s * 2, s * 3, s * 4);
          g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1;
          for (let i = 1; i < 7; i++) { g.beginPath(); g.moveTo(-s * 1.3, -s * 2 + i * s * 0.55); g.lineTo(s * 1.3, -s * 2 + i * s * 0.55); g.stroke(); }
        } else { g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill(); }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    g.globalAlpha = 1;
    g.shadowBlur = 0;
  }

  // Generic particle emitter.
  function particles(opts) {
    const o = Object.assign({
      layer: "back", count: 50, burst: 0, colors: ["#ffffff"], size: [2, 5], speed: [40, 90], life: [1, 2.5],
      spawn: "aura", dir: -Math.PI / 2, spread: 0.35, gravity: 0, shape: "circle", blend: "lighter",
      shrink: true, spin: 0, wobble: 0, texts: null,
    }, opts);
    // Screen-wide emitters start with some particles already on screen.
    if (!o.burst && (o.spawn === "screen" || o.spawn === "top")) o.burst = Math.round(o.count * 0.5);
    const ps = [];
    let acc = 0, burstDone = false;
    function spawn(A) {
      let x = A.cx, y = A.cy, ang = (typeof o.dir === "number" ? o.dir : 0) + rand(-o.spread, o.spread);
      switch (o.spawn) {
        case "aura":
          if (Math.random() < 0.5) { x = rand(A.x, A.x + A.w); y = A.y + A.h * rand(0.75, 1); }
          else { x = Math.random() < 0.5 ? A.x + rand(-12, 14) : A.x + A.w + rand(-14, 12); y = rand(A.y + A.h * 0.15, A.y + A.h); }
          break;
        case "top": x = rand(0, W); y = -30; break;
        case "screen": x = rand(0, W); y = rand(0, H); break;
        case "bottom": x = rand(0, W); y = H + 20; break;
        case "card": x = rand(A.x, A.x + A.w); y = rand(A.y, A.y + A.h); break;
        case "ring": {
          const a = rand(0, TAU), r = Math.max(A.w, A.h) * (o.ringScale || 0.62);
          x = A.cx + Math.cos(a) * r; y = A.cy + Math.sin(a) * r * 0.85;
          ang = a + Math.PI / 2;
          break;
        }
      }
      if (o.spawn === "top" && !burstDone) y = rand(-30, H * 0.8); // initial burst fills the screen
      if (o.dir === "out") ang = o.spawn === "center" ? rand(0, TAU) : Math.atan2(y - A.cy, x - A.cx);
      const sp = rand(o.speed[0], o.speed[1]);
      ps.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, age: 0, life: rand(o.life[0], o.life[1]),
        size: rand(o.size[0], o.size[1]), color: pick(o.colors), rot: rand(0, TAU), vr: rand(-1, 1) * o.spin,
        seed: Math.random(), text: o.texts ? pick(o.texts) : null,
      });
    }
    return {
      layer: o.layer,
      draw(g, t, dt, A) {
        if (o.burst && !burstDone) { for (let i = 0; i < o.burst; i++) spawn(A); burstDone = true; }
        if (o.count) {
          acc += (dt * o.count) / ((o.life[0] + o.life[1]) / 2);
          while (acc >= 1) { spawn(A); acc--; }
        }
        g.globalCompositeOperation = o.blend;
        for (let i = ps.length - 1; i >= 0; i--) {
          const p = ps[i];
          p.age += dt;
          if (p.age > p.life) { ps.splice(i, 1); continue; }
          p.vy += o.gravity * dt;
          p.x += p.vx * dt + (o.wobble ? Math.sin(p.age * 3 + p.seed * 10) * o.wobble * dt : 0);
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          const k = p.age / p.life;
          const a = Math.min(1, p.age * 5) * (1 - k);
          drawShape(g, o, p, o.shrink ? p.size * (1 - k * 0.7) : p.size, a);
        }
      },
    };
  }

  // Jagged lightning bolts.
  function boltPath(x1, y1, x2, y2, disp) {
    let pts = [[x1, y1], [x2, y2]];
    for (let i = 0; i < 6; i++) {
      const n = [pts[0]];
      for (let j = 1; j < pts.length; j++) {
        const [ax, ay] = pts[j - 1], [bx, by] = pts[j];
        n.push([(ax + bx) / 2 + rand(-disp, disp), (ay + by) / 2 + rand(-disp, disp)], [bx, by]);
      }
      pts = n; disp /= 2;
    }
    return pts;
  }
  function lightning(opts) {
    const o = Object.assign({ layer: "back", colors: ["#9fd8ff"], every: [0.08, 0.35], region: "card", width: 3, sky: false }, opts);
    const bolts = [];
    let next = 0;
    return {
      layer: o.layer, kind: "zap",
      draw(g, t, dt, A) {
        if (t >= next) {
          next = t + rand(o.every[0], o.every[1]);
          let x1, y1, x2, y2;
          if (o.sky) { x1 = A.cx + rand(-W * 0.2, W * 0.2); y1 = 0; x2 = A.cx + rand(-30, 30); y2 = A.y + A.h * 0.3; }
          else if (o.region === "screen") { x1 = rand(0, W); y1 = rand(0, H * 0.5); x2 = x1 + rand(-300, 300); y2 = y1 + rand(150, 450); }
          else {
            const a = rand(0, TAU), r1 = Math.max(A.w, A.h) * 0.45, r2 = r1 * rand(1.1, 1.6);
            x1 = A.cx + Math.cos(a) * r1 * 0.75; y1 = A.cy + Math.sin(a) * r1;
            const b = a + rand(-0.6, 0.6);
            x2 = A.cx + Math.cos(b) * r2 * 0.75; y2 = A.cy + Math.sin(b) * r2;
          }
          bolts.push({ pts: boltPath(x1, y1, x2, y2, Math.hypot(x2 - x1, y2 - y1) * 0.25), born: t, color: pick(o.colors) });
        }
        g.globalCompositeOperation = "lighter";
        g.lineJoin = "round";
        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i], age = t - b.born;
          if (age > 0.22) { bolts.splice(i, 1); continue; }
          const a = 1 - age / 0.22;
          g.beginPath();
          b.pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.shadowColor = b.color; g.shadowBlur = 18;
          g.strokeStyle = rgba(b.color, a); g.lineWidth = o.width * 2.2; g.stroke();
          g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = o.width * 0.8; g.stroke();
        }
        g.shadowBlur = 0;
      },
    };
  }

  // Blade slashes across the screen.
  function slashes(opts) {
    const o = Object.assign({ layer: "front", color: "#ff2a2a", every: [0.15, 0.5], width: 10 }, opts);
    const list = [];
    let next = 0.1;
    return {
      layer: o.layer, kind: "slash",
      draw(g, t, dt, A) {
        if (t >= next) {
          next = t + rand(o.every[0], o.every[1]);
          const a = rand(0, Math.PI), len = Math.max(W, H) * rand(0.5, 0.9);
          const cx = A.cx + rand(-A.w, A.w), cy = A.cy + rand(-A.h * 0.6, A.h * 0.6);
          list.push({ cx, cy, a, len, born: t, w: o.width * rand(0.6, 1.4) });
        }
        for (let i = list.length - 1; i >= 0; i--) {
          const s = list[i], age = t - s.born;
          if (age > 0.5) { list.splice(i, 1); continue; }
          const grow = easeOut(age / 0.08), fade = age < 0.1 ? 1 : 1 - (age - 0.1) / 0.4;
          const dx = Math.cos(s.a) * s.len / 2, dy = Math.sin(s.a) * s.len / 2;
          const x1 = s.cx - dx, y1 = s.cy - dy, x2 = s.cx - dx + dx * 2 * grow, y2 = s.cy - dy + dy * 2 * grow;
          const nx = -Math.sin(s.a) * s.w, ny = Math.cos(s.a) * s.w;
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          g.beginPath();
          g.moveTo(x1, y1);
          g.quadraticCurveTo(mx + nx, my + ny, x2, y2);
          g.quadraticCurveTo(mx + nx * 0.2, my + ny * 0.2, x1, y1);
          g.shadowColor = o.color; g.shadowBlur = 25;
          g.fillStyle = rgba(o.color, fade); g.fill();
          g.shadowBlur = 0;
          g.fillStyle = `rgba(255,255,255,${fade * 0.9})`;
          g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(mx + nx * 0.5, my + ny * 0.5, x2, y2); g.quadraticCurveTo(mx + nx * 0.3, my + ny * 0.3, x1, y1); g.fill();
        }
      },
    };
  }

  // Manga speed lines (radial burst or horizontal streaks).
  function speedLines(opts) {
    const o = Object.assign({ layer: "back", mode: "radial", color: "#ffffff", count: 60, alpha: 0.35 }, opts);
    let lines = [], next = 0;
    return {
      layer: o.layer,
      draw(g, t, dt, A) {
        if (t >= next) {
          next = t + 0.07;
          lines = Array.from({ length: o.count }, () =>
            o.mode === "radial"
              ? { a: rand(0, TAU), w: rand(0.004, 0.018), r: rand(0.45, 0.8) }
              : { y: rand(0, H), x: rand(-200, W), len: rand(150, 600), w: rand(1, 4) });
        }
        const env = easeOut(t / 0.25);
        g.fillStyle = rgba(o.color, o.alpha * env);
        if (o.mode === "radial") {
          const R = Math.hypot(W, H), r0 = Math.max(A.w, A.h) * 0.55;
          lines.forEach((l) => {
            const r1 = r0 * (1 + l.r);
            g.beginPath();
            g.moveTo(A.cx + Math.cos(l.a) * r1, A.cy + Math.sin(l.a) * r1);
            g.lineTo(A.cx + Math.cos(l.a - l.w) * R, A.cy + Math.sin(l.a - l.w) * R);
            g.lineTo(A.cx + Math.cos(l.a + l.w) * R, A.cy + Math.sin(l.a + l.w) * R);
            g.fill();
          });
        } else {
          lines.forEach((l) => g.fillRect(l.x, l.y, l.len, l.w));
        }
      },
    };
  }

  // A symbol (eye, sigil, magic circle) drawn centred on the card.
  // env: [fadeInEnd, holdEnd, fadeOutEnd] seconds, for a quick flash over the card.
  function symbol(drawFn, opts) {
    const o = Object.assign({ layer: "back", size: 1.7, spin: 0.4, alpha: 0.6, env: null, glowColor: null }, opts);
    return {
      layer: o.layer,
      draw(g, t, dt, A) {
        let a = o.alpha;
        if (o.env) {
          const [i, h, f] = o.env;
          a *= t < i ? t / i : t < h ? 1 : t < f ? 1 - (t - h) / (f - h) : 0;
          if (a <= 0) return;
        } else a *= easeOut(t / 0.5);
        const r = A.h * o.size * 0.5 * (0.6 + 0.4 * easeOut(t / 0.45));
        g.globalAlpha = a;
        g.translate(A.cx, A.cy);
        g.rotate(t * o.spin);
        if (o.glowColor) { g.shadowColor = o.glowColor; g.shadowBlur = 40; }
        drawFn(g, r, t);
      },
    };
  }

  // Big slammed-in text ("SMASH!", "HAKAI").
  function bigText(text, opts) {
    const o = Object.assign({ color: "#ffd166", at: 0.15, dur: 1.5, size: 0.2 }, opts);
    return {
      layer: "front", kind: "boom",
      draw(g, t, dt, A) {
        const lt = t - o.at;
        if (lt < 0 || lt > o.dur) return;
        const s = lt < 0.15 ? 2.4 - 1.4 * (lt / 0.15) : 1 + 0.03 * (lt - 0.15);
        const a = lt > o.dur - 0.35 ? (o.dur - lt) / 0.35 : 1;
        const px = Math.min(W * 0.16, A.h * o.size);
        g.globalAlpha = a;
        g.translate(A.cx, A.cy);
        g.rotate(-0.08);
        g.scale(s, s);
        g.font = `italic 700 ${px}px Oswald, Arial`;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.lineWidth = px * 0.09; g.strokeStyle = "#000"; g.lineJoin = "round";
        g.strokeText(text, 0, 0);
        g.shadowColor = o.color; g.shadowBlur = 30;
        g.fillStyle = o.color;
        g.fillText(text, 0, 0);
      },
    };
  }

  // Ground cracks spreading from under the card.
  function cracks(opts) {
    const o = Object.assign({ layer: "back", color: "#ffb347", count: 7 }, opts);
    let paths = null;
    return {
      layer: o.layer, kind: "quake",
      draw(g, t, dt, A) {
        const ox = A.cx, oy = A.y + A.h * 0.96;
        if (!paths) {
          paths = Array.from({ length: o.count }, () => {
            let a = rand(Math.PI * 0.95, Math.PI * 2.05), x = 0, y = 0;
            const pts = [[0, 0]];
            for (let i = 0; i < 9; i++) {
              a += rand(-0.45, 0.45);
              const step = rand(25, 60);
              x += Math.cos(a) * step; y += Math.sin(a) * step * 0.45;
              pts.push([x, y]);
            }
            return pts;
          });
        }
        const grow = easeOut(t / 0.3);
        const fade = t > 2.5 ? Math.max(0, 1 - (t - 2.5)) : 1;
        g.lineJoin = "round";
        paths.forEach((pts) => {
          const n = Math.max(2, Math.ceil(pts.length * grow));
          g.beginPath();
          for (let i = 0; i < n; i++) (i ? g.lineTo : g.moveTo).call(g, ox + pts[i][0], oy + pts[i][1]);
          g.shadowColor = o.color; g.shadowBlur = 16;
          g.strokeStyle = rgba(o.color, 0.9 * fade); g.lineWidth = 5; g.stroke();
          g.shadowBlur = 0;
          g.strokeStyle = `rgba(20,10,0,${fade})`; g.lineWidth = 2; g.stroke();
        });
      },
    };
  }

  // Flowing water bands (Water Breathing).
  const waves = (color) => ({
    draw(g, t, dt, A) {
      const env = easeOut(t / 0.5);
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const y0 = A.cy + (i - 2) * A.h * 0.22;
        g.beginPath();
        for (let x = -20; x <= W + 20; x += 16) {
          const y = y0 + Math.sin(x * 0.008 + t * 2.2 + i * 1.3) * 40 + Math.sin(x * 0.021 - t * 1.4) * 12;
          x === -20 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.shadowColor = color; g.shadowBlur = 20;
        g.strokeStyle = rgba(color, 0.45 * env); g.lineWidth = 14 - i * 1.5; g.stroke();
        g.strokeStyle = `rgba(255,255,255,${0.5 * env})`; g.lineWidth = 2; g.stroke();
      }
    },
  });

  // Blood tendrils reaching in from the edges (Muzan).
  function tendrils(color) {
    const roots = Array.from({ length: 9 }, (_, i) => ({ side: i % 3, k: Math.random(), seed: Math.random() * 10 }));
    return {
      draw(g, t, dt, A) {
        const reach = easeOut(t / 0.8);
        g.lineCap = "round";
        roots.forEach((r) => {
          const sx = r.side === 0 ? 0 : r.side === 1 ? W : r.k * W;
          const sy = r.side === 2 ? H : r.k * H;
          const ex = sx + (A.cx - sx) * 0.8 * reach, ey = sy + (A.cy - sy) * 0.8 * reach;
          const c1x = sx + (ex - sx) * 0.33 + Math.sin(t * 2 + r.seed) * 80, c1y = sy + (ey - sy) * 0.33 + Math.cos(t * 1.7 + r.seed) * 80;
          const c2x = sx + (ex - sx) * 0.66 + Math.cos(t * 2.3 + r.seed) * 60, c2y = sy + (ey - sy) * 0.66 + Math.sin(t * 1.9 + r.seed) * 60;
          for (const [w, col] of [[16, rgba("#2a0000", 0.9)], [9, rgba(color, 0.9)], [3, "rgba(255,120,120,.8)"]]) {
            g.beginPath(); g.moveTo(sx, sy); g.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
            g.strokeStyle = col; g.lineWidth = w; g.stroke();
          }
        });
      },
    };
  }

  // Starfield swirling into a void (Infinite Void).
  function voidSpiral() {
    const stars = [];
    return {
      draw(g, t, dt, A) {
        const env = easeOut(t / 0.6);
        g.fillStyle = `rgba(2,4,20,${0.55 * env})`;
        g.fillRect(0, 0, W, H);
        const R = Math.hypot(W, H) * 0.6;
        while (stars.length < 220) stars.push({ a: rand(0, TAU), r: rand(R * 0.2, R), sp: rand(0.15, 0.5), c: pick(["#ffffff", "#a8c8ff", "#c9a8ff", "#7fd1ff"]) });
        g.globalCompositeOperation = "lighter";
        stars.forEach((s) => {
          const r0 = s.r;
          s.r -= s.r * s.sp * dt;
          s.a += (1.4 * dt * R) / Math.max(40, s.r) * 0.15;
          if (s.r < 15) { s.r = R; s.a = rand(0, TAU); }
          g.strokeStyle = rgba(s.c, env * Math.min(1, s.r / 120));
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(A.cx + Math.cos(s.a - 0.04) * r0, A.cy + Math.sin(s.a - 0.04) * r0);
          g.lineTo(A.cx + Math.cos(s.a) * s.r, A.cy + Math.sin(s.a) * s.r);
          g.stroke();
        });
        for (let i = 0; i < 4; i++) {
          const k = ((t * 0.5 + i / 4) % 1);
          circle(g, A.cx, A.cy, k * R * 0.8);
          g.strokeStyle = `rgba(150,190,255,${0.35 * (1 - k) * env})`;
          g.lineWidth = 3; g.stroke();
        }
      },
    };
  }

  // Dimensional swirl (Kamui).
  const swirl = (color) => ({
    draw(g, t, dt, A) {
      const env = easeOut(t / 0.5), R = Math.max(A.w, A.h) * 1.3;
      g.lineWidth = 6;
      for (let k = 0; k < 7; k++) {
        g.beginPath();
        for (let r = 10; r < R; r += 8) {
          const a = (k * TAU) / 7 + r * 0.012 - t * 2.4;
          const x = A.cx + Math.cos(a) * r, y = A.cy + Math.sin(a) * r;
          r === 10 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.strokeStyle = rgba(k % 2 ? color : "#000000", 0.55 * env);
        g.stroke();
      }
    },
  });

  // The White Room: a sterile white grid.
  const whiteRoom = () => ({
    draw(g, t) {
      const env = easeOut(t / 0.7);
      g.fillStyle = `rgba(235,240,245,${0.28 * env})`;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = `rgba(255,255,255,${0.35 * env})`;
      g.lineWidth = 1;
      const s = 60, off = (t * 12) % s;
      for (let x = -s + off; x < W + s; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = -s + off; y < H + s; y += s) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    },
  });

  // Golden portals that fire weapons at the card (Gate of Babylon).
  function gates() {
    const portals = [];
    let next = 0;
    return {
      draw(g, t, dt, A) {
        if (t >= next && portals.length < 14) {
          next = t + rand(0.08, 0.2);
          portals.push({ x: rand(W * 0.05, W * 0.95), y: rand(H * 0.05, H * 0.55), born: t, r: rand(26, 50) });
        }
        g.globalCompositeOperation = "lighter";
        portals.forEach((p) => {
          const age = t - p.born, open = easeOut(age / 0.3);
          for (let i = 0; i < 3; i++) {
            g.beginPath();
            g.ellipse(p.x, p.y, p.r * open * (1 - i * 0.25), p.r * open * 0.45 * (1 - i * 0.25), 0, 0, TAU);
            g.strokeStyle = rgba("#ffd166", 0.85 - i * 0.2); g.lineWidth = 3 - i;
            g.shadowColor = "#ffb000"; g.shadowBlur = 18; g.stroke();
          }
          // a blade launches from the portal toward the card, then a new one reloads
          const k = ((age - 0.3) % 0.9) / 0.5;
          if (age > 0.3 && k <= 1) {
            const tx = A.cx + (p.x - A.cx) * 0.15, ty = A.cy + (p.y - A.cy) * 0.15;
            const x = p.x + (tx - p.x) * k, y = p.y + (ty - p.y) * k;
            const a = Math.atan2(ty - p.y, tx - p.x);
            g.strokeStyle = "rgba(255,240,200,.95)"; g.lineWidth = 3;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * 46, y - Math.sin(a) * 46); g.stroke();
          }
        });
        g.shadowBlur = 0;
      },
    };
  }

  // DIO's time stop: the whole page flips to negative, then drains to sepia.
  function timeStop() {
    const b = document.body;
    b.classList.remove("zawarudo");
    void b.offsetWidth;
    b.classList.add("zawarudo");
    clearTimeout(timeStop.t);
    timeStop.t = setTimeout(() => b.classList.remove("zawarudo"), 1800);
  }
  const clockFace = (g, r, t) => {
    g.strokeStyle = "#ffe066"; g.lineWidth = r * 0.03;
    circle(g, 0, 0, r); g.stroke();
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = polar(r * 0.85, (i * TAU) / 12), [x2, y2] = polar(r * 0.97, (i * TAU) / 12);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    const hand = Math.min(t, 1.2) * 3; // the hand stops when time stops
    g.lineWidth = r * 0.04;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(...polar(r * 0.8, hand - Math.PI / 2)); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(...polar(r * 0.5, hand / 12 - Math.PI / 2)); g.stroke();
  };
  // Makima's ringed eyes.
  const rings = (g, r, t) => {
    for (let i = 6; i >= 1; i--) {
      circle(g, 0, 0, (r * i) / 6 * (1 + 0.03 * Math.sin(t * 3 + i)));
      g.fillStyle = i % 2 ? "#ffcc33" : "#b30000";
      g.fill();
    }
    g.fillStyle = "#1a0000"; circle(g, 0, 0, r * 0.12); g.fill();
  };

  // Mob's percentage meter climbing to 100%.
  const meter = () => ({
    layer: "front",
    draw(g, t, dt, A) {
      const pct = Math.min(100, Math.floor(Math.pow(clamp01(t / 2.2), 2) * 100));
      if (pct === 100 && !this.hit) { this.hit = true; shake(500, 12); }
      const label = pct < 100 ? `${pct}%` : t % 0.4 < 0.2 ? "???%" : "100%";
      const px = Math.min(W * 0.12, A.h * 0.16);
      g.font = `700 ${px}px Oswald, Arial`;
      g.textAlign = "center";
      g.lineWidth = px * 0.08; g.strokeStyle = "#000"; g.strokeText(label, A.cx, A.y + px * 0.9);
      g.shadowColor = "#c77dff"; g.shadowBlur = 30;
      g.fillStyle = pct < 100 ? "#ffffff" : "#e0aaff";
      g.fillText(label, A.cx, A.y + px * 0.9);
    },
  });

  // ---------- symbols ----------
  function tomoe(g, R, a, s) {
    const [x, y] = polar(R, a), [ox, oy] = polar(s, a);
    circle(g, x, y, s); g.fill();
    const [tx, ty] = polar(R + s * 0.3, a - 0.6);
    const [c1x, c1y] = polar(R + s * 1.3, a - 0.3);
    const [c2x, c2y] = polar(R, a - 0.3);
    g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(c1x, c1y, tx, ty); g.quadraticCurveTo(c2x, c2y, x - ox, y - oy); g.fill();
  }
  function redIris(g, r) {
    const grd = g.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    grd.addColorStop(0, "#ff4a4a"); grd.addColorStop(0.75, "#c20000"); grd.addColorStop(1, "#4a0000");
    g.fillStyle = grd; circle(g, 0, 0, r); g.fill();
    g.shadowBlur = 0;
    g.lineWidth = r * 0.07; g.strokeStyle = "#000"; circle(g, 0, 0, r); g.stroke();
  }
  function sharingan(g, r) {
    redIris(g, r);
    g.lineWidth = r * 0.025; g.strokeStyle = "rgba(0,0,0,.8)"; circle(g, 0, 0, r * 0.58); g.stroke();
    g.fillStyle = "#000"; circle(g, 0, 0, r * 0.2); g.fill();
    for (let k = 0; k < 3; k++) tomoe(g, r * 0.58, (k * TAU) / 3, r * 0.13);
  }
  function mangekyo(g, r) {
    redIris(g, r);
    g.fillStyle = "#000";
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3;
      const [c1x, c1y] = polar(r * 0.85, a + 0.95), [ex, ey] = polar(r * 0.95, a), [c2x, c2y] = polar(r * 0.45, a + 0.1);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(c1x, c1y, ex, ey); g.quadraticCurveTo(c2x, c2y, 0, 0); g.fill();
    }
    circle(g, 0, 0, r * 0.22); g.fill();
    g.fillStyle = "#c20000"; circle(g, 0, 0, r * 0.1); g.fill();
  }
  function geass(g, r) {
    g.strokeStyle = "#ff2a3a"; g.lineWidth = r * 0.06; g.lineCap = "round";
    g.beginPath();
    g.moveTo(-r, -r * 0.1); g.quadraticCurveTo(-r * 0.4, -r * 0.55, 0, 0); g.quadraticCurveTo(r * 0.4, -r * 0.55, r, -r * 0.1);
    g.moveTo(-r * 0.75, -r * 0.12); g.quadraticCurveTo(-r * 0.35, r * 0.05, -r * 0.08, r * 0.3);
    g.moveTo(r * 0.75, -r * 0.12); g.quadraticCurveTo(r * 0.35, r * 0.05, r * 0.08, r * 0.3);
    g.moveTo(0, 0); g.lineTo(0, r * 0.6); g.lineTo(-r * 0.22, r * 0.9);
    g.moveTo(0, r * 0.6); g.lineTo(r * 0.22, r * 0.9);
    g.stroke();
  }
  const magicCircle = (color) => (g, r, t) => {
    g.strokeStyle = color; g.lineWidth = r * 0.018;
    circle(g, 0, 0, r); g.stroke();
    circle(g, 0, 0, r * 0.86); g.stroke();
    for (let i = 0; i < 48; i++) {
      const a = (i * TAU) / 48, [x1, y1] = polar(r * 0.88, a), [x2, y2] = polar(r * (i % 4 ? 0.94 : 0.99), a);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    for (const off of [0, Math.PI]) {
      g.beginPath();
      for (let k = 0; k <= 3; k++) { const [x, y] = polar(r * 0.86, off + (k * TAU) / 3 - Math.PI / 2); k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    g.rotate(-t * 1.2);
    circle(g, 0, 0, r * 0.42); g.stroke();
    for (let k = 0; k < 6; k++) { const [x, y] = polar(r * 0.42, (k * TAU) / 6); circle(g, x, y, r * 0.05); g.stroke(); }
  };
  const hexShield = (color) => (g, r, t) => {
    const s = r * 0.13, hw = s * Math.sqrt(3);
    g.lineWidth = 2;
    for (let row = -8; row <= 8; row++) {
      for (let col = -8; col <= 8; col++) {
        const x = col * hw + (row % 2 ? hw / 2 : 0), y = row * s * 1.5, d = Math.hypot(x, y);
        if (d > r) continue;
        const pulse = 0.25 + 0.75 * Math.max(0, Math.sin(t * 3 - d * 0.02));
        g.strokeStyle = rgba(color, (1 - d / r) * 0.4 + pulse * 0.4);
        g.beginPath();
        for (let k = 0; k <= 6; k++) { const [px, py] = polar(s * 0.95, (k * TAU) / 6 + Math.PI / 6); k ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py); }
        g.stroke();
      }
    }
  };
  const hud = (color) => (g, r, t) => {
    g.strokeStyle = color; g.lineWidth = 2;
    circle(g, 0, 0, r); g.stroke();
    g.lineWidth = 5;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, 0, r * 0.88, t * 1.5 + (k * TAU) / 3, t * 1.5 + (k * TAU) / 3 + 0.8); g.stroke(); }
    g.lineWidth = 3;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(0, 0, r * 0.7, -t + (k * TAU) / 4, -t + (k * TAU) / 4 + 0.4); g.stroke(); }
    g.lineWidth = 2;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      g.beginPath(); g.moveTo(dx * r * 0.75, dy * r * 0.75); g.lineTo(dx * r * 1.15, dy * r * 1.15); g.stroke();
    }
    const sy = Math.sin(t * 1.8) * r;
    g.globalAlpha *= 0.6; g.beginPath(); g.moveTo(-r * 1.2, sy); g.lineTo(r * 1.2, sy); g.stroke();
  };

  // =====================================================================
  // Effects
  // =====================================================================
  const EQUATIONS = ["E = mc²", "∫ f(x) dx", "∑ 1/n²", "π ≈ 3.14159", "a² + b² = c²", "∇ × B", "eᶦᵖ + 1 = 0", "lim x→∞", "Δx · Δp ≥ ħ/2", "f′(x)", "√2", "log₂ n", "P(A|B)", "x = −b ± √Δ", "∞", "θ", "λ"];
  const FORMULAS = ["H₂SO₄", "C₆H₁₂O₆", "NaOH", "HNO₃", "CaCO₃", "KNO₃ + C + S", "Fe₂O₃", "NH₃", "H₂O", "CO₂", "10,000,000,000%"];
  const CHESS = ["♔", "♕", "♖", "♗", "♘", "♙", "♚", "♛", "♜", "♝", "♞", "♟"];

  const SPECIAL = {
    madara: () => ({ name: "SHARINGAN", layers: [
      tint("#200000", 0.4), glow("#ff1a1a", 0.5),
      symbol(sharingan, { size: 2, spin: 0.5, alpha: 0.55 }),
      symbol(sharingan, { layer: "front", size: 0.85, spin: 3, env: [0.15, 0.9, 1.5] }),
      particles({ colors: ["#ff3030", "#ff8080"], count: 40, shape: "flame", size: [5, 12], speed: [30, 70] }),
    ] }),
    itachi: () => ({ name: "MANGEKYŌ SHARINGAN", layers: [
      tint("#1a0000", 0.45), glow("#ff1a1a", 0.45),
      symbol(mangekyo, { size: 2, spin: 0.4, alpha: 0.55 }),
      symbol(mangekyo, { layer: "front", size: 0.85, spin: 2.5, env: [0.15, 0.9, 1.5] }),
      particles({ layer: "front", spawn: "screen", colors: ["#050505", "#151515"], blend: "source-over", shape: "feather", count: 30, size: [5, 9], speed: [20, 50], dir: Math.PI / 2, spread: 0.6, spin: 2, shrink: false, life: [2, 4], wobble: 40 }),
    ] }),
    sasuke: () => ({ name: "CHIDORI", layers: [
      glow("#4da3ff", 0.5),
      symbol(sharingan, { layer: "front", size: 0.8, spin: 3, env: [0.12, 0.6, 1.1] }),
      lightning({ colors: ["#7cc4ff", "#c9e6ff"], every: [0.04, 0.15], width: 3 }),
      particles({ colors: ["#9fd8ff"], count: 40, shape: "line", size: [1, 2], speed: [150, 300], dir: "out", spawn: "card", life: [0.2, 0.5] }),
    ] }),
    kakashi: () => ({ name: "KAMUI", layers: [swirl("#5b2a86"), glow("#8a4fff", 0.35), symbol(mangekyo, { layer: "front", size: 0.7, spin: 4, env: [0.12, 0.6, 1.1] })] }),
    naruto: () => ({ name: "NINE-TAILS CHAKRA", layers: [
      glow("#ff8c00", 0.6, 1.2), tint("#2a1000", 0.3),
      particles({ colors: ["#ff8c00", "#ffb000", "#ff5a00"], count: 110, shape: "flame", size: [8, 18], speed: [60, 140], life: [0.7, 1.5] }),
    ] }),
    goku: () => ({ name: "ULTRA INSTINCT", layers: [
      glow("#cfe6ff", 0.55, 1.2),
      particles({ colors: ["#dfefff", "#a9c9ff", "#ffffff"], count: 100, shape: "flame", size: [8, 16], speed: [70, 140], life: [0.6, 1.3] }),
      particles({ colors: ["#ffffff"], count: 40, size: [1, 2.5], speed: [40, 100], spawn: "card", life: [1, 2] }),
    ] }),
    vegeta: () => ({ name: "SUPER SAIYAN", layers: [
      glow("#ffd23f", 0.6, 1.2),
      particles({ colors: ["#ffe066", "#ffd000", "#fff3b0"], count: 110, shape: "flame", size: [8, 18], speed: [70, 150], life: [0.6, 1.3] }),
      lightning({ colors: ["#8fd3ff"], every: [0.2, 0.6], width: 2 }),
    ] }),
    jiren: () => ({ name: "FULL POWER", layers: [
      glow("#ff3030", 0.55, 1.2), tint("#1a0000", 0.3),
      particles({ colors: ["#ff3b3b", "#ff7b00"], count: 90, shape: "flame", size: [8, 16], speed: [60, 130], life: [0.7, 1.4] }),
      cracks({ color: "#ff5030" }), at(0.05, () => shake(500, 10)),
    ] }),
    beerus: () => ({ name: "HAKAI", layers: [
      tint("#14001f", 0.45), glow("#b14dff", 0.5),
      particles({ spawn: "ring", colors: ["#c77dff", "#9d4edd", "#e0aaff"], count: 90, shape: "flame", size: [5, 11], speed: [80, 160], life: [0.8, 1.6] }),
      bigText("HAKAI", { color: "#d39bff" }),
    ] }),
    saitama: () => ({ name: "SERIOUS PUNCH", layers: [
      flash("#ffffff", 0.5, 0.95), speedLines({ color: "#ffffff", count: 80, alpha: 0.45 }),
      cracks({ color: "#ffd23f", count: 9 }), at(0.05, () => shake(650, 18)),
      bigText("ONE PUNCH", { color: "#ffd23f" }),
    ] }),
    luffy: () => ({ name: "GEAR 5", layers: [
      tint("#ffffff", 0.12), glow("#ffffff", 0.55, 1.3), speedLines({ color: "#ffffff", count: 50, alpha: 0.3 }),
      particles({ colors: ["#ffffff", "#f0f0ff"], blend: "source-over", count: 30, size: [10, 26], speed: [20, 60], life: [1.5, 3], shrink: false }),
      bigText("GEAR 5", { color: "#ffffff" }),
    ] }),
    shanks: () => ({ name: "CONQUEROR'S HAKI", layers: [
      tint("#000000", 0.45), glow("#ff2020", 0.35),
      lightning({ region: "screen", colors: ["#ff2a2a", "#ff6060", "#b0002a"], every: [0.06, 0.2], width: 4 }),
      at(0.05, () => shake(600, 9)),
    ] }),
    gojo: () => ({ name: "INFINITE VOID", layers: [voidSpiral(), glow("#6fa8ff", 0.45)] }),
    sukuna: () => ({ name: "MALEVOLENT SHRINE", layers: [
      tint("#250000", 0.45), glow("#ff1a1a", 0.4),
      slashes({ color: "#ff2020", every: [0.06, 0.2] }),
    ] }),
    toji: () => ({ name: "HEAVENLY RESTRICTION", layers: [
      tint("#000000", 0.3), speedLines({ mode: "horizontal", color: "#d0d0d0", count: 40, alpha: 0.35 }),
      slashes({ color: "#cfcfcf", every: [0.25, 0.6], width: 7 }),
    ] }),
    aizen: () => ({ name: "KYŌKA SUIGETSU", layers: [
      flash("#ffffff", 0.35, 0.7), glow("#9d4edd", 0.45),
      particles({ layer: "front", spawn: "center", dir: "out", burst: 40, count: 12, colors: ["rgba(200,220,255,.55)", "rgba(220,200,255,.5)"], blend: "source-over", shape: "shard", size: [14, 34], speed: [120, 380], spin: 3, life: [1.2, 2.2], shrink: false }),
    ] }),
    ichigo: () => ({ name: "BANKAI", layers: [
      tint("#000000", 0.4), glow("#ff1a1a", 0.4),
      particles({ colors: ["#ff2020", "#ff5050", "#300000"], count: 80, shape: "flame", size: [8, 16], speed: [60, 130], life: [0.6, 1.3] }),
      slashes({ color: "#ff1a1a", every: [0.5, 1.1], width: 14 }),
    ] }),
    yhwach: () => ({ name: "THE ALMIGHTY", layers: [
      tint("#000000", 0.35), glow("#4da3ff", 0.4),
      symbol(magicCircle("#7cc4ff"), { size: 1.9, spin: 0.25, alpha: 0.6, glowColor: "#4da3ff" }),
      particles({ colors: ["#7cc4ff", "#ffffff"], count: 40, size: [1, 3], spawn: "card", speed: [20, 60] }),
    ] }),
    allmight: () => ({ name: "SMASH", layers: [
      glow("#ffd23f", 0.5), speedLines({ color: "#ffe066", count: 70, alpha: 0.35 }),
      lightning({ colors: ["#ffe066"], every: [0.1, 0.35] }), at(0.12, () => shake(500, 14)),
      bigText("SMASH!", { color: "#ffd23f" }),
    ] }),
    deku: () => ({ name: "ONE FOR ALL", layers: [
      glow("#3ddc84", 0.45),
      lightning({ colors: ["#5dff9e", "#b4ffd0"], every: [0.05, 0.18], width: 2.5 }),
      particles({ colors: ["#5dff9e"], count: 40, size: [1, 3], spawn: "card", speed: [30, 80] }),
    ] }),
    bakugo: () => ({ name: "HOWITZER IMPACT", layers: [
      glow("#ff7b00", 0.5),
      particles({ spawn: "center", dir: "out", burst: 80, count: 60, colors: ["#ff7b00", "#ffb000", "#ff3d00"], shape: "flame", size: [10, 24], speed: [150, 420], life: [0.4, 0.9] }),
      at(0.05, () => shake(450, 12)),
    ] }),
    allforone: () => ({ name: "ALL FOR ONE", layers: [
      tint("#000000", 0.4), glow("#7a0000", 0.4),
      tendrils("#5a0a2a"),
    ] }),
    levi: () => ({ name: "HUMANITY'S STRONGEST", layers: [
      speedLines({ mode: "horizontal", color: "#e8e8e8", count: 35, alpha: 0.3 }),
      slashes({ color: "#cfe3ff", every: [0.1, 0.3], width: 8 }),
    ] }),
    eren: () => ({ name: "TITAN SHIFT", layers: [
      flash("#ffe066", 0.5, 0.8), glow("#ff8c00", 0.45),
      lightning({ sky: true, colors: ["#ffe066"], every: [0.15, 0.6], width: 6 }), at(0.05, () => shake(550, 14)),
      particles({ colors: ["rgba(220,220,220,.35)"], blend: "source-over", count: 40, size: [18, 40], speed: [20, 60], life: [1.5, 3] }),
    ] }),
    killua: () => ({ name: "GODSPEED", layers: [
      glow("#4da3ff", 0.45), speedLines({ mode: "horizontal", color: "#9fd8ff", count: 30, alpha: 0.3 }),
      lightning({ colors: ["#7cc4ff", "#ffffff"], every: [0.04, 0.12], width: 2.5 }),
    ] }),
    meruem: () => ({ name: "KING OF THE ANTS", layers: [
      tint("#06140a", 0.35), glow("#80ed99", 0.35),
      symbol(hexShield("#80ed99"), { size: 2.1, spin: 0.05, alpha: 0.5 }),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(180,255,200,.6)"], shape: "text", texts: EQUATIONS.slice(0, 6).concat(["GUNGI"]), count: 12, size: [16, 26], speed: [10, 25], life: [2.5, 4], shrink: false, blend: "source-over" }),
    ] }),
    netero: () => ({ name: "100-TYPE GUANYIN", layers: [
      glow("#ffd166", 0.5, 1.3),
      symbol(magicCircle("#ffd166"), { size: 2, spin: 0.2, alpha: 0.55, glowColor: "#ffb000" }),
      particles({ spawn: "ring", ringScale: 0.85, colors: ["#ffd166", "#fff1b8"], count: 70, shape: "flame", size: [5, 10], speed: [60, 120] }),
    ] }),
    yoriichi: () => ({ name: "SUN BREATHING", layers: [
      glow("#ff7b00", 0.55, 1.2),
      particles({ spawn: "ring", ringScale: 0.68, colors: ["#ff7b00", "#ffb000", "#ff3d00"], count: 160, shape: "flame", size: [8, 16], speed: [140, 220], life: [0.5, 1] }),
      particles({ colors: ["#ffb000"], count: 30, size: [1, 3], spawn: "card", speed: [30, 80] }),
    ] }),
    tanjiro: () => ({ name: "WATER BREATHING", layers: [
      waves("#3aa8ff"), glow("#3aa8ff", 0.3),
      particles({ colors: ["#bfe6ff"], count: 40, size: [2, 4], spawn: "card", speed: [40, 90], dir: "out" }),
    ] }),
    muzan: () => ({ name: "DEMON KING", layers: [tint("#1a0000", 0.45), tendrils("#a0001a"), glow("#ff1a3a", 0.3)] }),
    light: () => ({ name: "DEATH NOTE", layers: [
      tint("#000000", 0.4), glow("#ff1a1a", 0.35),
      particles({ layer: "front", spawn: "top", colors: ["#f2efe6", "#e6e2d6"], blend: "source-over", shape: "page", count: 14, size: [8, 14], speed: [60, 120], dir: Math.PI / 2, spread: 0.3, spin: 2, wobble: 60, life: [4, 6], shrink: false }),
    ] }),
    l: () => ({ name: "THE DETECTIVE", layers: [
      tint("#000000", 0.25),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(255,255,255,.75)"], shape: "text", texts: ["L", "KIRA?", "5%", "∴", "?", "probability", "suspect"], count: 16, size: [16, 30], speed: [8, 20], life: [2.5, 4], shrink: false, blend: "source-over", font: "Georgia, serif" }),
    ] }),
    mob: () => ({ name: "???%", layers: [
      glow("#c77dff", 0.5, 1.2), meter(),
      particles({ spawn: "card", dir: "out", colors: ["#c77dff", "#e0aaff"], count: 80, shape: "flame", size: [5, 12], speed: [60, 160], life: [0.6, 1.2] }),
    ] }),
    tatsumaki: () => ({ name: "PSYCHIC STORM", layers: [
      glow("#3ddc84", 0.45),
      particles({ spawn: "ring", ringScale: 0.75, colors: ["#3ddc84", "#a8ffcf"], count: 90, shape: "flame", size: [5, 10], speed: [160, 260], life: [0.6, 1.2] }),
      particles({ spawn: "bottom", colors: ["#6b5d4f", "#8a7a68", "#4a4038"], blend: "source-over", shape: "square", count: 20, size: [6, 16], speed: [60, 140], spin: 3, life: [3, 5], shrink: false }),
    ] }),
    ayanokoji: () => ({ name: "THE WHITE ROOM", layers: [
      whiteRoom(),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(255,255,255,.85)", "rgba(20,20,20,.85)"], blend: "source-over", shape: "text", texts: CHESS, count: 14, size: [28, 52], speed: [6, 18], life: [3, 5], shrink: false, font: "serif", fontWeight: 400 }),
    ] }),
    lelouch: () => ({ name: "GEASS", layers: [
      tint("#120006", 0.4), glow("#ff1a3a", 0.4),
      symbol(geass, { layer: "front", size: 0.75, spin: 0, env: [0.15, 0.9, 1.6], glowColor: "#ff2a3a" }),
      symbol(geass, { size: 1.9, spin: 0, alpha: 0.45, glowColor: "#ff2a3a" }),
      particles({ colors: ["#ff2a3a"], count: 30, size: [1, 3], spawn: "card", speed: [20, 60] }),
    ] }),
    senku: () => ({ name: "TEN BILLION PERCENT", layers: [
      glow("#90be6d", 0.35),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(170,255,140,.85)", "rgba(255,255,255,.8)"], shape: "text", texts: FORMULAS, count: 18, size: [16, 30], speed: [10, 25], life: [2.5, 4], shrink: false, blend: "source-over", textGlow: true }),
    ] }),
    // ---- top tiers ----
    featherine: () => ({ name: "THE AUTHOR", layers: [
      tint("#14001f", 0.45), glow("#e9c46a", 0.5, 1.3),
      symbol(magicCircle("#ffd166"), { size: 2.1, spin: 0.15, alpha: 0.55, glowColor: "#ffb000" }),
      particles({ layer: "front", spawn: "top", colors: ["#ffe8a3", "#ffd166", "#fff6d8"], shape: "feather", count: 26, size: [5, 9], speed: [30, 70], dir: Math.PI / 2, spread: 0.5, spin: 1.5, wobble: 50, life: [3, 5], shrink: false }),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(255,225,150,.9)"], shape: "text", texts: ["And so it was written.", "Let it be so.", "The tale ends here.", "I am the author.", "Fin."], count: 8, size: [16, 24], speed: [6, 14], life: [3, 5], shrink: false, blend: "source-over", font: "Georgia, serif", fontWeight: 400, textGlow: true }),
    ] }),
    rimuru: () => ({ name: "PREDATOR", layers: [
      glow("#4cc9f0", 0.5, 1.2),
      symbol(magicCircle("#7fe0ff"), { size: 1.9, spin: 0.3, alpha: 0.6, glowColor: "#4cc9f0" }),
      particles({ spawn: "ring", ringScale: 0.8, colors: ["#4cc9f0", "#a8e8ff"], count: 70, shape: "flame", size: [5, 10], speed: [40, 90], life: [1, 2] }),
      particles({ layer: "front", spawn: "card", dir: "out", colors: ["rgba(120,210,255,.7)"], blend: "source-over", count: 18, size: [5, 11], speed: [30, 80], life: [1, 2] }),
    ] }),
    jinwoo: () => ({ name: "ARISE", layers: [
      tint("#05000f", 0.55), glow("#9d4edd", 0.45, 1.2),
      particles({ spawn: "bottom", colors: ["#9d4edd", "#5a189a", "#c77dff"], shape: "flame", count: 140, size: [10, 22], speed: [80, 180], life: [1.5, 3] }),
      particles({ colors: ["#c77dff", "#e0aaff"], count: 60, shape: "flame", size: [6, 12], speed: [60, 130], life: [0.7, 1.4] }),
      bigText("ARISE", { color: "#c77dff", at: 0.35 }),
    ] }),
    anos: () => ({ name: "DEMON KING", layers: [
      tint("#0a0000", 0.5), glow("#e63946", 0.4, 1.3),
      symbol(magicCircle("#ff3344"), { size: 2.2, spin: -0.2, alpha: 0.6, glowColor: "#ff0022" }),
      lightning({ colors: ["#ff2a3a", "#000000"], every: [0.1, 0.3], width: 3 }),
      particles({ colors: ["#ff2a3a", "#300000"], count: 50, shape: "flame", size: [6, 12], speed: [50, 110], life: [0.8, 1.5] }),
    ] }),
    zeno: () => ({ name: "ERASE", layers: [
      flash("#ffffff", 0.9, 1), tint("#ffffff", 0.18),
      particles({ spawn: "screen", colors: ["#ffffff", "#e0f0ff"], count: 80, size: [1, 3], speed: [10, 40], life: [1, 2] }),
      bigText("ERASE", { color: "#ffffff", at: 0.5 }),
    ] }),
    ainz: () => ({ name: "SORCERER KING", layers: [
      tint("#0a0014", 0.5), glow("#7b2cbf", 0.45, 1.3),
      symbol(magicCircle("#b07cff"), { size: 2.2, spin: 0.25, alpha: 0.65, glowColor: "#7b2cbf" }),
      symbol(magicCircle("#d4b4ff"), { size: 1.3, spin: -0.5, alpha: 0.5 }),
      particles({ colors: ["#7b2cbf", "#c77dff"], count: 40, size: [1, 3], spawn: "card", speed: [20, 60] }),
    ] }),
    alucard: () => ({ name: "RESTRICTION RELEASED", layers: [
      tint("#0b0000", 0.5), tendrils("#8a0010"), glow("#c1121f", 0.35),
      particles({ layer: "front", spawn: "screen", colors: ["#050505", "#140000"], blend: "source-over", shape: "feather", count: 28, size: [6, 10], speed: [60, 140], dir: "out", spin: 3, life: [1.5, 3], shrink: false, wobble: 60 }),
    ] }),
    dio: () => ({ name: "ZA WARUDO", layers: [
      at(0.15, timeStop), glow("#ffe066", 0.4, 1.3),
      symbol(clockFace, { size: 1.9, spin: 0, alpha: 0.6, glowColor: "#ffb000" }),
      bigText("ZA WARUDO", { color: "#ffe066", at: 0.2, dur: 1.8 }),
    ] }),
    makima: () => ({ name: "CONTROL", layers: [
      tint("#150000", 0.45),
      symbol(rings, { size: 1.9, spin: 0, alpha: 0.35 }),
      symbol(rings, { layer: "front", size: 0.5, spin: 0, env: [0.15, 0.9, 1.5] }),
      glow("#ff2a2a", 0.3),
    ] }),
    gilgamesh: () => ({ name: "GATE OF BABYLON", layers: [tint("#0f0a00", 0.35), gates(), glow("#ffd166", 0.4, 1.2)] }),
    // ---- more fighters ----
    hashirama: () => ({ name: "WOOD STYLE", layers: [
      glow("#6a994e", 0.45, 1.2),
      particles({ spawn: "bottom", colors: ["#6a994e", "#a7c957", "#386641"], blend: "source-over", shape: "feather", count: 40, size: [6, 11], speed: [60, 140], spin: 3, wobble: 60, life: [3, 5], shrink: false }),
      particles({ colors: ["#a7c957"], count: 40, shape: "flame", size: [6, 12], speed: [50, 110] }),
    ] }),
    whitebeard: () => ({ name: "GURA GURA", layers: [
      flash("#e0f4ff", 0.4, 0.8), cracks({ layer: "front", color: "#bfe6ff", count: 11 }),
      at(0.05, () => shake(800, 20)), glow("#bfe6ff", 0.4, 1.3),
      bigText("GURA GURA", { color: "#e0f4ff", at: 0.2 }),
    ] }),
    kenpachi: () => ({ name: "UNRESTRAINED", layers: [
      glow("#ffe14d", 0.5, 1.3),
      particles({ colors: ["#ffe14d", "#fff3a0", "#d4b000"], count: 110, shape: "flame", size: [9, 20], speed: [70, 150], life: [0.7, 1.4] }),
      at(0.05, () => shake(500, 10)),
    ] }),
    escanor: () => ({ name: "THE ONE", layers: [
      glow("#ffb000", 0.75, 2.2), tint("#2a1200", 0.2),
      particles({ spawn: "screen", colors: ["#ffb000", "#ff7b00", "#ffe066"], shape: "flame", count: 90, size: [6, 14], speed: [20, 60], life: [1.5, 3] }),
      bigText("THE ONE", { color: "#ffd166" }),
    ] }),
    accelerator: () => ({ name: "VECTOR CONTROL", layers: [
      glow("#e0e1dd", 0.35),
      particles({ spawn: "card", dir: "out", colors: ["#ffffff", "#c8d6ff"], shape: "line", count: 90, size: [1.5, 3], speed: [300, 700], life: [0.3, 0.6] }),
      symbol(hud("#e0e1dd"), { size: 1.6, spin: 0, alpha: 0.5 }),
    ] }),
    hisoka: () => ({ name: "BUNGEE GUM", layers: [
      glow("#ff5fa2", 0.4),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(255,120,190,.9)", "rgba(255,255,255,.85)"], shape: "text", texts: ["♠", "♥", "♦", "♣", "★", "♡"], count: 24, size: [22, 44], speed: [10, 30], spin: 2, life: [2.5, 4], shrink: false, blend: "source-over", textGlow: true }),
    ] }),
    kokushibo: () => ({ name: "MOON BREATHING", layers: [
      tint("#0a0014", 0.45), glow("#b14dff", 0.4),
      slashes({ color: "#c77dff", every: [0.1, 0.25], width: 12 }),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(220,190,255,.9)"], shape: "text", texts: ["☾", "☽"], count: 20, size: [14, 30], speed: [20, 60], life: [1, 2], shrink: false, blend: "source-over", textGlow: true }),
    ] }),
    yuta: () => ({ name: "RIKA", layers: [tint("#000000", 0.4), tendrils("#d8d8e0"), glow("#ffffff", 0.3)] }),
    asta: () => ({ name: "ANTI-MAGIC", layers: [
      tint("#000000", 0.35),
      particles({ colors: ["#0a0a0a", "#1b1b1b", "#2b2b2b"], blend: "source-over", count: 90, shape: "flame", size: [10, 22], speed: [60, 140], life: [0.7, 1.4] }),
      lightning({ colors: ["#6a994e", "#ffffff"], every: [0.15, 0.4], width: 2.5 }),
    ] }),
    denji: () => ({ name: "CHAINSAW", layers: [
      slashes({ color: "#ff6b35", every: [0.08, 0.2], width: 9 }), at(0.05, () => shake(500, 9)),
      particles({ spawn: "card", dir: "out", colors: ["#ffb000", "#ff6b35"], shape: "line", count: 80, size: [1.5, 3], speed: [300, 700], life: [0.2, 0.5] }),
    ] }),
    // ---- slander specials ----
    kirito: () => ({ name: "STARBURST STREAM", layers: [
      slashes({ color: "#4361ee", every: [0.05, 0.12], width: 8 }),
      slashes({ color: "#ffffff", every: [0.08, 0.18], width: 6 }),
      bigText("STARBURST STREAM", { color: "#9fb4ff", size: 0.12 }),
    ] }),
    shinji: () => ({ name: "GET IN THE ROBOT", layers: [
      tint("#1a1f28", 0.45),
      particles({ layer: "front", spawn: "top", colors: ["rgba(170,190,220,.6)"], shape: "drop", count: 140, size: [1, 2], speed: [700, 1000], dir: Math.PI / 2 + 0.12, spread: 0.02, life: [1, 1.4], shrink: false, blend: "source-over" }),
      bigText("GET IN THE ROBOT", { color: "#b388ff", size: 0.12 }),
    ] }),
    // ---- girls ----
    zerotwo: () => ({ name: "DARLING", layers: [
      glow("#ff4d8d", 0.5, 1.2),
      particles({ layer: "front", spawn: "screen", colors: ["#ff4d8d", "#ff8fb8", "#ffffff"], shape: "text", texts: ["❤", "♥", "❥"], count: 26, size: [18, 40], speed: [20, 50], life: [2, 3.5], shrink: false, blend: "source-over", textGlow: true }),
      particles({ colors: ["#ff4d8d", "#ff8fb8"], count: 60, shape: "flame", size: [6, 12], speed: [50, 110] }),
    ] }),
    yor: () => ({ name: "THORN PRINCESS", layers: [
      tint("#14000a", 0.35), glow("#c9184a", 0.4),
      particles({ layer: "front", spawn: "top", colors: ["#c9184a", "#ff4d6d", "#800f2f"], shape: "text", texts: ["✿", "❀"], count: 26, size: [16, 30], speed: [40, 90], dir: Math.PI / 2, spread: 0.5, spin: 2, wobble: 50, life: [3, 5], shrink: false, blend: "source-over" }),
      slashes({ color: "#ffd166", every: [0.35, 0.8], width: 6 }),
    ] }),
    esdeath: () => ({ name: "MAHAPADMA", layers: [
      flash("#e0f4ff", 0.6, 0.85), tint("#021626", 0.45), glow("#8ecae6", 0.5, 1.3),
      particles({ layer: "front", spawn: "center", dir: "out", burst: 30, count: 10, colors: ["rgba(200,235,255,.7)", "rgba(160,215,255,.6)"], blend: "source-over", shape: "shard", size: [14, 30], speed: [100, 300], spin: 2, life: [1.5, 2.5], shrink: false }),
      particles({ layer: "front", spawn: "top", colors: ["#ffffff", "#cfefff"], count: 60, size: [1.5, 3.5], speed: [30, 80], dir: Math.PI / 2, spread: 0.4, wobble: 30, life: [3, 5], shrink: false }),
    ] }),
    frieren: () => ({ name: "ZOLTRAAK", layers: [
      tint("#02100f", 0.35), glow("#b8f2e6", 0.45, 1.2),
      symbol(magicCircle("#b8f2e6"), { size: 2, spin: 0.2, alpha: 0.6, glowColor: "#7ae0c8" }),
      particles({ spawn: "card", dir: "out", colors: ["#ffffff", "#b8f2e6"], shape: "line", count: 50, size: [1.5, 3], speed: [400, 800], life: [0.25, 0.5] }),
    ] }),
    saber: () => ({ name: "EXCALIBUR", layers: [
      glow("#ffd166", 0.7, 1.6), speedLines({ color: "#ffe9a8", count: 70, alpha: 0.35 }),
      particles({ spawn: "bottom", colors: ["#ffe066", "#fff3c4"], count: 80, shape: "flame", size: [6, 14], speed: [200, 400], life: [1, 2] }),
      bigText("EXCALIBUR", { color: "#ffe066", at: 0.3 }),
    ] }),
    hancock: () => ({ name: "MERO MERO MELLOW", layers: [
      glow("#ff5fa2", 0.55, 1.3), speedLines({ color: "#ff8fc0", count: 50, alpha: 0.25 }),
      particles({ layer: "front", spawn: "card", dir: "out", colors: ["#ff5fa2", "#ffc2dc"], shape: "text", texts: ["❤", "♥"], count: 40, size: [16, 34], speed: [120, 260], life: [1, 1.8], shrink: false, blend: "source-over", textGlow: true }),
    ] }),
    toga: () => ({ name: "TRANSFORM", layers: [tint("#1a0006", 0.4), tendrils("#d00045"), glow("#ff5c8a", 0.35)] }),
    nezuko: () => ({ name: "EXPLODING BLOOD", layers: [
      glow("#ff5c8a", 0.55, 1.2),
      particles({ colors: ["#ff5c8a", "#ff99b3", "#ff2a6d"], count: 110, shape: "flame", size: [8, 18], speed: [70, 150], life: [0.7, 1.4] }),
    ] }),
    shinobu: () => ({ name: "BUTTERFLY DANCE", layers: [
      glow("#b388ff", 0.45),
      particles({ layer: "front", spawn: "screen", colors: ["#c8a2ff", "#9d4edd", "#e0c3ff"], shape: "feather", count: 30, size: [6, 10], speed: [30, 70], spin: 6, wobble: 80, life: [2.5, 4], shrink: false }),
      slashes({ color: "#c8a2ff", every: [0.4, 0.9], width: 5 }),
    ] }),
    misaka: () => ({ name: "RAILGUN", layers: [
      flash("#ffe8a3", 0.35, 0.8), glow("#ffb000", 0.45),
      lightning({ colors: ["#ffb000", "#8fd3ff"], every: [0.05, 0.15], width: 3 }),
      speedLines({ mode: "horizontal", color: "#ffd166", count: 30, alpha: 0.35 }),
    ] }),
    erza: () => ({ name: "REQUIP", layers: [
      glow("#e63946", 0.4), slashes({ color: "#dfe7ff", every: [0.12, 0.3], width: 8 }),
      particles({ colors: ["#ffffff", "#ffd166"], count: 40, size: [1, 3], spawn: "card", speed: [30, 90] }),
    ] }),
    nami: () => ({ name: "THUNDERBOLT TEMPO", layers: [
      tint("#0a0f1a", 0.35), lightning({ sky: true, colors: ["#ffe066", "#8fd3ff"], every: [0.2, 0.6], width: 5 }),
      particles({ colors: ["rgba(200,210,230,.35)"], blend: "source-over", count: 30, size: [20, 40], speed: [10, 30], spawn: "top", dir: 0, spread: 0.2, life: [3, 5] }),
    ] }),
    mitsuri: () => ({ name: "LOVE BREATHING", layers: [
      glow("#ff8fc0", 0.5, 1.2), slashes({ color: "#ff8fc0", every: [0.15, 0.35], width: 7 }),
      particles({ layer: "front", spawn: "screen", colors: ["#ff8fc0", "#a7f3a7"], shape: "text", texts: ["❤", "♥"], count: 20, size: [16, 30], speed: [20, 50], life: [2, 3], shrink: false, blend: "source-over", textGlow: true }),
    ] }),
    albedo: () => ({ name: "OVERSEER", layers: [
      tint("#05000a", 0.45), glow("#7b2cbf", 0.35),
      particles({ layer: "front", spawn: "top", colors: ["#050505", "#140a1e"], blend: "source-over", shape: "feather", count: 30, size: [7, 12], speed: [40, 90], dir: Math.PI / 2, spread: 0.5, spin: 2, wobble: 60, life: [3, 5], shrink: false }),
    ] }),
    rukia: () => ({ name: "SODE NO SHIRAYUKI", layers: [
      tint("#06101c", 0.35), glow("#e0f4ff", 0.45, 1.2),
      particles({ layer: "front", spawn: "top", colors: ["#ffffff", "#dff3ff"], count: 90, size: [1.5, 4], speed: [30, 70], dir: Math.PI / 2, spread: 0.4, wobble: 30, life: [3, 6], shrink: false }),
      symbol(hexShield("#cfefff"), { size: 1.7, spin: 0.05, alpha: 0.5 }),
    ] }),
    yoruichi: () => ({ name: "SHUNKO", layers: [
      glow("#e0e7ff", 0.45), lightning({ colors: ["#ffffff", "#c8d6ff"], every: [0.04, 0.12], width: 2.5 }),
      speedLines({ mode: "horizontal", color: "#ffffff", count: 30, alpha: 0.3 }),
    ] }),
    power: () => ({ name: "BLOOD FIEND", layers: [
      tint("#1a0000", 0.35), tendrils("#c1121f"),
      bigText("POWER IS #1", { color: "#ff4d4d", size: 0.14 }),
    ] }),
    marin: () => ({ name: "COSPLAY QUEEN", layers: [
      glow("#ff8fab", 0.45),
      particles({ layer: "front", spawn: "screen", colors: ["#ffd1dc", "#ffffff", "#ffe066"], shape: "text", texts: ["✦", "✧", "★"], count: 30, size: [14, 28], speed: [10, 30], life: [1.5, 2.5], shrink: false, blend: "source-over", textGlow: true }),
    ] }),
    // ---- newest batch ----
    minato: () => ({ name: "FLYING RAIJIN", layers: [
      flash("#fff3a0", 0.25, 0.7), glow("#ffe066", 0.45),
      lightning({ colors: ["#ffe066", "#ffffff"], every: [0.06, 0.18], width: 2.5 }),
      speedLines({ mode: "horizontal", color: "#ffe066", count: 36, alpha: 0.3 }),
    ] }),
    obito: () => ({ name: "KAMUI", layers: [swirl("#3a0ca3"), tint("#000000", 0.3), symbol(mangekyo, { layer: "front", size: 0.6, spin: 4, env: [0.12, 0.6, 1.1] })] }),
    jotaro: () => ({ name: "STAR PLATINUM", layers: [
      glow("#9d4edd", 0.45), speedLines({ color: "#e0aaff", count: 70, alpha: 0.35 }),
      bigText("ORA ORA ORA", { color: "#e0aaff", size: 0.13 }), at(0.1, () => shake(700, 10)),
    ] }),
    kurapika: () => ({ name: "EMPEROR TIME", layers: [
      tint("#14000a", 0.4), glow("#ff1a3a", 0.45),
      particles({ layer: "front", spawn: "screen", colors: ["#c0c0c0", "#ffffff"], shape: "line", count: 30, size: [2, 3], speed: [200, 400], dir: "out", life: [0.4, 0.8] }),
    ] }),
    rengoku: () => ({ name: "SET YOUR HEART ABLAZE", layers: [
      glow("#ff7b00", 0.6, 1.4), tint("#2a0e00", 0.25),
      particles({ colors: ["#ff7b00", "#ffb000", "#ff3d00"], count: 150, shape: "flame", size: [10, 22], speed: [80, 170], life: [0.7, 1.4] }),
      slashes({ color: "#ffb000", every: [0.4, 0.9], width: 10 }),
    ] }),
    kaneki: () => ({ name: "KAGUNE", layers: [
      tint("#0a0000", 0.45), tendrils("#c1121f"),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(255,80,80,.85)"], shape: "text", texts: ["1000-7", "993", "986", "979", "972"], count: 14, size: [16, 26], speed: [10, 25], life: [2.5, 4], shrink: false, blend: "source-over" }),
    ] }),
    spike: () => ({ name: "SEE YOU SPACE COWBOY", layers: [
      tint("#060b18", 0.35), glow("#f4a261", 0.3),
      particles({ spawn: "screen", colors: ["#ffffff", "#ffe8c2"], count: 60, size: [1, 2.5], speed: [5, 20], life: [2, 4] }),
      particles({ layer: "front", spawn: "card", dir: "out", colors: ["#ffd166"], shape: "line", count: 10, size: [2, 3], speed: [700, 1000], life: [0.2, 0.4] }),
    ] }),
    guts: () => ({ name: "BERSERKER ARMOR", layers: [
      tint("#0a0000", 0.45), glow("#9d0208", 0.45),
      slashes({ color: "#9d0208", every: [0.2, 0.5], width: 16 }), at(0.05, () => shake(500, 12)),
    ] }),
    griffith: () => ({ name: "THE ECLIPSE", layers: [
      tint("#1a0000", 0.5), glow("#ff2a2a", 0.4, 1.4),
      particles({ layer: "front", spawn: "top", colors: ["#ffffff", "#f2f2f2"], shape: "feather", count: 26, size: [6, 11], speed: [30, 70], dir: Math.PI / 2, spread: 0.5, spin: 2, wobble: 60, life: [3, 5], shrink: false, blend: "source-over" }),
    ] }),
    edward: () => ({ name: "ALCHEMY", layers: [
      glow("#4da3ff", 0.45),
      symbol(magicCircle("#7cc4ff"), { size: 1.9, spin: 0.4, alpha: 0.65, glowColor: "#4da3ff" }),
      lightning({ colors: ["#7cc4ff", "#ffffff"], every: [0.08, 0.25], width: 2 }),
    ] }),
    kurumi: () => ({ name: "ZAFKIEL", layers: [
      tint("#120000", 0.45), glow("#d00000", 0.4),
      symbol(clockFace, { size: 1.9, spin: 0, alpha: 0.6, glowColor: "#ff2a2a" }),
    ] }),
    aqua: () => ({ name: "GOD BLOW", layers: [
      waves("#5bc0eb"), glow("#5bc0eb", 0.35),
      bigText("GOD BLOW", { color: "#bfe9ff", size: 0.14 }),
    ] }),
    violet: () => ({ name: "AUTO MEMORY DOLL", layers: [
      glow("#4ea8de", 0.35),
      particles({ layer: "front", spawn: "top", colors: ["#f2efe6", "#ffffff"], blend: "source-over", shape: "page", count: 12, size: [7, 12], speed: [40, 90], dir: Math.PI / 2, spread: 0.3, spin: 1.5, wobble: 60, life: [4, 6], shrink: false }),
    ] }),
    kaguya: () => ({ name: "HOW CUTE", layers: [
      glow("#e5383b", 0.4),
      particles({ layer: "front", spawn: "screen", colors: ["#ffb3c1", "#ffffff"], shape: "text", texts: ["How cute", "♥", "O-kawaii koto", "♥"], count: 16, size: [16, 26], speed: [10, 25], life: [2, 3.5], shrink: false, blend: "source-over", textGlow: true }),
    ] }),
    uta: () => ({ name: "MUSIC OF UTA", layers: [
      glow("#ff5c8a", 0.4, 1.2),
      particles({ layer: "front", spawn: "screen", colors: ["#ff8fab", "#ffffff", "#a0c4ff"], shape: "text", texts: ["♪", "♫", "♬"], count: 26, size: [18, 36], speed: [20, 50], life: [2, 3.5], shrink: false, blend: "source-over", textGlow: true }),
    ] }),
    revy: () => ({ name: "TWO HANDS", layers: [
      flash("#ffd166", 0.15, 0.6),
      particles({ spawn: "card", dir: "out", colors: ["#ffd166", "#ffffff"], shape: "line", count: 60, size: [1.5, 3], speed: [800, 1200], life: [0.15, 0.35] }),
      at(0.05, () => shake(400, 6)),
    ] }),
    motoko: () => ({ name: "THERMO-OPTIC CAMO", layers: [tint("#000a05", 0.3), symbol(hud("#52b788"), { size: 1.6, spin: 0, alpha: 0.7 }),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(82,183,136,.85)"], shape: "text", texts: ["0", "1", "01", "10"], count: 30, size: [12, 20], speed: [40, 90], dir: Math.PI / 2, spread: 0.05, life: [1, 2], shrink: false, blend: "source-over" })] }),
    lucy: () => ({ name: "NETRUNNER", layers: [glow("#00f5d4", 0.4), symbol(hud("#00f5d4"), { size: 1.5, spin: 0, alpha: 0.6 }),
      particles({ layer: "front", spawn: "screen", colors: ["#00f5d4", "#ff4dff"], shape: "square", count: 30, size: [3, 8], speed: [10, 40], life: [0.3, 0.9], shrink: false, blend: "source-over" })] }),
    akame: () => ({ name: "EBONY BLADE", layers: [tint("#0a0000", 0.35), glow("#c1121f", 0.35), slashes({ color: "#ff2a2a", every: [0.1, 0.3], width: 8 })] }),
    emilia: () => ({ name: "ICE MAGIC", layers: [glow("#cfe8ff", 0.45, 1.2),
      particles({ layer: "front", spawn: "top", colors: ["#ffffff", "#dff3ff"], count: 70, size: [1.5, 4], speed: [30, 70], dir: Math.PI / 2, spread: 0.4, wobble: 30, life: [3, 6], shrink: false })] }),
    mrsatan: () => ({ name: "THE PEOPLE'S CHAMP", layers: [
      particles({ layer: "front", spawn: "top", blend: "source-over", shape: "confetti", colors: ["#ff4d4d", "#ffd166", "#3ddc84", "#7aa7ff", "#ffffff"], count: 90, size: [8, 14], speed: [80, 160], dir: Math.PI / 2, gravity: 40, spin: 4, wobble: 50, life: [2.5, 4], shrink: false }),
      bigText("CHAMP!", { color: "#ffd166" }),
    ] }),
  };

  const GENERAL = {
    str: (c) => ({ name: "BRUTE FORCE", layers: [
      glow("#ff7b39", 0.35), cracks({ color: "#ffb347" }), at(0.05, () => shake(400, 9)),
      particles({ colors: ["#7a6a5a", "#a08c78", "#4d4238"], blend: "source-over", shape: "square", burst: 30, count: 6, size: [4, 10], speed: [120, 280], dir: -Math.PI / 2, spread: 0.8, gravity: 420, spin: 5, life: [1, 1.6], shrink: false }),
    ] }),
    spd: (c) => ({ name: "BLINDING SPEED", layers: [
      speedLines({ mode: "horizontal", color: "#ffffff", count: 45, alpha: 0.35 }),
      particles({ spawn: "screen", colors: ["#ffffff", "#bfe6ff"], shape: "line", count: 40, size: [1, 2.5], speed: [900, 1500], dir: Math.PI, spread: 0.02, life: [0.3, 0.6] }),
    ] }),
    dur: (c) => ({ name: "UNBREAKABLE", layers: [glow("#5ad1ff", 0.35), symbol(hexShield("#7fe0ff"), { size: 1.6, spin: 0.08, alpha: 0.8 })] }),
    iq: (c) => ({ name: "BIG BRAIN", layers: [
      glow("#5ad1ff", 0.25),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(200,240,255,.85)", "rgba(255,255,255,.75)"], shape: "text", texts: EQUATIONS, count: 22, size: [16, 30], speed: [10, 25], life: [2.5, 4.5], shrink: false, blend: "source-over", textGlow: true }),
    ] }),
    biq: (c) => ({ name: "TACTICIAN", layers: [tint("#000a10", 0.2), symbol(hud("#ff5a4f"), { size: 1.5, spin: 0, alpha: 0.75 })] }),
    abl: (c) => ({ name: "OVERPOWERED", layers: [
      glow(seriesColor(c), 0.4),
      symbol(magicCircle(seriesColor(c)), { size: 1.8, spin: 0.35, alpha: 0.6, glowColor: seriesColor(c) }),
      particles({ colors: [seriesColor(c), "#ffffff"], count: 40, size: [1, 3], spawn: "card", speed: [20, 60] }),
    ] }),
    aura: (c) => ({ name: "AURA FARMER", layers: [
      glow(seriesColor(c), 0.5, 1.2),
      particles({ colors: [seriesColor(c), "#ffffff"], count: 80, shape: "flame", size: [7, 14], speed: [50, 110], life: [0.8, 1.5] }),
    ] }),
    bum: (c) => ({ name: "CERTIFIED BUM", layers: [
      tint("#1a1f28", 0.45),
      particles({ layer: "front", spawn: "top", colors: ["rgba(170,190,220,.6)"], shape: "drop", count: 140, size: [1, 2], speed: [700, 1000], dir: Math.PI / 2 + 0.12, spread: 0.02, life: [1, 1.4], shrink: false, blend: "source-over" }),
      particles({ layer: "front", spawn: "screen", colors: ["rgba(255,255,255,.6)"], shape: "text", texts: ["L", "L", "💀", "fell off", "L"], count: 8, size: [24, 40], speed: [10, 30], dir: Math.PI / 2, life: [2, 3], shrink: false, blend: "source-over" }),
    ] }),
  };

  function seriesColor(c) { return (window.SERIES_COLORS[c.series] || ["#ffffff"])[0]; }

  const STAT_KEYS = ["str", "spd", "dur", "iq", "biq", "abl", "aura"];
  // Beauty Contest general effects, picked from a character's best look.
  const sparkles = (colors, n = 26) => particles({ layer: "front", spawn: "screen", colors, shape: "text", texts: ["✦", "✧", "✦"], count: n, size: [12, 26], speed: [8, 24], life: [1.2, 2.4], shrink: false, blend: "source-over", textGlow: true });
  const hearts = (colors, n = 22) => particles({ layer: "front", spawn: "screen", colors, shape: "text", texts: ["❤", "♥"], count: n, size: [16, 32], speed: [20, 50], life: [2, 3.5], shrink: false, blend: "source-over", textGlow: true });
  const BEAUTY = {
    face: (c) => ({ name: "STUNNING", layers: [glow("#ffd1dc", 0.45, 1.2), sparkles(["#ffffff", "#ffe8a3", "#ffd1dc"])] }),
    eyes: (c) => ({ name: "EYE CONTACT", layers: [glow("#a8d8ff", 0.4), flash("#ffffff", 0.3, 0.35), sparkles(["#a8d8ff", "#ffffff"], 18)] }),
    hair: (c) => ({ name: "HAIR FLIP", layers: [glow(seriesColor(c), 0.4), speedLines({ mode: "horizontal", color: "#ffffff", count: 26, alpha: 0.22 }), sparkles(["#ffffff"], 12)] }),
    phys: (c) => ({ name: "BUILT DIFFERENT", layers: [glow("#ffb347", 0.45, 1.2), particles({ colors: ["#ffb347", "#ffe066"], count: 70, shape: "flame", size: [6, 13], speed: [50, 110] })] }),
    drip: (c) => ({ name: "DRIP CHECK", layers: [glow("#7fe0ff", 0.4), particles({ layer: "front", spawn: "top", colors: ["rgba(127,224,255,.8)", "rgba(255,255,255,.8)"], shape: "drop", count: 40, size: [2, 3], speed: [200, 380], dir: Math.PI / 2, spread: 0.05, life: [1.5, 2.5], shrink: false, blend: "source-over" }), sparkles(["#ffffff", "#7fe0ff"], 14)] }),
    pers: (c) => ({ name: "HEART OF GOLD", layers: [glow("#ffd166", 0.4), hearts(["#ffd166", "#ff8fab"])] }),
    charm: (c) => ({ name: "RIZZ", layers: [glow("#ff5fa2", 0.5, 1.2), hearts(["#ff5fa2", "#ffc2dc", "#ffffff"], 28)] }),
    red: (c) => ({ name: "RED FLAG", layers: [
      tint("#1a0000", 0.4), glow("#ff2a2a", 0.35),
      particles({ layer: "front", spawn: "top", colors: ["#ff2a2a"], shape: "text", texts: ["🚩"], count: 22, size: [22, 38], speed: [50, 110], dir: Math.PI / 2, spread: 0.3, spin: 1.5, wobble: 40, life: [3, 5], shrink: false, blend: "source-over" }),
    ] }),
  };
  const LOOK_KEYS = ["face", "eyes", "hair", "phys", "drip", "pers", "charm"];
  let mode = "battle";

  function effectFor(c) {
    if (SPECIAL[c.id]) return SPECIAL[c.id]();
    const looks = window.LOOKS && window.LOOKS[c.id];
    if (mode === "beauty" && looks) {
      if (looks[7] >= 90) return BEAUTY.red(c);
      const main = looks.slice(0, 7);
      return BEAUTY[LOOK_KEYS[main.indexOf(Math.max(...main))]](c);
    }
    if (c.stats[7] >= 85) return GENERAL.bum(c);
    const main = c.stats.slice(0, 7);
    const top = main.indexOf(Math.max(...main));
    if (main[top] >= 80) return GENERAL[STAT_KEYS[top]](c);
    return { name: null, layers: [glow(seriesColor(c), 0.35)] };
  }

  // =====================================================================
  // Public API
  // =====================================================================
  return {
    // Play a character's effect around `el` (the card element). Returns the effect name.
    play(c, el) {
      anchorEl = el;
      const fx = effectFor(c);
      main = stamp(fx.layers);
      if (window.SFX) SFX.effect(fx.name, new Set(fx.layers.map((L) => L.kind).filter(Boolean)));
      ensureRunning();
      return fx.name;
    },
    // Just the name, without playing.
    nameFor(c, m) {
      if (!m) return effectFor(c).name;
      const keep = mode; mode = m;
      const n = effectFor(c).name;
      mode = keep;
      return n;
    },
    // "battle" or "beauty": which general effects characters without a signature one get.
    setMode(m) { mode = m; },
    stop() { main = []; },
    // A one-off clash impact at a screen point.
    impact(x, y, color = "#ffd166") {
      const at0 = { x: x - 1, y: y - 1, w: 2, h: 2, cx: x, cy: y };
      const pin = (L) => ({ layer: L.layer, draw: (g, t, dt) => L.draw(g, t, dt, at0) });
      const layers = stamp([
        pin(flash("#ffffff", 0.3, 0.8)),
        pin(particles({ layer: "front", spawn: "center", dir: "out", burst: 70, count: 0, colors: [color, "#ffffff", "#ffb000"], shape: "line", size: [2, 4], speed: [300, 900], life: [0.3, 0.7] })),
        pin(particles({ layer: "front", spawn: "center", dir: "out", burst: 20, count: 0, colors: [color], shape: "flame", size: [20, 40], speed: [60, 200], life: [0.3, 0.6] })),
      ]);
      const end = performance.now() + 1000;
      layers.forEach((L) => (L.end = end));
      transient.push(...layers);
      shake(380, 14);
      ensureRunning();
    },
    shake,
  };
})();
