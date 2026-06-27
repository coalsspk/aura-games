/* Новые мини-игры Aura — управление + визуал, награды ✨ */
(function initMiniGames() {
  const canvas = document.getElementById("miniGameCanvas");
  const frame = document.getElementById("miniGameFrame");
  const statusEl = document.getElementById("miniGameStatus");
  const titleEl = document.getElementById("miniGameTitle");
  const startBtn = document.getElementById("miniGameStartBtn");
  const controlsEl = document.getElementById("miniGameControls");
  const zodiacStatsEl = document.getElementById("zodiacStats");
  const zodiacTotalHitsEl = document.getElementById("zodiacTotalHits");
  const zodiacRublesEl = document.getElementById("zodiacRubles");
  const zodiacSessionHitsEl = document.getElementById("zodiacSessionHits");
  const zodiacRulesBtn = document.getElementById("zodiacRulesBtn");
  const zodiacRulesModal = document.getElementById("zodiacRulesModal");
  const zodiacRulesClose = document.getElementById("zodiacRulesClose");
  if (!canvas) return;

  let ctx;
  let dpr = 1;
  let W = 320;
  let H = 320;
  let gameId = "";
  let playing = false;
  let gameOver = false;
  let state = {};
  let animT = 0;

  const TITLES = {
    reading: "📗 Я читаю!",
    community: "👩 Modern Community",
    hole: "🕳️ Hole Express",
    shop: "🏪 City Shop",
    dash: "⬛ Geometry Dash",
    ludus: "⚔️ Лудус",
    war: "🛡️ Война судьбы",
    bolt: "🔩 Мастер Болт",
    indycat: "🐱 Инди кот",
    blocks: "🧱 Блоки",
    royal: "👑 Royal Kingdom",
    zodiac_tapper: "♈ Зодиак таппер",
  };

  const ZODIAC_SIGNS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
  const ZODIAC_STORAGE_KEY = "aura_zodiac_tapper_hits_v2";
  const ZODIAC_SUBMITTED_KEY = "aura_zodiac_tapper_submitted_v1";
  const ZODIAC_COMET_LEVEL_KEY = "aura_zodiac_tapper_comet_level_v1";
  const ZODIAC_LAST_VISIT_KEY = "aura_zodiac_tapper_last_visit_v1";

  const PAD_GAMES = new Set(["dash", "blocks"]);

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
      this.rect(x, y, w, h);
    };
  }

  function setupCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.min(340, Math.floor(window.innerWidth * 0.92));
    H = W;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    const sx = W / r.width;
    const sy = H / r.height;
    const cx = ("clientX" in e ? e.clientX : e.touches?.[0]?.clientX) - r.left;
    const cy = ("clientY" in e ? e.clientY : e.touches?.[0]?.clientY) - r.top;
    return { x: cx * sx, y: cy * sy };
  }

  function setStatus(t) {
    if (statusEl) statusEl.textContent = t;
  }

  function setRunning(on) {
    playing = on && !gameOver;
    frame?.classList.toggle("minigame-running", playing);
    if (startBtn) {
      startBtn.disabled = playing || gameId === "zodiac_tapper";
      if (!playing) startBtn.textContent = gameOver ? "🔄 Снова" : "▶ Старт";
    }
    if (controlsEl) {
      controlsEl.hidden = gameId === "zodiac_tapper" || !playing || !PAD_GAMES.has(gameId);
    }
  }

  function finish(didWin, score, kind) {
    playing = false;
    gameOver = true;
    setRunning(false);
    const reward = window.AuraEconomy?.rewardForKind(kind || gameId, gameId) ?? 10;
    if (typeof setResult === "function") {
      setResult(gameId, didWin, score, { kind: kind || gameId, aura_pts: didWin ? reward : 0 });
    }
    setStatus(
      didWin
        ? `🎉 +${reward} ✨ · 💫 ${window.AuraEconomy?.getBalance?.() ?? 0}`
        : "Попробуйте снова · 🔄 Снова"
    );
  }

  function pickReadingOptions() {
    const w = state.words[state.round];
    if (!w) return;
    const correct = w[1];
    const all = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЫЭЮЯ".split("");
    const opts = new Set([correct]);
    while (opts.size < 4) opts.add(all[(Math.random() * all.length) | 0]);
    state.options = [...opts].sort(() => Math.random() - 0.5);
    state.word = w[0];
    state.hitRects = [];
    const pad = 8;
    const bw = (W - pad * 3) / 2;
    const bh = 48;
    const y0 = H * 0.52;
    state.options.forEach((letter, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      state.hitRects.push({
        letter,
        x: pad + col * (bw + pad),
        y: y0 + row * (bh + pad),
        w: bw,
        h: bh,
      });
    });
  }

  function spawnBlock() {
    const shapes = [
      [[1, 1, 1, 1]],
      [[1, 1], [1, 1]],
      [[0, 1, 0], [1, 1, 1]],
    ];
    state.piece = {
      shape: shapes[(Math.random() * shapes.length) | 0],
      x: 3,
      y: 0,
      fallT: 0,
    };
  }

  function spawnRoyalTile() {
    const empty = [];
    for (let i = 0; i < 16; i++) if (!state.board[i]) empty.push(i);
    if (empty.length) {
      const i = empty[(Math.random() * empty.length) | 0];
      state.board[i] = Math.random() < 0.88 ? 2 : 4;
    }
  }

  function resetState(id) {
    gameOver = false;
    state = { t: 0, flash: 0 };
    switch (id) {
      case "reading":
        state.words = [
          ["КОТ", "О"],
          ["ДОМ", "О"],
          ["АУРА", "А"],
          ["ИГРА", "И"],
          ["СОЛ", "О"],
        ];
        state.round = 0;
        state.score = 0;
        pickReadingOptions();
        break;
      case "community":
        state.hearts = 0;
        state.target = 12;
        state.spawnCd = 0;
        state.items = [];
        break;
      case "hole":
        state.x = W / 2;
        state.y = H / 2;
        state.r = 24;
        state.dots = [];
        for (let i = 0; i < 28; i++) {
          state.dots.push({
            x: 24 + Math.random() * (W - 48),
            y: 24 + Math.random() * (H - 48),
            s: 5 + Math.random() * 5,
            hue: (Math.random() * 60 + 80) | 0,
          });
        }
        state.eaten = 0;
        state.need = 20;
        break;
      case "shop":
        state.gold = 0;
        state.level = 1;
        state.target = 60;
        state.btn = { x: W / 2 - 70, y: H / 2 - 36, w: 140, h: 72 };
        break;
      case "dash":
        state.y = H * 0.58;
        state.vy = 0;
        state.ground = H * 0.74;
        state.obstacles = [];
        state.dist = 0;
        state.need = 2200;
        state.spawnCd = 0;
        break;
      case "ludus":
        state.hits = 0;
        state.need = 5;
        state.bar = 0.5;
        state.dir = 1;
        state.zone = 0.38;
        state.zoneW = 0.14;
        break;
      case "war":
        state.player = 0;
        state.enemy = 0;
        state.round = 0;
        state.need = 18;
        state.lastRoll = null;
        state.btn = { x: W / 2 - 64, y: H * 0.58, w: 128, h: 52 };
        break;
      case "bolt":
        state.order = [2, 0, 3, 1];
        state.step = 0;
        state.positions = [
          { x: W * 0.28, y: H * 0.32 },
          { x: W * 0.72, y: H * 0.32 },
          { x: W * 0.28, y: H * 0.68 },
          { x: W * 0.72, y: H * 0.68 },
        ];
        break;
      case "indycat":
        state.cells = [];
        state.sel = null;
        state.score = 0;
        state.need = 10;
        {
          const em = ["🐱", "🧶", "🐟", "💎", "⭐"];
          for (let i = 0; i < 25; i++) state.cells.push(em[(Math.random() * 5) | 0]);
        }
        break;
      case "blocks":
        state.grid = Array.from({ length: 10 }, () => Array(8).fill(0));
        state.lines = 0;
        state.need = 5;
        spawnBlock();
        break;
      case "royal":
        state.board = Array.from({ length: 16 }, () => 0);
        state.score = 0;
        state.need = 128;
        state.sel = null;
        spawnRoyalTile();
        spawnRoyalTile();
        break;
      case "zodiac_tapper":
        state.score = loadZodiacHits();
        state.sessionScore = 0;
        state.decayInfo = applyZodiacDailyDecay();
        state.submittedTotal = loadZodiacSubmittedHits(state.score);
        state.roundMs = 1200;
        state.targetLeft = 820;
        state.nextTargetIn = 250;
        state.target = -1;
        state.rotation = 0;
        state.spin = 0.0028;
        state.hitFlash = 0;
        state.lastSubmitted = 0;
        state.orbs = [];
        state.orbSpawnIn = 700;
        state.comet = null;
        state.cometSpawnIn = 900;
        state.cometLevelSeen = loadZodiacCometLevel();
        state.levelSeen = zodiacTier() + 1;
        state.drainCircles = [];
        state.drainCircleLevel = state.levelSeen;
        state.drainCirclesSpawned = 0;
        state.drainCircleSpawnIn = 3200 + Math.random() * 5200;
        updateZodiacStats();
        if (state.decayInfo?.lost > 0) {
          setStatus(`Счёт уменьшен на ${state.decayInfo.lost} ✨ за ${state.decayInfo.missedDays} пропущ. дн.`);
        }
        syncZodiacMilestones();
        break;
      default:
        break;
    }
  }

  function updateChrome() {
    const isZodiac = gameId === "zodiac_tapper";
    document.body?.classList.toggle("zodiac-tapper-mode", isZodiac);
    if (zodiacStatsEl) zodiacStatsEl.hidden = !isZodiac;
    if (zodiacRulesBtn) zodiacRulesBtn.hidden = !isZodiac;
    if (!isZodiac && zodiacRulesModal) zodiacRulesModal.hidden = true;
  }

  function start(id) {
    gameId = id || gameId;
    if (!gameId) return;
    updateChrome();
    if (titleEl) titleEl.textContent = TITLES[gameId] || gameId;
    resetState(gameId);
    gameOver = false;
    setRunning(true);
    setStatus("Играйте · награда в ✨");
    if (gameId === "zodiac_tapper" && state.decayInfo?.lost > 0) {
      setStatus(`Счёт уменьшен на ${state.decayInfo.lost} ✨ за ${state.decayInfo.missedDays} пропущ. дн.`);
    }
    if (controlsEl) {
      controlsEl.hidden = gameId === "zodiac_tapper" || !PAD_GAMES.has(gameId);
      const main = controlsEl.querySelector('[data-mini-action="action"]');
      if (main) main.textContent = gameId === "dash" ? "⬆ Прыжок" : "↻ Поворот";
    }
    if (gameId === "zodiac_tapper") updateZodiacStats();
  }

  function stop() {
    setRunning(false);
    gameId = "";
    updateChrome();
  }

  function padAction(action) {
    if (!playing || gameOver) return;
    if (gameId === "dash" && (action === "action" || action === "left" || action === "right")) {
      if (action === "action" && state.y >= state.ground - 2) state.vy = -10;
      return;
    }
    if (gameId === "blocks") {
      if (action === "left") state.piece.x = Math.max(0, state.piece.x - 1);
      if (action === "right") state.piece.x = Math.min(7, state.piece.x + 1);
      if (action === "action") rotateBlock();
    }
  }

  function rotateBlock() {
    if (!state.piece) return;
    const s = state.piece.shape;
    state.piece.shape = s[0].map((_, i) => s.map((row) => row[i]).reverse());
  }

  function update(dt) {
    if (!playing || gameOver) return;
    state.t += dt;
    if (state.flash > 0) state.flash -= dt;

    switch (gameId) {
      case "community":
        state.spawnCd -= dt;
        if (state.spawnCd <= 0) {
          state.spawnCd = 700 + Math.random() * 500;
          state.items.push({
            x: 36 + Math.random() * (W - 72),
            y: -24,
            life: 3500,
            s: 1 + Math.random() * 0.4,
          });
        }
        state.items.forEach((it) => {
          it.y += 1.4 * (dt / 16);
          it.life -= dt;
        });
        state.items = state.items.filter((it) => it.y < H + 30 && it.life > 0);
        if (state.hearts >= state.target) finish(true, state.hearts);
        break;
      case "hole":
        state.dots = state.dots.filter((d) => {
          if (Math.hypot(d.x - state.x, d.y - state.y) < state.r + d.s) {
            state.eaten++;
            state.r = Math.min(58, state.r + 1.2);
            state.flash = 120;
            return false;
          }
          return true;
        });
        if (state.eaten >= state.need) finish(true, state.eaten);
        break;
      case "dash":
        state.dist += dt * 0.14;
        state.vy += 0.52;
        state.y += state.vy;
        if (state.y >= state.ground) {
          state.y = state.ground;
          state.vy = 0;
        }
        state.spawnCd -= dt;
        if (state.spawnCd <= 0) {
          state.obstacles.push({
            x: W + 8,
            h: 24 + Math.random() * 28,
            w: 16 + Math.random() * 8,
          });
          state.spawnCd = 750 + Math.random() * 450;
        }
        state.obstacles.forEach((o) => {
          o.x -= 3.8;
        });
        state.obstacles = state.obstacles.filter((o) => o.x > -40);
        {
          const px = 52;
          const pw = 22;
          const ph = 22;
          for (const o of state.obstacles) {
            const oy = state.ground - o.h;
            if (px + pw > o.x && px < o.x + o.w && state.y + ph > oy && state.y < state.ground) {
              finish(false, Math.floor(state.dist));
              return;
            }
          }
        }
        if (state.dist >= state.need) finish(true, Math.floor(state.dist));
        break;
      case "ludus":
        state.bar += state.dir * 0.00085 * dt;
        if (state.bar >= 1) {
          state.bar = 1;
          state.dir = -1;
        }
        if (state.bar <= 0) {
          state.bar = 0;
          state.dir = 1;
        }
        break;
      case "blocks":
        if (!state.piece) return;
        state.piece.fallT += dt;
        if (state.piece.fallT > 380) {
          state.piece.fallT = 0;
          state.piece.y++;
          if (collideBlock()) {
            if (state.lines >= state.need) finish(true, state.lines);
            else finish(false, state.lines);
          }
        }
        break;
      case "zodiac_tapper":
        state.spin = zodiacSpinSpeed();
        state.rotation += dt * state.spin;
        state.orbSpawnIn -= dt;
        if (state.orbSpawnIn <= 0) {
          state.orbSpawnIn = Math.max(450, 1300 - zodiacTier() * 80 - Math.random() * 260);
          const side = (Math.random() * 4) | 0;
          const tier = zodiacTier();
          const prize = tier >= 2 && Math.random() < 0.13;
          const isBad = !prize && tier >= 1 && Math.random() < Math.min(0.42, 0.18 + tier * 0.03);
          const orb = {
            value: prize
              ? 30 + ((Math.random() * 71) | 0)
              : isBad
              ? -(Math.random() < 0.10 ? 5 : Math.random() < 0.35 ? 2 : 1)
              : (Math.random() < 0.12 ? 5 : Math.random() < 0.32 ? 2 : 1),
            r: 13 + Math.random() * 5,
            life: 3600,
            prize,
          };
          if (side === 0) {
            orb.x = -20;
            orb.y = 28 + Math.random() * (H - 56);
          } else if (side === 1) {
            orb.x = W + 20;
            orb.y = 28 + Math.random() * (H - 56);
          } else if (side === 2) {
            orb.x = 28 + Math.random() * (W - 56);
            orb.y = -20;
          } else {
            orb.x = 28 + Math.random() * (W - 56);
            orb.y = H + 20;
          }
          const tx = W * (0.25 + Math.random() * 0.5);
          const ty = H * (0.25 + Math.random() * 0.5);
          const d = Math.max(1, Math.hypot(tx - orb.x, ty - orb.y));
          const speed = prize
            ? 0.145 + tier * 0.018 + Math.random() * 0.05
            : 0.055 + tier * 0.006 + Math.random() * 0.025;
          orb.vx = ((tx - orb.x) / d) * speed;
          orb.vy = ((ty - orb.y) / d) * speed;
          state.orbs.push(orb);
        }
        state.orbs.forEach((orb) => {
          orb.x += orb.vx * dt;
          orb.y += orb.vy * dt;
          orb.life -= dt;
        });
        state.orbs = state.orbs.filter(
          (orb) => orb.life > 0 && orb.x > -60 && orb.x < W + 60 && orb.y > -60 && orb.y < H + 60
        );
        {
          const level = zodiacTier() + 1;
          if ((state.drainCircleLevel || 0) !== level) {
            state.levelSeen = level;
            resetZodiacDrainLevel(level);
          }
          const drainLimit = Math.max(2, level * 2);
          state.drainCircles = state.drainCircles || [];
          state.drainCircleSpawnIn -= dt;
          if (
            state.drainCircleSpawnIn <= 0 &&
            state.drainCirclesSpawned < drainLimit &&
            state.drainCircles.length < Math.min(5, Math.max(2, level))
          ) {
            spawnZodiacDrainCircle(level);
            state.drainCirclesSpawned++;
            state.drainCircleSpawnIn = 7000 + Math.random() * 15000;
          }
          state.drainCircles.forEach((circle) => {
            circle.x += circle.vx * dt;
            circle.y += circle.vy * dt;
            circle.life -= dt;
            circle.spin += dt * 0.005;
            if (circle.x < circle.r || circle.x > W - circle.r) {
              circle.vx *= -1;
              circle.x = Math.max(circle.r, Math.min(W - circle.r, circle.x));
            }
            if (circle.y < circle.r || circle.y > H - circle.r) {
              circle.vy *= -1;
              circle.y = Math.max(circle.r, Math.min(H - circle.r, circle.y));
            }
          });
          state.drainCircles = state.drainCircles.filter((circle) => circle.life > 0);
          if (!state.comet && (state.cometLevelSeen || 0) < level) {
            state.cometSpawnIn -= dt;
            if (state.cometSpawnIn <= 0) {
              state.cometLevelSeen = level;
              saveZodiacCometLevel();
              const fromLeft = Math.random() < 0.5;
              const y = H * (0.18 + Math.random() * 0.64);
              const targetY = H * (0.18 + Math.random() * 0.64);
              const dx = fromLeft ? W + 90 : -90;
              const sx = fromLeft ? -90 : W + 90;
              const d = Math.max(1, Math.hypot(dx - sx, targetY - y));
              const speed = 0.22 + Math.min(0.12, zodiacTier() * 0.012);
              state.comet = {
                x: sx,
                y,
                vx: ((dx - sx) / d) * speed,
                vy: ((targetY - y) / d) * speed,
                r: 20,
                rubles: 5 + ((Math.random() * 16) | 0),
                tail: [],
                life: 5200,
                level,
              };
            }
          }
          if (state.comet) {
            state.comet.tail.unshift({ x: state.comet.x, y: state.comet.y });
            state.comet.tail = state.comet.tail.slice(0, 14);
            state.comet.x += state.comet.vx * dt;
            state.comet.y += state.comet.vy * dt;
            state.comet.life -= dt;
            if (
              state.comet.life <= 0 ||
              state.comet.x < -140 ||
              state.comet.x > W + 140 ||
              state.comet.y < -140 ||
              state.comet.y > H + 140
            ) {
              state.comet = null;
            }
          }
        }
        if (state.target >= 0) {
          state.targetLeft -= dt;
          if (state.targetLeft <= 0) {
            state.target = -1;
            state.nextTargetIn = 190;
            state.hitFlash = 160;
          }
        } else {
          state.nextTargetIn -= dt;
          if (state.nextTargetIn <= 0) {
            state.target = (Math.random() * ZODIAC_SIGNS.length) | 0;
            state.roundMs = zodiacTargetMs();
            state.targetLeft = state.roundMs;
            state.nextTargetIn = 0;
          }
        }
        if (state.hitFlash > 0) state.hitFlash -= dt;
        break;
      default:
        break;
    }
  }

  function collideBlock() {
    const p = state.piece;
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[y].length; x++) {
        if (!p.shape[y][x]) continue;
        const gx = p.x + x;
        const gy = p.y + y;
        if (gy >= 10 || gx < 0 || gx >= 8 || (gy >= 0 && state.grid[gy][gx])) {
          p.y--;
          mergeBlock();
          clearLines();
          spawnBlock();
          return p.y <= 0;
        }
      }
    }
    return false;
  }

  function mergeBlock() {
    const p = state.piece;
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[y].length; x++) {
        if (!p.shape[y][x]) continue;
        const gy = p.y + y;
        const gx = p.x + x;
        if (gy >= 0 && gy < 10 && gx >= 0 && gx < 8) state.grid[gy][gx] = 1;
      }
    }
  }

  function clearLines() {
    for (let y = 9; y >= 0; y--) {
      if (state.grid[y].every((c) => c)) {
        state.grid.splice(y, 1);
        state.grid.unshift(Array(8).fill(0));
        state.lines++;
        state.flash = 200;
        y++;
      }
    }
  }

  function zodiacTier() {
    return Math.floor((state.score || 0) / 1000);
  }

  function loadZodiacHits() {
    try {
      const raw = localStorage.getItem(ZODIAC_STORAGE_KEY);
      const n = parseInt(raw || "0", 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  function loadZodiacSubmittedHits(currentScore) {
    try {
      const raw = localStorage.getItem(ZODIAC_SUBMITTED_KEY);
      const n = parseInt(raw || "0", 10);
      if (!Number.isFinite(n) || n < 0) return 0;
      return n;
    } catch {
      return 0;
    }
  }

  function zodiacDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function zodiacDayNumber(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || "")) return null;
    const [y, m, d] = dateKey.split("-").map((part) => parseInt(part, 10));
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  function applyZodiacDailyDecay() {
    const todayKey = zodiacDateKey();
    try {
      const lastKey = localStorage.getItem(ZODIAC_LAST_VISIT_KEY);
      const today = zodiacDayNumber(todayKey);
      const last = zodiacDayNumber(lastKey);
      localStorage.setItem(ZODIAC_LAST_VISIT_KEY, todayKey);
      if (today == null || last == null || today <= last + 1 || state.score <= 0) {
        return { missedDays: 0, lost: 0 };
      }
      const missedDays = Math.max(0, today - last - 1);
      const before = Math.max(0, state.score | 0);
      const after = Math.floor(before * Math.pow(0.8, missedDays));
      state.score = Math.max(0, after);
      saveZodiacHits();
      return { missedDays, lost: before - state.score };
    } catch {
      return { missedDays: 0, lost: 0 };
    }
  }

  function loadZodiacCometLevel() {
    try {
      const raw = localStorage.getItem(ZODIAC_COMET_LEVEL_KEY);
      const n = parseInt(raw || "0", 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  function saveZodiacHits() {
    try {
      localStorage.setItem(ZODIAC_STORAGE_KEY, String(Math.max(0, state.score | 0)));
    } catch {
      /* private mode */
    }
  }

  function saveZodiacSubmittedHits() {
    try {
      localStorage.setItem(
        ZODIAC_SUBMITTED_KEY,
        String(Math.max(0, state.submittedTotal | 0))
      );
    } catch {
      /* private mode */
    }
  }

  function saveZodiacCometLevel() {
    try {
      localStorage.setItem(
        ZODIAC_COMET_LEVEL_KEY,
        String(Math.max(0, state.cometLevelSeen | 0))
      );
    } catch {
      /* private mode */
    }
  }

  function updateZodiacStats() {
    const level = zodiacTier() + 1;
    if (titleEl && gameId === "zodiac_tapper") {
      titleEl.textContent = `♈ Зодиак таппер · уровень ${level}`;
    }
    if (zodiacTotalHitsEl) zodiacTotalHitsEl.textContent = `${state.score || 0} ✨ всего`;
    if (zodiacRublesEl) zodiacRublesEl.textContent = `${Math.floor((state.score || 0) / 1000)} ₽`;
    if (zodiacSessionHitsEl) {
      const session = state.sessionScore || 0;
      zodiacSessionHitsEl.textContent = `${session >= 0 ? "+" : ""}${session} за сессию`;
    }
  }

  function resetZodiacDrainLevel(level) {
    state.drainCircleLevel = level;
    state.drainCirclesSpawned = 0;
    state.drainCircleSpawnIn = 2400 + Math.random() * 5200;
  }

  function spawnZodiacDrainCircle(level) {
    const r = 15 + Math.random() * 6;
    state.drainCircles = state.drainCircles || [];
    state.drainCircles.push({
      x: r + Math.random() * Math.max(1, W - r * 2),
      y: r + Math.random() * Math.max(1, H - r * 2),
      vx: (Math.random() < 0.5 ? -1 : 1) * (0.018 + Math.random() * 0.03 + level * 0.0015),
      vy: (Math.random() < 0.5 ? -1 : 1) * (0.018 + Math.random() * 0.03 + level * 0.0015),
      r,
      life: 60000 + Math.random() * 120000,
      spin: Math.random() * Math.PI * 2,
    });
  }

  function applyZodiacPercentPenalty(percent) {
    const before = Math.max(0, state.score | 0);
    if (before <= 0) return 0;
    const lost = Math.max(1, Math.ceil(before * percent));
    state.score = Math.max(0, before - lost);
    state.sessionScore = (state.sessionScore || 0) - lost;
    saveZodiacHits();
    updateZodiacStats();
    updateZodiacResult();
    return lost;
  }

  function spawnZodiacLevelFireworks(level) {
    state.orbs = state.orbs || [];
    const cx = W / 2;
    const cy = H / 2;
    const count = Math.min(22, 8 + level * 2);
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.34;
      const speed = 0.055 + Math.random() * 0.055;
      state.orbs.push({
        x: cx + Math.cos(a) * (18 + Math.random() * 24),
        y: cy + Math.sin(a) * (18 + Math.random() * 24),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        value: 10 + ((Math.random() * 21) | 0),
        r: 14 + Math.random() * 6,
        life: 6500,
        prize: true,
        firework: true,
      });
    }
    setStatus(`🎆 Уровень ${level}! Ловите салют +10…+30 ✨`);
  }

  function addZodiacPoints(amount) {
    const pts = amount | 0;
    if (!pts) return;
    const beforeLevel = zodiacTier() + 1;
    state.score = Math.max(0, (state.score || 0) + pts);
    state.sessionScore = (state.sessionScore || 0) + pts;
    saveZodiacHits();
    updateZodiacStats();
    updateZodiacResult();
    syncZodiacMilestones();
    const afterLevel = zodiacTier() + 1;
    if (pts > 0 && afterLevel > beforeLevel) {
      for (let level = beforeLevel + 1; level <= afterLevel; level++) {
        spawnZodiacLevelFireworks(level);
      }
      state.levelSeen = afterLevel;
      resetZodiacDrainLevel(afterLevel);
    } else if (afterLevel !== state.levelSeen) {
      state.levelSeen = afterLevel;
      resetZodiacDrainLevel(afterLevel);
    }
  }

  function syncZodiacMilestones() {
    const tg = window.Telegram?.WebApp;
    if (!tg?.sendData) return;
    const total = Math.max(0, state.score | 0);
    const submitted = Math.max(0, state.submittedTotal | 0);
    const ready = Math.floor((total - submitted) / 1000) * 1000;
    if (ready <= 0) return;
    state.submittedTotal = submitted + ready;
    saveZodiacSubmittedHits();
    tg.sendData(JSON.stringify({
      game: "zodiac_tapper",
      won: true,
      kind: "zodiac_tapper",
      score: ready,
      hits: ready,
      total_hits: total,
      rubles: Math.floor(total / 1000),
      auto: true,
    }));
    setStatus(`♈ Отправлено в бот: +${ready} ✨ · рубли начислятся сообщением`);
  }

  function sendZodiacCometReward(rubles) {
    const tg = window.Telegram?.WebApp;
    if (!tg?.sendData) return;
    const safeRubles = Math.max(5, Math.min(20, rubles | 0));
    tg.sendData(JSON.stringify({
      game: "zodiac_tapper",
      won: true,
      kind: "zodiac_tapper_comet",
      score: 0,
      hits: 0,
      total_hits: Math.max(0, state.score | 0),
      comet_rubles: safeRubles,
      auto: true,
    }));
    setStatus(`☄️ Комета поймана: +${safeRubles} ₽ отправлено в бот`);
  }

  function zodiacSpinSpeed() {
    return 0.0028 + zodiacTier() * 0.00085;
  }

  function zodiacTargetMs() {
    return Math.max(360, 900 - zodiacTier() * 55 - Math.min(220, (state.score || 0) * 0.25));
  }

  function updateZodiacResult() {
    if (typeof setResult !== "function") return;
    const earned = Math.max(0, state.sessionScore | 0);
    if (earned <= 0) return;
    setResult("zodiac_tapper", true, earned, {
      kind: "zodiac_tapper",
      hits: earned,
      total_hits: Math.max(0, state.score | 0),
      rubles: Math.floor((state.score || 0) / 1000),
    });
  }

  function drawBg(c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    if (!ctx) return;
    switch (gameId) {
      case "reading":
        drawReading();
        break;
      case "community":
        drawCommunity();
        break;
      case "hole":
        drawHole();
        break;
      case "shop":
        drawShop();
        break;
      case "dash":
        drawDash();
        break;
      case "ludus":
        drawLudus();
        break;
      case "war":
        drawWar();
        break;
      case "bolt":
        drawBolt();
        break;
      case "indycat":
        drawIndycat();
        break;
      case "blocks":
        drawBlocks();
        break;
      case "royal":
        drawRoyal();
        break;
      case "zodiac_tapper":
        drawZodiacTapper();
        break;
      default:
        drawBg("#1a1428", "#0a0618");
        ctx.fillStyle = "#fff";
        ctx.font = "16px system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Выберите игру в библиотеке", W / 2, H / 2);
    }
    if (!playing && !gameOver && gameId) drawStartOverlay();
  }

  function drawStartOverlay() {
    ctx.fillStyle = "rgba(8, 10, 24, 0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffd250";
    ctx.font = "600 18px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("▶ Старт", W / 2, H / 2);
  }

  function drawReading() {
    drawBg("#1b4332", "#081c15");
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(16, H * 0.12, W - 32, H * 0.28);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.min(32, W * 0.09)}px Georgia,serif`;
    ctx.textAlign = "center";
    ctx.fillText(state.word || "?", W / 2, H * 0.28);
    ctx.font = "13px system-ui,sans-serif";
    ctx.fillStyle = "#a8e6cf";
    ctx.fillText(`Раунд ${Math.min(state.round + 1, 5)}/5 · +${state.score} ✨`, W / 2, H * 0.42);
    (state.hitRects || []).forEach((r) => {
      ctx.fillStyle = "#40916c";
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      ctx.strokeStyle = "#ffd250";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px system-ui,sans-serif";
      ctx.fillText(r.letter, r.x + r.w / 2, r.y + r.h / 2 + 8);
    });
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px system-ui,sans-serif";
    ctx.fillText("Выберите пропущенную букву", W / 2, H - 16);
  }

  function drawCommunity() {
    drawBg("#4a1942", "#1a0a2e");
    ctx.font = "56px serif";
    ctx.textAlign = "center";
    ctx.fillText("👩", W / 2, H * 0.42);
    state.items.forEach((it) => {
      ctx.globalAlpha = Math.min(1, it.life / 800);
      ctx.font = `${28 * it.s}px serif`;
      ctx.fillText("❤️", it.x, it.y);
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui,sans-serif";
    ctx.fillText(`${state.hearts}/${state.target} ❤️`, W / 2, 22);
    ctx.font = "12px system-ui,sans-serif";
    ctx.fillStyle = "#ffb3d9";
    ctx.fillText("Тапайте падающие сердца", W / 2, H - 14);
  }

  function drawHole() {
    drawBg("#1565c0", "#0d47a1");
    state.dots.forEach((d) => {
      ctx.fillStyle = `hsl(${d.hue}, 70%, 55%)`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(d.x - d.s * 0.25, d.y - d.s * 0.25, d.s * 0.35, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.beginPath();
    ctx.arc(state.x, state.y, state.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd250";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${state.eaten}/${state.need}`, W / 2, 20);
    ctx.font = "11px system-ui,sans-serif";
    ctx.fillStyle = "#bbdefb";
    ctx.fillText("Водите пальцем по экрану", W / 2, H - 12);
  }

  function drawShop() {
    drawBg("#fff8e1", "#ffe0b2");
    ctx.fillStyle = "#5d4037";
    ctx.font = "bold 17px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`🏪 Магазин · ур. ${state.level}`, W / 2, 32);
    ctx.fillText(`💰 ${state.gold} / ${state.target}`, W / 2, 56);
    const b = state.btn;
    ctx.fillStyle = "#ff9800";
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px system-ui,sans-serif";
    ctx.fillText("ПРОДАТЬ", W / 2, b.y + b.h / 2 + 6);
    ctx.fillStyle = "#795548";
    ctx.font = "12px system-ui,sans-serif";
    ctx.fillText(`+${state.level} 💰 за тап`, W / 2, H - 16);
  }

  function drawDash() {
    drawBg("#0d47a1", "#01579b");
    ctx.fillStyle = "#263238";
    ctx.fillRect(0, state.ground, W, H - state.ground);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#37474f" : "#455a64";
      ctx.fillRect(i * (W / 8), state.ground, W / 8, H - state.ground);
    }
    state.obstacles.forEach((o) => {
      ctx.fillStyle = "#e53935";
      ctx.fillRect(o.x, state.ground - o.h, o.w, o.h);
      ctx.fillStyle = "#ffcdd2";
      ctx.fillRect(o.x + 2, state.ground - o.h + 2, o.w - 4, 6);
    });
    ctx.fillStyle = "#ffeb3b";
    ctx.fillRect(52, state.y - 18, 22, 22);
    ctx.fillStyle = "#f57f17";
    ctx.fillRect(58, state.y - 8, 10, 8);
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${Math.floor(state.dist)}/${state.need}`, 8, 18);
  }

  function drawLudus() {
    drawBg("#311b92", "#1a0033");
    ctx.font = "40px serif";
    ctx.textAlign = "center";
    ctx.fillText("⚔️", W / 2, H * 0.22);
    const bx = 32;
    const bw = W - 64;
    const by = H * 0.42;
    ctx.fillStyle = "#222";
    ctx.fillRect(bx, by, bw, 28);
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(bx + bw * state.zone, by, bw * state.zoneW, 28);
    ctx.fillStyle = "#ffd250";
    ctx.fillRect(bx + bw * state.bar - 7, by - 4, 14, 36);
    ctx.fillStyle = "#fff";
    ctx.font = "14px system-ui,sans-serif";
    ctx.fillText(`Удары ${state.hits}/${state.need}`, W / 2, 28);
    ctx.fillStyle = "#ce93d8";
    ctx.fillText("Тап, когда полоска в зелёной зоне", W / 2, H - 14);
  }

  function drawWar() {
    drawBg("#3e2723", "#1b0000");
    ctx.font = "36px serif";
    ctx.fillText("🛡️", W / 2 - 50, H * 0.28);
    ctx.fillText("💀", W / 2 + 50, H * 0.28);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Вы: ${state.player}`, W / 2 - 48, H * 0.42);
    ctx.fillText(`Враг: ${state.enemy}`, W / 2 + 48, H * 0.42);
    if (state.lastRoll) {
      ctx.font = "13px system-ui,sans-serif";
      ctx.fillStyle = "#ffd250";
      ctx.fillText(state.lastRoll, W / 2, H * 0.5);
    }
    const b = state.btn;
    ctx.fillStyle = "#ffd250";
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.font = "bold 16px system-ui,sans-serif";
    ctx.fillText("🎲 Бросок", W / 2, b.y + b.h / 2 + 6);
    ctx.fillStyle = "#bcaaa4";
    ctx.font = "12px system-ui,sans-serif";
    ctx.fillText(`Цель: ${state.need} очков`, W / 2, H - 14);
  }

  function drawBolt() {
    drawBg("#455a64", "#263238");
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(W * 0.15, H * 0.2, W * 0.7, H * 0.6);
    state.positions.forEach((p, i) => {
      const done = state.order.indexOf(i) < state.step;
      ctx.fillStyle = done ? "#546e7a" : "#ffc107";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = done ? "#37474f" : "#ff8f00";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "22px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(done ? "✓" : "🔩", p.x, p.y + 8);
    });
    ctx.fillStyle = "#fff";
    ctx.font = "13px system-ui,sans-serif";
    ctx.fillText(`Болты ${state.step}/4`, W / 2, 22);
    ctx.fillStyle = "#b0bec5";
    ctx.fillText("Нажимайте по порядку (подсказка: 3→1→4→2)", W / 2, H - 12);
  }

  function drawIndycat() {
    drawBg("#bf360c", "#3e2723");
    const cs = W / 5;
    for (let i = 0; i < 25; i++) {
      const x = (i % 5) * cs;
      const y = Math.floor(i / 5) * cs;
      ctx.fillStyle = i === state.sel ? "#ffd250" : "rgba(0,0,0,0.35)";
      ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
      ctx.font = `${cs * 0.42}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.cells[i], x + cs / 2, y + cs / 2);
    }
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui,sans-serif";
    ctx.fillText(`${state.score}/${state.need} ✨ · соседние клетки`, W / 2, H - 8);
  }

  function drawBlocks() {
    drawBg("#1a237e", "#0d1040");
    const cw = W / 8;
    const ch = H / 10;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let x = 0; x <= 8; x++) ctx.strokeRect(x * cw, 0, 0, H);
    for (let y = 0; y <= 10; y++) ctx.strokeRect(0, y * ch, W, 0);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 8; x++) {
        if (state.grid[y][x]) {
          ctx.fillStyle = "#5c6bc0";
          ctx.fillRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2);
        }
      }
    }
    if (state.piece) {
      ctx.fillStyle = "#ffd250";
      state.piece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
          if (cell) ctx.fillRect((state.piece.x + dx) * cw + 1, (state.piece.y + dy) * ch + 1, cw - 2, ch - 2);
        });
      });
    }
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Линии ${state.lines}/${state.need}`, W / 2, H - 6);
  }

  function drawRoyal() {
    drawBg("#4a148c", "#120338");
    const cs = W / 4;
    for (let i = 0; i < 16; i++) {
      const v = state.board[i];
      const x = (i % 4) * cs;
      const y = Math.floor(i / 4) * cs;
      ctx.fillStyle = i === state.sel ? "#ffd250" : v ? (v >= 64 ? "#ffd250" : "#7e57c2") : "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, cs - 6, cs - 6, 8);
      ctx.fill();
      if (v) {
        ctx.fillStyle = v >= 64 ? "#333" : "#fff";
        ctx.font = `bold ${v >= 100 ? 14 : 18}px system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(String(v), x + cs / 2, y + cs / 2 + 6);
      }
    }
    ctx.fillStyle = "#fff";
    ctx.font = "11px system-ui,sans-serif";
    ctx.fillText(`До ${state.need} · тап двух одинаковых соседних`, W / 2, H - 8);
  }

  function drawZodiacTapper() {
    const cx = W / 2;
    const cy = H / 2;
    const rOuter = W * 0.43;
    const rInner = W * 0.26;
    const tier = zodiacTier();
    drawBg("#08061a", "#151033");
    for (let i = 0; i < 42; i++) {
      const a = (i * 2.399 + animT * 0.00008) % (Math.PI * 2);
      const rr = 16 + ((i * 37) % Math.floor(rOuter + 40));
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      ctx.fillStyle = i % 3 ? "rgba(255,255,255,0.7)" : "rgba(255,210,80,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, i % 5 === 0 ? 1.6 : 1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.rotation);
    const halo = ctx.createRadialGradient(0, 0, rInner * 0.3, 0, 0, rOuter);
    halo.addColorStop(0, "rgba(255,255,255,0.08)");
    halo.addColorStop(0.58, "rgba(85,180,255,0.16)");
    halo.addColorStop(1, "rgba(255,210,80,0.18)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,210,80,0.92)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    for (const rr of [rOuter * 0.86, rInner, rInner * 0.58]) {
      ctx.strokeStyle = rr === rInner ? "rgba(255,255,255,0.42)" : "rgba(255,210,80,0.36)";
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < ZODIAC_SIGNS.length; i++) {
      const a = (Math.PI * 2 * i) / ZODIAC_SIGNS.length - Math.PI / 2;
      const x = Math.cos(a) * (rOuter * 0.73);
      const y = Math.sin(a) * (rOuter * 0.73);
      const isTarget = i === state.target;
      const pulse = isTarget ? 0.5 + Math.sin(animT * 0.05) * 0.5 : 0;
      if (isTarget) {
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = `rgba(255, 225, 90, ${0.34 + pulse * 0.38})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rOuter * 0.94, -Math.PI / 9, Math.PI / 9);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 245, ${0.45 + pulse * 0.45})`;
        ctx.lineWidth = 3 + pulse * 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(-Math.PI / 9) * rInner * 0.65, Math.sin(-Math.PI / 9) * rInner * 0.65);
        ctx.lineTo(Math.cos(-Math.PI / 9) * rOuter * 0.95, Math.sin(-Math.PI / 9) * rOuter * 0.95);
        ctx.moveTo(Math.cos(Math.PI / 9) * rInner * 0.65, Math.sin(Math.PI / 9) * rInner * 0.65);
        ctx.lineTo(Math.cos(Math.PI / 9) * rOuter * 0.95, Math.sin(Math.PI / 9) * rOuter * 0.95);
        ctx.stroke();
        ctx.restore();
        for (let ring = 0; ring < 3; ring++) {
          ctx.strokeStyle = `rgba(255, 255, 210, ${0.72 - ring * 0.18 + pulse * 0.24})`;
          ctx.lineWidth = 4 - ring * 0.7;
          ctx.beginPath();
          ctx.arc(x, y, 27 + ring * 10 + pulse * 12, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.fillStyle = isTarget ? "#fff8bd" : "rgba(255,255,255,0.78)";
      ctx.shadowColor = isTarget ? "rgba(255,210,80,0.95)" : "transparent";
      ctx.shadowBlur = isTarget ? 26 + pulse * 22 : 0;
      ctx.font = `${isTarget ? "bold " : ""}${Math.max(isTarget ? 42 : 23, W * (isTarget ? 0.145 : 0.085))}px Georgia,serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ZODIAC_SIGNS[i], x, y);
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (rInner * 0.3), Math.sin(a) * (rInner * 0.3));
      ctx.lineTo(Math.cos(a) * (rInner * 0.96), Math.sin(a) * (rInner * 0.96));
      ctx.stroke();
    }
    ctx.restore();

    (state.orbs || []).forEach((orb) => {
      const alpha = Math.max(0.18, Math.min(1, orb.life / 700));
      const bad = orb.value < 0;
      const prize = !!orb.prize;
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(orb.x, orb.y, 1, orb.x, orb.y, orb.r * 2.1);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(
        0.45,
        bad ? "rgba(255,72,120,0.96)" : prize ? "rgba(90,255,220,0.98)" : "rgba(255,210,80,0.95)"
      );
      g.addColorStop(
        1,
        bad ? "rgba(130,20,80,0)" : prize ? "rgba(80,170,255,0)" : "rgba(255,120,220,0)"
      );
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bad ? "#4a1230" : prize ? "#123d5a" : "#3b245f";
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = bad ? "#ffc4d6" : prize ? "#bffcff" : "#fff8bd";
      ctx.lineWidth = prize ? 3 : 2;
      ctx.stroke();
      ctx.fillStyle = bad ? "#ffd3df" : prize ? "#dcffff" : "#fff8bd";
      ctx.font = `bold ${Math.max(prize ? 10 : 11, orb.r * (prize ? 0.82 : 0.95))}px system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${orb.value > 0 ? "+" : ""}${orb.value}`, orb.x, orb.y + 0.5);
      ctx.globalAlpha = 1;
    });

    (state.drainCircles || []).forEach((circle) => {
      const pulse = 0.5 + Math.sin(animT * 0.006 + circle.spin) * 0.5;
      ctx.save();
      ctx.globalAlpha = Math.max(0.28, Math.min(1, circle.life / 1000));
      const g = ctx.createRadialGradient(circle.x, circle.y, 2, circle.x, circle.y, circle.r * 2.6);
      g.addColorStop(0, "rgba(255,255,255,0.96)");
      g.addColorStop(0.35, "rgba(255,64,122,0.98)");
      g.addColorStop(0.7, "rgba(150,36,190,0.88)");
      g.addColorStop(1, "rgba(80,0,110,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.r * (2.25 + pulse * 0.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#42102d";
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffd0df";
      ctx.lineWidth = 2.4 + pulse * 1.6;
      ctx.stroke();
      ctx.fillStyle = "#ffe1ea";
      ctx.font = `bold ${Math.max(10, circle.r * 0.7)}px system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("-10%", circle.x, circle.y + 0.5);
      ctx.restore();
    });

    if (state.comet) {
      ctx.save();
      state.comet.tail.forEach((p, i) => {
        const alpha = Math.max(0, 0.52 - i * 0.035);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = i % 2 ? "#7df9ff" : "#fff1a6";
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, state.comet.r - i * 1.15), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(
        state.comet.x,
        state.comet.y,
        2,
        state.comet.x,
        state.comet.y,
        state.comet.r * 2.4
      );
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, "#fff1a6");
      g.addColorStop(0.7, "rgba(125,249,255,0.92)");
      g.addColorStop(1, "rgba(70,120,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(state.comet.x, state.comet.y, state.comet.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8bd";
      ctx.beginPath();
      ctx.arc(state.comet.x, state.comet.y, state.comet.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7df9ff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#1e2450";
      ctx.font = "bold 11px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`₽${state.comet.rubles}`, state.comet.x, state.comet.y + 0.5);
      ctx.restore();
    }

    if (state.target >= 0) {
      ctx.fillStyle = "rgba(255,210,80,0.92)";
      const w = (W - 52) * Math.max(0, state.targetLeft / Math.max(1, state.roundMs));
      ctx.beginPath();
      ctx.roundRect(26, H - 28, w, 7, 5);
      ctx.fill();
      ctx.fillStyle = "#fff6c0";
      ctx.font = "bold 13px system-ui,sans-serif";
      ctx.fillText(`Тапните: ${ZODIAC_SIGNS[state.target]}`, cx, H - 42);
    } else {
      ctx.fillStyle = "#cdb8ff";
      ctx.font = "12px system-ui,sans-serif";
      ctx.fillText("Круг -10% · салют уровня +10…+30", cx, H - 36);
    }
  }

  function inRect(cx, cy, r) {
    return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
  }

  function indyAdjacent(a, b) {
    const ax = a % 5;
    const ay = Math.floor(a / 5);
    const bx = b % 5;
    const by = Math.floor(b / 5);
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }

  function indyMatches() {
    const found = new Set();
    for (let y = 0; y < 5; y++) {
      let run = [y * 5];
      for (let x = 1; x < 5; x++) {
        const idx = y * 5 + x;
        if (state.cells[idx] === state.cells[run[0]]) run.push(idx);
        else {
          if (run.length >= 3) run.forEach((i) => found.add(i));
          run = [idx];
        }
      }
      if (run.length >= 3) run.forEach((i) => found.add(i));
    }
    for (let x = 0; x < 5; x++) {
      let run = [x];
      for (let y = 1; y < 5; y++) {
        const idx = y * 5 + x;
        if (state.cells[idx] === state.cells[run[0]]) run.push(idx);
        else {
          if (run.length >= 3) run.forEach((i) => found.add(i));
          run = [idx];
        }
      }
      if (run.length >= 3) run.forEach((i) => found.add(i));
    }
    return [...found];
  }

  function indyRefill(cleared) {
    const em = ["🐱", "🧶", "🐟", "💎", "⭐"];
    cleared.forEach((i) => {
      state.cells[i] = em[(Math.random() * em.length) | 0];
    });
  }

  function onTap(cx, cy) {
    if (gameOver) {
      start(gameId);
      return;
    }
    if (!playing) {
      start(gameId);
      return;
    }

    switch (gameId) {
      case "reading":
        for (const r of state.hitRects || []) {
          if (inRect(cx, cy, r)) {
            const w = state.words[state.round];
            if (r.letter === w[1]) {
              state.score++;
              state.round++;
              state.flash = 150;
              if (state.round >= state.words.length) finish(true, state.score);
              else pickReadingOptions();
            } else finish(false, state.score);
            return;
          }
        }
        break;
      case "community":
        for (const it of state.items) {
          if (Math.hypot(cx - it.x, cy - it.y) < 40) {
            state.hearts++;
            it.life = 0;
            state.flash = 80;
            if (typeof burstParticles === "function") burstParticles(6);
            return;
          }
        }
        break;
      case "hole":
        state.x = cx;
        state.y = cy;
        break;
      case "shop":
        if (inRect(cx, cy, state.btn)) {
          state.gold += state.level * 2;
          state.flash = 60;
          if (state.gold >= state.target) {
            state.level++;
            state.gold = 0;
            state.target = 50 + state.level * 25;
            if (state.level > 4) finish(true, state.level);
          }
        }
        break;
      case "dash":
        if (state.y >= state.ground - 2) state.vy = -10;
        break;
      case "ludus": {
        const inZone = state.bar >= state.zone && state.bar <= state.zone + state.zoneW;
        if (inZone) {
          state.hits++;
          state.zone = 0.08 + Math.random() * (0.82 - state.zoneW);
          state.flash = 120;
          if (state.hits >= state.need) finish(true, state.hits);
        } else finish(false, state.hits);
        break;
      }
      case "war":
        if (inRect(cx, cy, state.btn)) {
          const pr = 2 + ((Math.random() * 5) | 0);
          const er = 2 + ((Math.random() * 5) | 0);
          state.player += pr;
          state.enemy += er;
          state.round++;
          state.lastRoll = `+${pr} vs +${er}`;
          if (state.player >= state.need || state.enemy >= state.need) {
            finish(state.player >= state.enemy && state.player >= state.need, state.player);
          }
        }
        break;
      case "bolt":
        for (let i = 0; i < state.positions.length; i++) {
          const p = state.positions[i];
          if (Math.hypot(cx - p.x, cy - p.y) < 36) {
            if (i === state.order[state.step]) {
              state.step++;
              state.flash = 100;
              if (state.step >= 4) finish(true, 4);
            } else finish(false, state.step);
            return;
          }
        }
        break;
      case "indycat": {
        const cs = W / 5;
        const idx = Math.floor(cy / cs) * 5 + Math.floor(cx / cs);
        if (idx < 0 || idx >= 25) break;
        if (state.sel == null) state.sel = idx;
        else if (state.sel === idx) state.sel = null;
        else {
          const a = state.sel;
          const b = idx;
          if (indyAdjacent(a, b)) {
            [state.cells[a], state.cells[b]] = [state.cells[b], state.cells[a]];
            const matched = indyMatches();
            if (matched.length >= 3) {
              state.score += matched.length;
              state.flash = 120;
              indyRefill(matched);
              if (typeof burstParticles === "function") burstParticles(10);
              if (state.score >= state.need) finish(true, state.score);
            } else {
              [state.cells[a], state.cells[b]] = [state.cells[b], state.cells[a]];
              state.flash = 60;
            }
          }
          state.sel = null;
        }
        break;
      }
      case "blocks":
        if (cx < W / 2) state.piece.x = Math.max(0, state.piece.x - 1);
        else state.piece.x = Math.min(7, state.piece.x + 1);
        if (cy < H * 0.35) rotateBlock();
        break;
      case "royal": {
        const cs = W / 4;
        const idx = Math.floor(cy / cs) * 4 + Math.floor(cx / cs);
        if (idx < 0 || idx > 15 || !state.board[idx]) break;
        if (state.sel == null) {
          state.sel = idx;
        } else if (state.sel === idx) {
          state.sel = null;
        } else {
          const a = state.sel;
          const b = idx;
          const adj = Math.abs(a - b) === 1 || Math.abs(a - b) === 4;
          if (adj && state.board[a] === state.board[b]) {
            state.board[b] *= 2;
            state.board[a] = 0;
            state.score = Math.max(state.score, state.board[b]);
            spawnRoyalTile();
            state.flash = 100;
            if (state.score >= state.need) finish(true, state.score);
          }
          state.sel = null;
        }
        break;
      }
      case "zodiac_tapper": {
        if (state.comet && Math.hypot(cx - state.comet.x, cy - state.comet.y) <= state.comet.r * 2.05) {
          const rubles = state.comet.rubles;
          state.comet = null;
          state.hitFlash = 240;
          sendZodiacCometReward(rubles);
          if (typeof burstParticles === "function") burstParticles(48);
          return;
        }
        for (let i = (state.drainCircles || []).length - 1; i >= 0; i--) {
          const circle = state.drainCircles[i];
          if (Math.hypot(cx - circle.x, cy - circle.y) <= circle.r * 1.85) {
            const lost = applyZodiacPercentPenalty(0.1);
            state.drainCircles.splice(i, 1);
            state.hitFlash = 220;
            setStatus(`⚠️ Вредный круг: -${lost} ✨`);
            if (typeof burstParticles === "function") burstParticles(10);
            return;
          }
        }
        for (let i = (state.orbs || []).length - 1; i >= 0; i--) {
          const orb = state.orbs[i];
          if (Math.hypot(cx - orb.x, cy - orb.y) <= orb.r * 1.8) {
            addZodiacPoints(orb.value);
            state.orbs.splice(i, 1);
            state.hitFlash = 180;
            if (typeof burstParticles === "function") {
              burstParticles(orb.value > 0 ? 12 + orb.value * 2 : 7);
            }
            return;
          }
        }
        if (state.target < 0) break;
        const dx = cx - W / 2;
        const dy = cy - H / 2;
        const dist = Math.hypot(dx, dy);
        const rOuter = W * 0.43;
        const rInner = W * 0.2;
        if (dist < rInner || dist > rOuter) {
          state.hitFlash = 90;
          break;
        }
        let ang = Math.atan2(dy, dx) - state.rotation + Math.PI / 2;
        ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const idx = Math.round(ang / (Math.PI * 2 / ZODIAC_SIGNS.length)) % ZODIAC_SIGNS.length;
        if (idx === state.target) {
          addZodiacPoints(1);
          state.target = -1;
          state.nextTargetIn = 170;
          state.hitFlash = 220;
          if (typeof burstParticles === "function") burstParticles(18);
        } else {
          state.target = -1;
          state.nextTargetIn = 210;
          state.hitFlash = 160;
        }
        break;
      }
      default:
        break;
    }
  }

  function bindInput() {
    const down = (e) => {
      if (!gameId) return;
      if (e.cancelable) e.preventDefault();
      const p = canvasPoint(e);
      onTap(p.x, p.y);
    };

    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (canvas.setPointerCapture) {
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        down(e);
      },
      { passive: false }
    );

    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!playing || gameId !== "hole") return;
        const p = canvasPoint(e);
        state.x = p.x;
        state.y = p.y;
      },
      { passive: false }
    );

    if (!window.PointerEvent) {
      canvas.addEventListener("touchstart", down, { passive: false });
      canvas.addEventListener(
        "touchmove",
        (e) => {
          if (!playing || gameId !== "hole") return;
          e.preventDefault();
          const p = canvasPoint(e);
          state.x = p.x;
          state.y = p.y;
        },
        { passive: false }
      );
    }

    document.querySelectorAll("[data-mini-action]").forEach((btn) => {
      const action = btn.dataset.miniAction;
      const press = (e) => {
        e.preventDefault();
        btn.classList.add("minigame-pad-active");
        padAction(action);
      };
      const release = () => btn.classList.remove("minigame-pad-active");
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointercancel", release);
    });
  }

  let last = 0;
  function miniLoop(ts) {
    const dt = last ? Math.min(48, ts - last) : 16;
    last = ts;
    animT = ts;
    if (gameId && window.AuraEngine?.isPanelActive?.("minigame")) {
      update(dt);
      draw();
    }
  }

  startBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (gameId) start(gameId);
  });
  startBtn?.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      if (gameId) start(gameId);
    },
    { passive: false }
  );

  zodiacRulesBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (zodiacRulesModal) zodiacRulesModal.hidden = false;
  });
  zodiacRulesClose?.addEventListener("click", (e) => {
    e.preventDefault();
    if (zodiacRulesModal) zodiacRulesModal.hidden = true;
  });
  zodiacRulesModal?.addEventListener("click", (e) => {
    if (e.target === zodiacRulesModal) zodiacRulesModal.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && zodiacRulesModal && !zodiacRulesModal.hidden) {
      zodiacRulesModal.hidden = true;
    }
  });

  bindInput();
  setupCanvas();
  const onMiniResize = window.AuraEngine?.debounce
    ? window.AuraEngine.debounce(setupCanvas)
    : setupCanvas;
  window.addEventListener("resize", onMiniResize);
  if (window.AuraEngine?.createTabLoop) {
    window.AuraEngine.createTabLoop("minigame", miniLoop, {
      match: () => window.AuraEngine.isPanelActive("minigame") && !!gameId,
    });
  } else {
    requestAnimationFrame(function loop(ts) {
      miniLoop(ts);
      requestAnimationFrame(loop);
    });
  }

  window.MiniGames = {
    show(id) {
      gameId = id;
      updateChrome();
      gameOver = false;
      playing = false;
      if (titleEl) titleEl.textContent = TITLES[id] || id;
      resetState(id);
      setRunning(false);
      setStatus("Нажмите «Старт» или тапните по полю");
      draw();
      if (id === "zodiac_tapper") {
        start(id);
        setStatus("♈ Бесконечная игра · ловите знаки и бонусы");
      }
      return true;
    },
    start,
    stop,
  };
})();
