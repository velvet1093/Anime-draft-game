(() => {
  let CATS = window.CATEGORIES; // swapped for BEAUTY_CATEGORIES in a beauty contest
  const ROSTER = window.CHARACTERS;
  const STAT_INDEX = { str: 0, spd: 1, dur: 2, iq: 3, biq: 4, abl: 5, aura: 6, bum: 7 };
  const LOOK_INDEX = { face: 0, eyes: 1, hair: 2, phys: 3, drip: 4, pers: 5, charm: 6, red: 7 };
  let contest = "battle"; // "battle" or "beauty"
  const TURN_SECONDS = 15;
  const TOTAL_PICKS = CATS.length * 2;
  const POOL_SIZE = 30;
  const BOT_NAMES = ["SUPERSTARRRR2", "NightRaidr", "xX_Sensei_Xx", "GrandLineGuy", "DomainExpander", "HokageMain", "UltraInstinkt", "PlusUltra99"];

  const $ = (id) => document.getElementById(id);
  const sleepRaw = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- scoring ----------
  const score = (c, key) => (contest === "beauty" ? window.LOOKS[c.id][LOOK_INDEX[key]] : c.stats[STAT_INDEX[key]]);
  // Average rating per category across the roster in play; the bot uses it to judge a pick.
  let rosterMean = {};
  function computeMeans(list) {
    rosterMean = {};
    CATS.forEach((cat) => {
      rosterMean[cat.key] = list.reduce((s, c) => s + score(c, cat.key), 0) / list.length;
    });
  }
  const genderOf = (c) => (window.GENDER.f.includes(c.id) ? "f" : window.GENDER.x.includes(c.id) ? "x" : "m");

  // Which characters are in play for the chosen mode.
  function rosterFor(mode, contestants) {
    if (mode === "girls") return ROSTER.filter((c) => genderOf(c) === "f");
    if (mode === "beauty" && contestants === "girls") return ROSTER.filter((c) => genderOf(c) === "f");
    if (mode === "beauty" && contestants === "boys") return ROSTER.filter((c) => genderOf(c) === "m");
    return ROSTER;
  }
  const checked = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;

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
    const gameMode = checked("contest") || "battle";
    contest = gameMode === "beauty" ? "beauty" : "battle";
    CATS = contest === "beauty" ? window.BEAUTY_CATEGORIES : window.CATEGORIES;
    FX.setMode(contest);
    document.body.classList.toggle("beauty", contest === "beauty");
    const roster = rosterFor(gameMode, checked("contestants"));
    computeMeans(roster);
    const shuffled = shuffle(roster);
    SFX.unlock();
    SFX.music(contest === "beauty" ? "beauty" : "draft");
    state = {
      mode,
      // Standard draws pop from the end of the deck (the rest is spare for a reroll); Pool Draft lays out the first 30.
      deck: mode === "pool" ? [] : shuffled,
      pool: mode === "pool" ? shuffled.slice(0, POOL_SIZE) : [],
      rerolls: mode === "pool" ? 0 : 1, // Pool Draft has no reroll
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
    preload(mode === "pool" ? state.pool : state.deck.slice(-TOTAL_PICKS - 2));
    $("rerollBtn").hidden = mode === "pool";
    $("youName").textContent = state.youName;
    $("oppName").textContent = state.oppName;
    show("game");
    renderBoards();
    nextTurn();
  }

  function show(screen) {
    ["start", "game", "clash", "results", "codex"].forEach((s) => $(s).classList.toggle("hidden", s !== screen));
    if (screen !== "game") $("hero").classList.add("hidden");
    if (screen === "start" || screen === "results" || screen === "codex") { FX.stop(); SFX.music("menu"); }
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
    updateReroll();
  }

  // ---------- reroll (one per match, Standard only) ----------
  // Swaps your current draw for a new one. Pool Draft doesn't get one: everyone can already see the whole table.
  function canReroll() {
    if (!state || state.mode === "pool" || state.turn !== "you" || state.busy || !state.rerolls) return false;
    return !!state.current && state.deck.length > 0;
  }
  function updateReroll() {
    const b = $("rerollBtn");
    b.disabled = !canReroll();
    b.classList.toggle("used", !!state && state.rerolls === 0);
    $("rerollLeft").textContent = state ? state.rerolls : 1;
  }
  function reroll() {
    if (!canReroll()) return;
    state.rerolls--;
    SFX.reroll();
    state.current = state.deck.pop();
    renderReveal(state.current, "you");
    renderBoards();
    startTimer();
    updateReroll();
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
    $("revealQ").textContent = yours ? `WHERE DOES ${c.name} ${contest === "beauty" ? "SHINE" : "FIGHT"}?` : `${state.oppName} IS CHOOSING...`;
    $("revealHelpText").textContent = contest === "beauty" ? "Put them where they look BEST - the highest total wins" : "Put them where they're STRONGEST - the highest total wins";
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
    updateReroll();
  }

  function showPoolTurn() {
    setPoolPhase(true);
    const yours = state.turn === "you";
    setStatus(yours, yours ? "PICK A CHARACTER" : "OPPONENT IS PICKING");
    renderPool();
  }

  function poolPick(c, side) {
    SFX.select();
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
    SFX.draw();
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
    let lastSec = TURN_SECONDS;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSec) { lastSec = sec; if (sec <= 5 && sec > 0 && state.turn === "you") SFX.tick(); }
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
    SFX.place();
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
      const from = parseInt(el.textContent, 10) || 0; // counts on from the number already shown
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
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
    $("clashFinal").classList.add("hidden");
    $("clashEyebrow").textContent = contest === "beauty" ? "THE JUDGING" : "THE CLASH";
    $("finLabel").textContent = contest === "beauty" ? "TOTAL SCORE" : "TOTAL POWER";
    $("clash").classList.remove("final");
    SFX.music("clash");
    const fy = $("fcYou"), fo = $("fcOpp");

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
      if (!skipping) SFX.whoosh();
      await wait(550);
      // Reveal the stats.
      await Promise.all([countUp(fy.querySelector(".fnum"), sa, 800), countUp(fo.querySelector(".fnum"), sb, 800)]);
      markSeen(a); markSeen(b);
      await wait(250);
      // Charge and collide.
      fy.classList.add("charge"); fo.classList.add("charge");
      await wait(220);
      const vs = $("clashVs").getBoundingClientRect();
      if (!skipping) { FX.impact(vs.left + vs.width / 2, vs.top + vs.height / 2, sa === sb ? "#ffffff" : sa > sb ? "#7aa7ff" : "#ff4d4d"); SFX.impact(); }
      fy.classList.remove("charge"); fo.classList.remove("charge");
      $("clashVs").className = "vs hit";

      if (sa === sb) {
        fy.classList.add("tie"); fo.classList.add("tie");
      } else {
        const [w, l, wc] = sa > sb ? [fy, fo, a] : [fo, fy, b];
        w.classList.add("win"); l.classList.add("lose");
        if (!skipping) FX.play(wc, w.querySelector(".fimg"));
      }
      await wait(1900);
    }

    FX.stop();
    if (!skipping) {
      // The totals stay secret until every clash is done, then both sums count up together.
      const t = totals();
      const r = outcome(t);
      const fin = $("clashFinal");
      $("clash").classList.add("final");
      $("finYouName").textContent = state.youName;
      $("finOppName").textContent = state.oppName;
      $("finYou").textContent = "0"; $("finOpp").textContent = "0";
      $("finYou").className = ""; $("finOpp").className = "";
      $("finResult").textContent = ""; $("finResult").className = "fin-result";
      fin.classList.remove("hidden");
      SFX.stopMusic();
      await wait(500);
      if (!skipping) SFX.drumroll(2.2);
      await Promise.all([countUp($("finYou"), t.youPts, 2200), countUp($("finOpp"), t.oppPts, 2200)]);
      if (!skipping) (r === "win" ? SFX.win : SFX.lose)();
      if (r !== "draw") $(r === "win" ? "finYou" : "finOpp").className = "lead";
      $("finResult").textContent = r === "win" ? "VICTORY" : r === "lose" ? "DEFEAT" : "DRAW";
      $("finResult").className = "fin-result " + r;
      FX.shake(450, 12);
      await wait(2200);
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
  // Highest total power wins; clashes won break an exact tie.
  function outcome(t) {
    if (t.youPts !== t.oppPts) return t.youPts > t.oppPts ? "win" : "lose";
    if (t.youWins !== t.oppWins) return t.youWins > t.oppWins ? "win" : "lose";
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
    // The results table shows every placed character's rating, so they count as seen.
    CATS.forEach((cat) => { markSeen(state.you[cat.key]); markSeen(state.opp[cat.key]); });
    if (forfeited) SFX.lose();
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
      : `${contest === "beauty" ? "Total score" : "Total power"} ${t.youPts} - ${t.oppPts} · ${contest === "beauty" ? "rounds" : "clashes"} won ${t.youWins} - ${t.oppWins}` + (t.youPts === t.oppPts ? " (tiebreak)" : "");
    state.turn = "done";
    setPoolPhase(false);
    show("results");
  }

  // ---------- stat unlocks (remembered in this browser) ----------
  const seen = (() => {
    try { const v = JSON.parse(localStorage.getItem("ad-seen") || "{}"); return { b: new Set(v.b || []), l: new Set(v.l || []) }; }
    catch (e) { return { b: new Set(), l: new Set() }; }
  })();
  const UNLOCK_KEY = "ad-unlockall";
  let unlockAll = (() => { try { return localStorage.getItem(UNLOCK_KEY) === "1"; } catch (e) { return false; } })();
  const hasBattle = (c) => unlockAll || seen.b.has(c.id);
  const hasLooks = (c) => unlockAll || seen.l.has(c.id);
  function markSeen(c) {
    if (!c) return;
    const set = contest === "beauty" ? seen.l : seen.b;
    if (set.has(c.id)) return;
    set.add(c.id);
    try { localStorage.setItem("ad-seen", JSON.stringify({ b: [...seen.b], l: [...seen.l] })); } catch (e) { /* storage blocked */ }
  }

  // ---------- character index ----------
  const BATTLE_LABELS = window.CATEGORIES.map((c) => c.label);
  const BEAUTY_LABELS = window.BEAUTY_CATEGORIES.map((c) => c.label);
  const seriesList = [...new Set(ROSTER.map((c) => c.series))].sort();
  $("codexSeries").innerHTML = `<option value="">ALL SERIES</option>` + seriesList.map((x) => `<option>${x}</option>`).join("");

  function renderCodex() {
    const q = $("codexSearch").value.trim().toLowerCase();
    const who = checked("codexWho");
    const series = $("codexSeries").value;
    const list = ROSTER.filter((c) =>
      (!q || c.name.toLowerCase().includes(q) || c.series.toLowerCase().includes(q)) &&
      (who === "all" || genderOf(c) === who) &&
      (!series || c.series === series));
    const grid = $("codexGrid");
    grid.innerHTML = "";
    list.forEach((c) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "cx";
      el.style.setProperty("--card-glow", seriesColor(c));
      el.innerHTML = `<img alt="" loading="lazy" /><span class="cx-badges">${unlockAll ? "" : (seen.b.has(c.id) ? '<i title="Battle stats unlocked">⚔</i>' : "") + (seen.l.has(c.id) ? '<i title="Looks unlocked">✦</i>' : "")}</span><span class="cx-name">${c.name}</span><span class="cx-series">${c.series}</span>`;
      findImage(c).then((img) => (el.querySelector("img").src = img.url));
      el.addEventListener("click", () => openDetail(c));
      grid.appendChild(el);
    });
    if (!list.length) grid.innerHTML = `<p class="codex-empty">No characters match that search.</p>`;
    $("codexCount").textContent = unlockAll
      ? `${ROSTER.length} characters · all stats unlocked`
      : `${ROSTER.length} characters · battle stats unlocked ${seen.b.size} · looks unlocked ${seen.l.size}`;
    $("unlockAllBtn").setAttribute("aria-pressed", String(unlockAll));
    $("unlockAllBtn").textContent = unlockAll ? "LOCK UNSEEN STATS" : "UNLOCK ALL";
    $("codexNote").hidden = unlockAll;
  }

  function statRows(labels, values, unlocked, how) {
    if (!unlocked) {
      return `<p class="cd-locked">🔒 Locked. ${how}</p>` +
        labels.map((l) => `<div class="cd-row locked"><span>${l}</span><b><i style="width:0"></i></b><em>???</em></div>`).join("");
    }
    return labels.map((l, i) => `<div class="cd-row"><span>${l}</span><b><i style="width:${values[i]}%"></i></b><em>${values[i]}</em></div>`).join("");
  }

  function openDetail(c) {
    SFX.click();
    findImage(c).then((img) => ($("cdImg").src = img.url));
    $("cdSeries").textContent = c.series;
    $("cdName").textContent = c.name;
    $("cdTitle").textContent = c.title;
    const fxB = FX.nameFor(c, "battle"), fxL = FX.nameFor(c, "beauty");
    $("cdFx").innerHTML = [fxB && `<span>⚔ ${fxB}</span>`, fxL && fxL !== fxB && `<span>✦ ${fxL}</span>`].filter(Boolean).join("");
    // Values are looked up per category: stats are stored in a different order than the board shows them.
    const battle = window.CATEGORIES.map((cat) => c.stats[STAT_INDEX[cat.key]]);
    const looks = window.BEAUTY_CATEGORIES.map((cat) => window.LOOKS[c.id][LOOK_INDEX[cat.key]]);
    $("cdBattle").innerHTML = statRows(BATTLE_LABELS, battle, hasBattle(c), "See them in a battle clash to unlock.");
    $("cdBeauty").innerHTML = statRows(BEAUTY_LABELS, looks, hasLooks(c), "See them in a beauty contest to unlock.");
    $("codexDetail").classList.remove("hidden");
    $("cdClose").focus();
  }
  const closeDetail = () => $("codexDetail").classList.add("hidden");

  $("codexBtn").addEventListener("click", () => { SFX.unlock(); SFX.click(); renderCodex(); show("codex"); });
  $("codexBack").addEventListener("click", () => { closeDetail(); show("start"); });
  $("cdClose").addEventListener("click", closeDetail);
  $("codexDetail").addEventListener("click", (e) => { if (e.target.id === "codexDetail") closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
  // Shows every stat in the index. Turning it off goes back to what you've actually seen (progress is kept).
  $("unlockAllBtn").addEventListener("click", () => {
    unlockAll = !unlockAll;
    try { localStorage.setItem(UNLOCK_KEY, unlockAll ? "1" : "0"); } catch (e) { /* storage blocked */ }
    SFX.click();
    renderCodex();
  });
  $("codexSearch").addEventListener("input", renderCodex);
  $("codexSeries").addEventListener("change", renderCodex);
  document.querySelectorAll('input[name="codexWho"]').forEach((r) => r.addEventListener("change", renderCodex));

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
    if (e.key === "r" || e.key === "R") return reroll();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= CATS.length) playerPlace(CATS[n - 1].key);
  });
  $("startBtn").addEventListener("click", newGame);
  $("rerollBtn").addEventListener("click", reroll);
  // Music starts with the first click anywhere (browsers block audio before that).
  document.addEventListener("pointerdown", function first() {
    document.removeEventListener("pointerdown", first);
    SFX.unlock();
    if (!$("start").classList.contains("hidden") || !$("codex").classList.contains("hidden")) SFX.music("menu");
  });

  // ---------- music / sound toggles ----------
  const syncAudioBtns = () => {
    $("musicBtn").setAttribute("aria-pressed", String(SFX.musicOn));
    $("musicBtn").classList.toggle("off", !SFX.musicOn);
    $("sfxBtn").setAttribute("aria-pressed", String(SFX.sfxOn));
    $("sfxBtn").classList.toggle("off", !SFX.sfxOn);
  };
  $("musicBtn").addEventListener("click", () => { SFX.unlock(); SFX.setMusic(!SFX.musicOn); syncAudioBtns(); });
  $("sfxBtn").addEventListener("click", () => { SFX.unlock(); SFX.setSfx(!SFX.sfxOn); syncAudioBtns(); SFX.click(); });
  syncAudioBtns();
  // The Girls / Boys / All choice only applies to the beauty contest.
  const syncContestants = () => ($("contestants").hidden = checked("contest") !== "beauty");
  document.querySelectorAll('input[name="contest"]').forEach((r) => r.addEventListener("change", syncContestants));
  syncContestants();
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
