(() => {
  const CATS = window.CATEGORIES;
  const ROSTER = window.CHARACTERS;
  const STAT_INDEX = { str: 0, spd: 1, dur: 2, iq: 3, biq: 4, abl: 5, aura: 6, bum: 7 };
  const TURN_SECONDS = 15;
  const TOTAL_PICKS = CATS.length * 2;
  const POOL_SIZE = 30;
  const BOT_NAMES = ["SUPERSTARRRR2", "NightRaidr", "xX_Sensei_Xx", "GrandLineGuy", "DomainExpander", "HokageMain", "UltraInstinkt", "PlusUltra99"];

  const $ = (id) => document.getElementById(id);
  const sleepRaw = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- scoring ----------
  const score = (c, key) => c.stats[STAT_INDEX[key]];
  const rosterMean = {};
  CATS.forEach((cat) => {
    rosterMean[cat.key] = ROSTER.reduce((s, c) => s + score(c, cat.key), 0) / ROSTER.length;
  });

  // ---------- images ----------
  const imgCache = {};
  function tryLoad(url) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => res(url);
      img.onerror = () => res(null);
      img.src = url;
    });
  }
  function findImage(c) {
    if (!imgCache[c.id]) {
      imgCache[c.id] = (async () => {
        const remote = (window.CHARACTER_IMAGES || {})[c.id];
        const candidates = [`images/${c.id}.webp`, `images/${c.id}.jpg`, `images/${c.id}.png`, c.image, remote].filter(Boolean);
        for (const url of candidates) {
          const found = await tryLoad(url);
          if (found) return { url: found, real: true };
        }
        return { url: placeholder(c), real: false };
      })();
    }
    return imgCache[c.id];
  }
  function placeholder(c) {
    const [a, b] = window.SERIES_COLORS[c.series] || ["#666", "#111"];
    const initials = c.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="g" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
        <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".9"/></linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#g)"/>
      <text x="300" y="420" text-anchor="middle" font-family="Oswald, Arial" font-weight="700" font-size="300" fill="#fff" opacity=".14">${initials}</text>
      <g fill="url(#s)">
        <ellipse cx="300" cy="330" rx="110" ry="130"/>
        <path d="M80 900 C 80 620, 160 480, 300 470 C 440 480, 520 620, 520 900 Z"/>
      </g>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  const seriesColor = (c) => (window.SERIES_COLORS[c.series] || ["#ffffff"])[0];

  let shownId = null;
  async function showCard(c) {
    shownId = c.id;
    const img = await findImage(c);
    if (shownId !== c.id) return; // a newer draw replaced this one while loading
    const bg = $("bg"), card = $("hero");
    bg.style.backgroundImage = `url("${img.url}")`;
    bg.classList.toggle("blurred", img.real);
    $("portrait").src = img.url;
    card.style.setProperty("--card-glow", seriesColor(c));
    card.classList.remove("hidden", "in");
    void card.offsetWidth;
    card.classList.add("in");
    const fxName = FX.play(c, $("heroAnchor"));
    const badge = $("revealFx");
    badge.textContent = fxName ? `✦ ${fxName} ✦` : "";
    badge.style.visibility = fxName ? "visible" : "hidden";
  }
  function preload(list) { list.forEach((c) => findImage(c)); }

  // ---------- state ----------
  let state = null;
  let timerHandle = null;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newGame() {
    const youFirst = Math.random() < 0.5;
    const mode = $("modePool").checked ? "pool" : "standard";
    const shuffled = shuffle(ROSTER);
    state = {
      mode,
      deck: shuffled.slice(0, TOTAL_PICKS),
      pool: mode === "pool" ? shuffled.slice(0, POOL_SIZE) : [],
      taken: {},
      pick: 0,
      turn: youFirst ? "you" : "opp",
      you: Object.fromEntries(CATS.map((c) => [c.key, null])),
      opp: Object.fromEntries(CATS.map((c) => [c.key, null])),
      current: null,
      oppName: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
      youName: ($("nameInput").value.trim() || "YOU").toUpperCase(),
      busy: false,
    };
    preload(mode === "pool" ? state.pool : state.deck);
    $("youName").textContent = state.youName;
    $("oppName").textContent = state.oppName;
    show("game");
    renderBoards();
    nextTurn();
  }

  function show(screen) {
    ["start", "game", "clash", "results"].forEach((s) => $(s).classList.toggle("hidden", s !== screen));
    if (screen !== "game") $("hero").classList.add("hidden");
    if (screen === "start" || screen === "results") FX.stop();
    window.scrollTo(0, 0);
  }

  // ---------- rendering ----------
  function renderBoards(flash) {
    const you = $("youSlots");
    you.innerHTML = "";
    CATS.forEach((cat, i) => {
      const c = state.you[cat.key];
      const el = document.createElement("div");
      el.className = "slot " + (c ? "filled" : "open") + (state.turn === "you" && state.current && !c && !state.busy ? " active" : "");
      if (flash === "you:" + cat.key) el.classList.add("flash");
      el.innerHTML = `<span class="key">${i + 1}</span><span>${cat.label}</span><span class="state">${c ? c.name.toUpperCase() : "OPEN"}</span>`;
      if (!c) el.addEventListener("click", () => playerPlace(cat.key));
      you.appendChild(el);
    });

    const opp = $("oppSlots");
    opp.innerHTML = "";
    CATS.forEach((cat) => {
      const c = state.opp[cat.key];
      const el = document.createElement("div");
      el.className = "slot " + (c ? "filled" : "open");
      if (flash === "opp:" + cat.key) el.classList.add("flash");
      el.innerHTML = `<span>${cat.short}</span><span class="state">${c ? c.name.toUpperCase() : "OPEN"}</span>`;
      opp.appendChild(el);
    });
  }

  function setStatus(yours, title) {
    $("statusTitle").textContent = title;
    document.querySelector(".status-card").classList.toggle("opp-turn", !yours);
    $("pickLabel").textContent = `PICK ${String(state.pick).padStart(2, "0")} / ${TOTAL_PICKS}`;
  }

  function setPoolPhase(on) {
    $("pool").classList.toggle("hidden", !on);
    $("reveal").classList.toggle("hidden", on);
    document.body.classList.toggle("pool-phase", on);
    if (on) { $("hero").classList.add("hidden"); FX.stop(); shownId = null; }
  }

  function renderReveal(c, who) {
    const yours = who === "you";
    const pool = state.mode === "pool";
    setPoolPhase(false);
    setStatus(yours, yours ? (pool ? "YOUR PICK" : "YOUR DRAW") : pool ? "OPPONENT'S PICK" : "OPPONENT'S DRAW");
    $("revealWho").textContent = yours ? (pool ? "YOU PICKED" : "YOUR DRAW") : `${state.oppName} ${pool ? "PICKED" : "DRAWS"}`;
    $("revealTitle").textContent = c.title;
    $("revealName").textContent = c.name;
    $("revealSeries").textContent = c.series;
    $("revealQ").textContent = yours ? `WHERE DOES ${c.name} FIGHT?` : `${state.oppName} IS CHOOSING...`;
    $("revealHelp").style.visibility = yours ? "visible" : "hidden";
    const r = $("reveal");
    r.classList.remove("pop");
    void r.offsetWidth;
    r.classList.add("pop");
    showCard(c);
  }

  // ---------- pool draft ----------
  function renderPool(chosenId) {
    const grid = $("poolGrid");
    grid.innerHTML = "";
    const canPick = state.turn === "you" && !state.current && !state.busy;
    state.pool.forEach((c) => {
      const owner = state.taken[c.id];
      const el = document.createElement("button");
      el.type = "button";
      el.className = "pc" + (owner ? " taken" : canPick ? " can" : "") + (c.id === chosenId ? " chosen" : "");
      el.disabled = !!owner || !canPick;
      el.style.setProperty("--card-glow", seriesColor(c));
      el.innerHTML = `<img alt="" /><span class="pn">${c.name}</span>` + (owner ? `<span class="tag ${owner}">${owner === "you" ? "YOU" : "OPP"}</span>` : "");
      findImage(c).then((img) => (el.querySelector("img").src = img.url));
      if (!owner) el.addEventListener("click", () => playerPoolPick(c));
      grid.appendChild(el);
    });
  }

  function showPoolTurn() {
    setPoolPhase(true);
    const yours = state.turn === "you";
    setStatus(yours, yours ? "PICK A CHARACTER" : "OPPONENT IS PICKING");
    renderPool();
  }

  function poolPick(c, side) {
    state.taken[c.id] = side;
    state.current = c;
    renderReveal(c, side);
    renderBoards();
  }

  function playerPoolPick(c) {
    if (!state || state.mode !== "pool" || state.turn !== "you" || state.current || state.busy || state.taken[c.id]) return;
    poolPick(c, "you");
  }

  // The bot looks for the character + slot pair that beats an average draw by the most.
  function botPoolPick() {
    if (!state || state.turn !== "opp") return;
    let best = null, bestVal = -Infinity;
    state.pool.forEach((c) => {
      if (state.taken[c.id]) return;
      CATS.forEach((cat) => {
        if (state.opp[cat.key]) return;
        const v = score(c, cat.key) - rosterMean[cat.key] + (Math.random() - 0.5) * 16;
        if (v > bestVal) { bestVal = v; best = c; }
      });
    });
    renderPool(best.id);
    setTimeout(() => {
      if (state.turn !== "opp") return;
      poolPick(best, "opp");
      setTimeout(botPlace, 1700);
    }, 800);
  }

  // ---------- turn flow ----------
  function nextTurn() {
    if (state.turn === "done") return;
    if (state.pick >= TOTAL_PICKS) return finishDraft();
    state.pick++;
    if (state.mode === "pool") {
      state.current = null;
      state.busy = false;
      showPoolTurn();
      renderBoards();
      startTimer();
      if (state.turn === "opp") {
        state.busy = true;
        setTimeout(botPoolPick, 1100 + Math.random() * 1200);
      }
      return;
    }
    state.current = state.deck.pop();
    state.busy = false;
    renderReveal(state.current, state.turn);
    renderBoards();
    startTimer();
    if (state.turn === "opp") {
      state.busy = true;
      setTimeout(botPlace, 1800 + Math.random() * 1600);
    }
  }

  function startTimer() {
    clearInterval(timerHandle);
    const end = Date.now() + TURN_SECONDS * 1000;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      $("timerBar").style.width = (left / (TURN_SECONDS * 1000)) * 100 + "%";
      $("timerBar").classList.toggle("low", left < 5000);
      $("timerNum").textContent = Math.ceil(left / 1000);
      if (left <= 0) {
        clearInterval(timerHandle);
        if (state.turn === "you") {
          // Out of time: random pick (pool mode) and a random open slot.
          if (state.mode === "pool" && !state.current) {
            const left = state.pool.filter((c) => !state.taken[c.id]);
            poolPick(left[Math.floor(Math.random() * left.length)], "you");
          }
          const open = CATS.filter((c) => !state.you[c.key]);
          playerPlace(open[Math.floor(Math.random() * open.length)].key);
        }
      }
    };
    tick();
    timerHandle = setInterval(tick, 100);
  }

  function place(side, key) {
    state[side][key] = state.current;
    clearInterval(timerHandle);
    state.busy = true;
    renderBoards(side + ":" + key);
    state.turn = side === "you" ? "opp" : "you";
    setTimeout(nextTurn, 700);
  }

  function playerPlace(key) {
    if (!state || state.turn !== "you" || state.busy || !state.current || state.you[key]) return;
    place("you", key);
  }

  function botPlace() {
    if (!state || state.turn !== "opp") return;
    const c = state.current;
    let best = null, bestVal = -Infinity;
    CATS.forEach((cat) => {
      if (state.opp[cat.key]) return;
      // Value a slot by how much better this character is there than an average draw.
      const v = score(c, cat.key) - rosterMean[cat.key] + (Math.random() - 0.5) * 12;
      if (v > bestVal) { bestVal = v; best = cat.key; }
    });
    place("opp", best);
  }

  // ---------- the clash ----------
  // Skippable sleep: pressing SKIP resolves every pending wait at once.
  let skipping = false;
  const pending = new Set();
  function wait(ms) {
    if (skipping) return Promise.resolve();
    return new Promise((res) => {
      const done = () => { clearTimeout(id); pending.delete(done); res(); };
      const id = setTimeout(done, ms);
      pending.add(done);
    });
  }
  function skipClash() {
    skipping = true;
    [...pending].forEach((f) => f());
  }

  function setFighter(el, c, key, img) {
    el.className = "fcard " + (el.id === "fcYou" ? "left" : "right") + " offstage";
    el.querySelector("img").src = img.url;
    el.querySelector(".fname").textContent = c.name;
    const fx = FX.nameFor(c);
    el.querySelector(".ffx").textContent = fx ? `✦ ${fx} ✦` : "";
    el.querySelector(".fnum").textContent = "0";
    el.style.setProperty("--card-glow", seriesColor(c));
  }

  function countUp(el, to, ms) {
    return new Promise((res) => {
      if (skipping) { el.textContent = to; return res(); }
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1 && !skipping) requestAnimationFrame(step);
        else { el.textContent = to; res(); }
      };
      requestAnimationFrame(step);
    });
  }

  async function runClash() {
    skipping = false;
    show("clash");
    const bg = $("bg");
    bg.classList.remove("blurred");
    bg.style.backgroundImage = "radial-gradient(ellipse at 50% 60%, #2a2f3a 0%, #0b0d12 70%)";
    $("csYouName").textContent = state.youName;
    $("csOppName").textContent = state.oppName;
    $("csYou").textContent = "0";
    $("csOpp").textContent = "0";
    $("clashBanner").classList.add("hidden");
    const fy = $("fcYou"), fo = $("fcOpp");
    const wins = { you: 0, opp: 0 };

    for (let i = 0; i < CATS.length && !skipping; i++) {
      const cat = CATS[i];
      const a = state.you[cat.key], b = state.opp[cat.key];
      const sa = score(a, cat.key), sb = score(b, cat.key);
      const [ia, ib] = await Promise.all([findImage(a), findImage(b)]);

      FX.stop();
      $("clashRound").textContent = `ROUND ${i + 1} / ${CATS.length}`;
      $("clashCat").textContent = cat.label;
      $("clashVs").className = "vs";
      setFighter(fy, a, cat.key, ia);
      setFighter(fo, b, cat.key, ib);
      void fy.offsetWidth;

      // Slide in.
      fy.classList.remove("offstage"); fo.classList.remove("offstage");
      await wait(550);
      // Reveal the stats.
      await Promise.all([countUp(fy.querySelector(".fnum"), sa, 800), countUp(fo.querySelector(".fnum"), sb, 800)]);
      await wait(250);
      // Charge and collide.
      fy.classList.add("charge"); fo.classList.add("charge");
      await wait(220);
      const vs = $("clashVs").getBoundingClientRect();
      if (!skipping) FX.impact(vs.left + vs.width / 2, vs.top + vs.height / 2, sa === sb ? "#ffffff" : sa > sb ? "#7aa7ff" : "#ff4d4d");
      fy.classList.remove("charge"); fo.classList.remove("charge");
      $("clashVs").className = "vs hit";

      if (sa === sb) {
        fy.classList.add("tie"); fo.classList.add("tie");
      } else {
        const [w, l, wc] = sa > sb ? [fy, fo, a] : [fo, fy, b];
        w.classList.add("win"); l.classList.add("lose");
        wins[sa > sb ? "you" : "opp"]++;
        if (!skipping) FX.play(wc, w.querySelector(".fimg"));
      }
      $("csYou").textContent = wins.you;
      $("csOpp").textContent = wins.opp;
      await wait(1900);
    }

    FX.stop();
    if (!skipping) {
      const t = totals();
      const r = outcome(t);
      const banner = $("clashBanner");
      banner.textContent = r === "win" ? "VICTORY" : r === "lose" ? "DEFEAT" : "DRAW";
      banner.className = "clash-banner " + r;
      await wait(1600);
    }
    finish(false);
  }

  function totals() {
    const t = { youWins: 0, oppWins: 0, youPts: 0, oppPts: 0 };
    CATS.forEach((cat) => {
      const a = state.you[cat.key], b = state.opp[cat.key];
      const sa = a ? score(a, cat.key) : 0, sb = b ? score(b, cat.key) : 0;
      t.youPts += sa; t.oppPts += sb;
      if (sa > sb) t.youWins++; else if (sb > sa) t.oppWins++;
    });
    return t;
  }
  // Most clashes won; total stat points break a tie.
  function outcome(t) {
    if (t.youWins !== t.oppWins) return t.youWins > t.oppWins ? "win" : "lose";
    if (t.youPts !== t.oppPts) return t.youPts > t.oppPts ? "win" : "lose";
    return "draw";
  }

  function finishDraft() {
    clearInterval(timerHandle);
    setPoolPhase(false);
    state.turn = "clash";
    runClash();
  }

  function finish(forfeited) {
    clearInterval(timerHandle);
    const rows = CATS.map((cat) => {
      const a = state.you[cat.key], b = state.opp[cat.key];
      const sa = a ? score(a, cat.key) : 0;
      const sb = b ? score(b, cat.key) : 0;
      return `<tr>
        <td class="${sa > sb ? "won" : ""}">${a ? a.name : "-"}<span class="pts">${sa}</span></td>
        <td>${cat.label}</td>
        <td class="${sb > sa ? "won" : ""}"><span class="pts">${sb}</span>${b ? b.name : "-"}</td>
      </tr>`;
    }).join("");
    const t = totals();
    $("resultRows").innerHTML = rows;
    $("youTotal").textContent = t.youPts;
    $("oppTotal").textContent = t.oppPts;
    $("rYou").textContent = state.youName;
    $("rOpp").textContent = state.oppName;
    const title = $("resultTitle");
    const r = forfeited ? "forfeit" : outcome(t);
    title.textContent = { win: "YOU WIN", lose: "YOU LOSE", draw: "DRAW", forfeit: "YOU FORFEITED" }[r];
    title.className = r === "win" ? "win" : r === "draw" ? "" : "lose";
    $("resultSub").textContent = forfeited
      ? ""
      : `Clashes won ${t.youWins} - ${t.oppWins}` + (t.youWins === t.oppWins ? ` · tiebreak on total power ${t.youPts} - ${t.oppPts}` : "");
    state.turn = "done";
    setPoolPhase(false);
    show("results");
  }

  // ---------- fullscreen ----------
  const fsBtn = $("fsBtn");
  const root = document.documentElement;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(root.requestFullscreen || root.webkitRequestFullscreen);
  if (!canFullscreen) fsBtn.hidden = true; // e.g. iPhone Safari, which has no fullscreen for pages
  fsBtn.addEventListener("click", async () => {
    try {
      if (fsElement()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
        // On phones, also try to lock sideways; ignored where it isn't supported.
        if (screen.orientation && screen.orientation.lock && matchMedia("(pointer: coarse)").matches) screen.orientation.lock("landscape").catch(() => {});
      }
    } catch (e) {
      fsBtn.hidden = true; // fullscreen was refused here, so stop offering it
    }
  });
  const syncFs = () => {
    const on = !!fsElement();
    fsBtn.classList.toggle("on", on);
    fsBtn.setAttribute("aria-label", on ? "Exit fullscreen" : "Enter fullscreen");
    fsBtn.title = on ? "Exit fullscreen" : "Fullscreen";
  };
  document.addEventListener("fullscreenchange", syncFs);
  document.addEventListener("webkitfullscreenchange", syncFs);

  // ---------- input ----------
  document.addEventListener("keydown", (e) => {
    if ($("game").classList.contains("hidden")) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= CATS.length) playerPlace(CATS[n - 1].key);
  });
  $("startBtn").addEventListener("click", newGame);
  $("againBtn").addEventListener("click", () => show("start"));
  $("skipBtn").addEventListener("click", skipClash);
  // Two-step forfeit (pop-up confirm dialogs are blocked when the game is embedded).
  let forfeitTimer = null;
  $("forfeitBtn").addEventListener("click", () => {
    const btn = $("forfeitBtn");
    if (btn.classList.contains("armed")) {
      clearTimeout(forfeitTimer);
      btn.classList.remove("armed");
      btn.textContent = "FORFEIT";
      state.turn = "done";
      finish(true);
      return;
    }
    btn.classList.add("armed");
    btn.textContent = "TAP AGAIN TO FORFEIT";
    forfeitTimer = setTimeout(() => { btn.classList.remove("armed"); btn.textContent = "FORFEIT"; }, 3000);
  });

  // Start-screen backdrop
  findImage(ROSTER[Math.floor(Math.random() * ROSTER.length)]).then((img) => {
    $("bg").style.backgroundImage = `url("${img.url}")`;
    $("bg").classList.toggle("blurred", img.real);
  });

  // Debug helper: open index.html#fx=madara to preview a character's draw effect.
  const m = location.hash.match(/fx=([\w]+)/);
  if (m) {
    const c = ROSTER.find((x) => x.id === m[1]);
    if (c) {
      $("start").classList.add("hidden");
      state = { pick: 1, oppName: "BOT", you: {}, opp: {} };
      $("game").classList.remove("hidden");
      $("revealWho").textContent = "PREVIEW";
      $("revealTitle").textContent = c.title;
      $("revealName").textContent = c.name;
      $("revealSeries").textContent = c.series;
      showCard(c);
    }
  }
})();
