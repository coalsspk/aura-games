/* Новые мини-игры Aura — управление + визуал, награды ✨ */
(function initMiniGames() {
  const canvas = document.getElementById("miniGameCanvas");
  const frame = document.getElementById("miniGameFrame");
  const statusEl = document.getElementById("miniGameStatus");
  const titleEl = document.getElementById("miniGameTitle");
  const startBtn = document.getElementById("miniGameStartBtn");
  const controlsEl = document.getElementById("miniGameControls");
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
  };

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
      startBtn.disabled = playing;
      if (!playing) startBtn.textContent = gameOver ? "🔄 Снова" : "▶ Старт";
    }
    if (controlsEl) {
      controlsEl.hidden = !playing || !PAD_GAMES.has(gameId);
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
      default:
        break;
    }
  }

  function start(id) {
    gameId = id || gameId;
    if (!gameId) return;
    if (titleEl) titleEl.textContent = TITLES[gameId] || gameId;
    resetState(gameId);
    gameOver = false;
    setRunning(true);
    setStatus("Играйте · награда в ✨");
    if (controlsEl) {
      controlsEl.hidden = !PAD_GAMES.has(gameId);
      const main = controlsEl.querySelector('[data-mini-action="action"]');
      if (main) main.textContent = gameId === "dash" ? "⬆ Прыжок" : "↻ Поворот";
    }
  }

  function stop() {
    setRunning(false);
    gameId = "";
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

  function inRect(cx, cy, r) {
    return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
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
          if (Math.abs(a - b) === 1 || Math.abs(a - b) === 5) {
            [state.cells[a], state.cells[b]] = [state.cells[b], state.cells[a]];
            state.score++;
            if (state.score >= state.need) finish(true, state.score);
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
      gameOver = false;
      playing = false;
      if (titleEl) titleEl.textContent = TITLES[id] || id;
      resetState(id);
      setRunning(false);
      setStatus("Нажмите «Старт» или тапните по полю");
      draw();
      return true;
    },
    start,
    stop,
  };
})();
