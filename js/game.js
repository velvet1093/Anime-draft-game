(() => {
  const CATS = window.CATEGORIES;
  const ROSTER = window.CHARACTERS;
  const STAT_INDEX = { str: 0, spd: 1, dur: 2, iq: 3, biq: 4, abl: 5, aura: 6 };
  const TURN_SECONDS = 15;
  const TOTAL_PICKS = CATS.length * 2;
  const BOT_NAMES = ["SUPERSTARRRR2", "NightRaidr", "xX_Sensei_Xx", "GrandLineGuy", "DomainExpander", "HokageMain", "UltraInstinkt", "PlusUltra99"];

  const $ = (id) => document.getElementById(id);

  // ---------- scoring ----------
  const avg = (c) => c.stats.reduce((a, b) => a + b, 0) / c.stats.length;
  function score(c, key) {
    if (key === "bum") return Math.max(1, Math.round(100 - avg(c)));
    return c.stats[STAT_INDEX[key]];
  }
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
  async function findImage(c) {
    if (c.id in imgCache) return imgCache[c.id];
    const remote = (window.CHARACTER_IMAGES || {})[c.id];
    const candidates = [`images/${c.id}.jpg`, `images/${c.id}.png`, `images/${c.id}.webp`, c.image, remote].filter(Boolean);
    let found = null;
    for (const url of candidates) {
      found = await tryLoad(url);
      if (found) break;
    }
    imgCache[c.id] = found ? { url: found, real: true } : { url: placeholder(c), real: false };
    return imgCache[c.id];
  }
  function placeholder(c) {
    const [a, b] = window.SERIES_COLORS[c.series] || ["#666", "#111"];
    const initials = c.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
        <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".9"/></linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#g)"/>
      <g opacity=".18" stroke="#fff" stroke-width="3">${Array.from({ length: 24 }, (_, i) => {
        const ang = (i / 24) * Math.PI * 2;
        return `<line x1="800" y1="300" x2="${800 + Math.cos(ang) * 1400}" y2="${300 + Math.sin(ang) * 1400}"/>`;
      }).join("")}</g>
      <text x="800" y="420" text-anchor="middle" font-family="Oswald, Arial" font-weight="700" font-size="360" fill="#fff" opacity=".12">${initials}</text>
      <g fill="url(#s)">
        <ellipse cx="800" cy="250" rx="120" ry="140"/>
        <path d="M560 900 C 560 560, 640 430, 800 420 C 960 430, 1040 560, 1040 900 Z"/>
        <path d="M600 520 C 480 560, 420 700, 400 900 L 560 900 Z"/>
        <path d="M1000 520 C 1120 560, 1180 700, 1200 900 L 1040 900 Z"/>
      </g>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  let shownId = null;
  async function showBackground(c) {
    shownId = c.id;
    const img = await findImage(c);
    if (shownId !== c.id) return; // a newer draw replaced this one while loading
    const bg = $("bg"), portrait = $("portrait");
    bg.style.backgroundImage = `url("${img.url}")`;
    bg.classList.toggle("blurred", img.real);
    if (img.real) {
      portrait.src = img.url;
      portrait.classList.remove("hidden");
      portrait.classList.remove("in");
      void portrait.offsetWidth;
      portrait.classList.add("in");
    } else {
      portrait.classList.add("hidden");
    }
  }
  // Warm the cache so draws appear instantly.
  function preload(list) { list.forEach((c) => findImage(c)); }

  // ---------- state ----------
  let state = null;
  let timerHandle = null;
  let showHints = false;

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
    state = {
      deck: shuffle(ROSTER).slice(0, TOTAL_PICKS),
      pick: 0,
      turn: youFirst ? "you" : "opp",
      you: Object.fromEntries(CATS.map((c) => [c.key, null])),
      opp: Object.fromEntries(CATS.map((c) => [c.key, null])),
      current: null,
      oppName: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
      youName: ($("nameInput").value.trim() || "YOU").toUpperCase(),
      busy: false,
    };
    showHints = $("hintToggle").checked;
    preload(state.deck);
    $("youName").textContent = state.youName;
    $("oppName").textContent = state.oppName;
    show("game");
    renderBoards();
    nextTurn();
  }

  function show(screen) {
    ["start", "game", "results"].forEach((s) => $(s).classList.toggle("hidden", s !== screen));
  }

  // ---------- rendering ----------
  function renderBoards(flash) {
    const you = $("youSlots");
    you.innerHTML = "";
    CATS.forEach((cat, i) => {
      const c = state.you[cat.key];
      const el = document.createElement("div");
      el.className = "slot " + (c ? "filled" : "open") + (state.turn === "you" && !c && !state.busy ? " active" : "");
      if (flash === "you:" + cat.key) el.classList.add("flash");
      let hint = "";
      if (!c && showHints && state.turn === "you" && state.current) {
        hint = `<span class="hint">+${score(state.current, cat.key)}</span>`;
      }
      el.innerHTML = `<span class="key">${i + 1}</span><span>${cat.label}</span>${hint}<span class="state">${c ? c.name.toUpperCase() : "OPEN"}</span>`;
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

  function renderReveal(c, who) {
    const yours = who === "you";
    $("statusTitle").textContent = yours ? "YOUR DRAW" : "OPPONENT'S DRAW";
    document.querySelector(".status-card").classList.toggle("opp-turn", !yours);
    $("pickLabel").textContent = `PICK ${String(state.pick).padStart(2, "0")} / ${TOTAL_PICKS}`;
    $("revealWho").textContent = yours ? "YOUR DRAW" : `${state.oppName} DRAWS`;
    $("revealTitle").textContent = c.title;
    $("revealName").textContent = c.name;
    $("revealSeries").textContent = c.series;
    $("revealQ").textContent = yours ? `WHERE DOES ${c.name} FIGHT?` : `${state.oppName} IS CHOOSING...`;
    $("revealHelp").style.visibility = yours ? "visible" : "hidden";
    const r = $("reveal");
    r.classList.remove("pop");
    void r.offsetWidth;
    r.classList.add("pop");
    showBackground(c);
  }

  // ---------- turn flow ----------
  function nextTurn() {
    if (state.turn === "done") return;
    if (state.pick >= TOTAL_PICKS) return finish();
    state.pick++;
    state.current = state.deck.pop();
    state.busy = false;
    renderReveal(state.current, state.turn);
    renderBoards();
    startTimer();
    if (state.turn === "opp") {
      state.busy = true;
      setTimeout(botPlace, 1400 + Math.random() * 1600);
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
          // Out of time: drop into a random open slot.
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
    if (!state || state.turn !== "you" || state.busy || state.you[key]) return;
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

  function finish(forfeited) {
    clearInterval(timerHandle);
    let youTotal = 0, oppTotal = 0;
    const rows = CATS.map((cat) => {
      const a = state.you[cat.key], b = state.opp[cat.key];
      const sa = a ? score(a, cat.key) : 0;
      const sb = b ? score(b, cat.key) : 0;
      youTotal += sa; oppTotal += sb;
      return `<tr>
        <td class="${sa > sb ? "won" : ""}">${a ? a.name : "-"}<span class="pts">${sa}</span></td>
        <td>${cat.label}</td>
        <td class="${sb > sa ? "won" : ""}"><span class="pts">${sb}</span>${b ? b.name : "-"}</td>
      </tr>`;
    }).join("");
    $("resultRows").innerHTML = rows;
    $("youTotal").textContent = youTotal;
    $("oppTotal").textContent = oppTotal;
    $("rYou").textContent = state.youName;
    $("rOpp").textContent = state.oppName;
    const t = $("resultTitle");
    if (forfeited) { t.textContent = "YOU FORFEITED"; t.className = "lose"; }
    else if (youTotal > oppTotal) { t.textContent = "YOU WIN"; t.className = "win"; }
    else if (youTotal < oppTotal) { t.textContent = "YOU LOSE"; t.className = "lose"; }
    else { t.textContent = "DRAW"; t.className = ""; }
    state.turn = "done";
    show("results");
  }

  // ---------- input ----------
  document.addEventListener("keydown", (e) => {
    if ($("game").classList.contains("hidden")) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= CATS.length) playerPlace(CATS[n - 1].key);
  });
  $("startBtn").addEventListener("click", newGame);
  $("againBtn").addEventListener("click", () => show("start"));
  $("forfeitBtn").addEventListener("click", () => {
    if (confirm("Forfeit this draft?")) finish(true);
  });

  // Start-screen backdrop
  showBackground(ROSTER[Math.floor(Math.random() * ROSTER.length)]);
})();
