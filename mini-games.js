/* Новые мини-игры Aura — награды в ✨ */
(function initMiniGames() {
  const canvas = document.getElementById("miniGameCanvas");
  const statusEl = document.getElementById("miniGameStatus");
  const titleEl = document.getElementById("miniGameTitle");
  const startBtn = document.getElementById("miniGameStartBtn");
  if (!canvas) return;

  let ctx;
  let dpr = 1;
  let W = 320;
  let H = 320;
  let gameId = "";
  let playing = false;
  let gameOver = false;
  let won = false;
  let state = {};
  let raf = 0;

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
  }

  function setStatus(t) {
    if (statusEl) statusEl.textContent = t;
  }

  function finish(didWin, score, kind) {
    playing = false;
    gameOver = true;
    won = didWin;
    const reward = window.AuraEconomy?.rewardForKind(kind || gameId, gameId) ?? 10;
    if (typeof setResult === "function") {
      setResult(gameId, didWin, score, { kind: kind || gameId, aura_pts: didWin ? reward : 0 });
    }
    setStatus(
      didWin ? `🎉 +${reward} ✨ · 💫 ${AuraEconomy?.getBalance?.() ?? 0}` : "Попробуйте снова"
    );
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "🔄 Снова";
    }
  }

  function resetState(id) {
    gameOver = false;
    won = false;
    state = { t: 0 };
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
        state.options = [];
        pickReadingOptions();
        break;
      case "community":
        state.hearts = 0;
        state.target = 15;
        state.spawn = 0;
        state.items = [];
        break;
      case "hole":
        state.x = W / 2;
        state.y = H / 2;
        state.r = 22;
        state.dots = [];
        for (let i = 0; i < 24; i++) {
          state.dots.push({
            x: 30 + Math.random() * (W - 60),
            y: 30 + Math.random() * (H - 60),
            s: 4 + Math.random() * 6,
          });
        }
        state.eaten = 0;
        state.need = 18;
        break;
      case "shop":
        state.gold = 0;
        state.aura = 0;
        state.level = 1;
        state.target = 80;
        state.clicks = 0;
        break;
      case "dash":
        state.y = H * 0.6;
        state.vy = 0;
        state.ground = H * 0.72;
        state.obstacles = [];
        state.dist = 0;
        state.need = 2800;
        break;
      case "ludus":
        state.hits = 0;
        state.need = 5;
        state.bar = 0;
        state.dir = 1;
        state.zone = 0.35 + Math.random() * 0.3;
        break;
      case "war":
        state.player = 0;
        state.enemy = 0;
        state.round = 0;
        state.need = 3;
        break;
      case "bolt":
        state.screws = [0, 1, 2, 3];
        state.order = [2, 0, 3, 1];
        state.step = 0;
        break;
      case "indycat":
        state.grid = 5;
        state.cells = [];
        state.sel = null;
        state.score = 0;
        state.need = 12;
        const em = ["🐱", "🧶", "🐟", "💎", "⭐"];
        for (let i = 0; i < 25; i++) state.cells.push(em[i % 5]);
        break;
      case "blocks":
        state.grid = Array.from({ length: 10 }, () => Array(8).fill(0));
        state.piece = null;
        state.lines = 0;
        state.need = 6;
        spawnBlock();
        break;
      case "royal":
        state.board = Array.from({ length: 16 }, () => 0);
        state.score = 0;
        state.need = 512;
        state.sel = null;
        spawnRoyalTile();
        break;
      default:
        break;
    }
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
      t: 0,
    };
  }

  function spawnRoyalTile() {
    const empty = [];
    for (let i = 0; i < 16; i++) if (!state.board[i]) empty.push(i);
    if (empty.length) {
      const i = empty[(Math.random() * empty.length) | 0];
      state.board[i] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  function start(id) {
    gameId = id;
    if (titleEl) titleEl.textContent = TITLES[id] || id;
    resetState(id);
    playing = true;
    setStatus("Игра идёт · награда в ✨");
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = "…";
    }
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
  }

  function update(dt) {
    if (!playing || gameOver) return;
    state.t += dt;

    switch (gameId) {
      case "community":
        state.spawn -= dt;
        if (state.spawn <= 0) {
          state.spawn = 600 + Math.random() * 400;
          state.items.push({ x: 40 + Math.random() * (W - 80), y: -20, life: 3000 });
        }
        state.items.forEach((it) => {
          it.y += 1.2 * (dt / 16);
          it.life -= dt;
        });
        state.items = state.items.filter((it) => it.y < H + 20 && it.life > 0);
        if (state.hearts >= state.target) finish(true, state.hearts);
        break;
      case "hole":
        state.dots = state.dots.filter((d) => {
          const dist = Math.hypot(d.x - state.x, d.y - state.y);
          if (dist < state.r) {
            state.eaten++;
            state.r = Math.min(55, state.r + 0.8);
            return false;
          }
          return true;
        });
        if (state.eaten >= state.need) finish(true, state.eaten);
        break;
      case "dash":
        state.dist += dt * 0.12;
        state.vy += 0.55;
        state.y += state.vy;
        if (state.y >= state.ground) {
          state.y = state.ground;
          state.vy = 0;
        }
        if (state.t % 900 < dt) {
          state.obstacles.push({ x: W + 10, h: 28 + Math.random() * 20, w: 14 });
        }
        state.obstacles.forEach((o) => {
          o.x -= 3.5;
        });
        state.obstacles = state.obstacles.filter((o) => o.x > -30);
        const px = 48;
        const py = state.y - 16;
        for (const o of state.obstacles) {
          if (px + 20 > o.x && px < o.x + o.w && py + 28 > state.ground - o.h) {
            finish(false, Math.floor(state.dist));
            return;
          }
        }
        if (state.dist >= state.need) finish(true, Math.floor(state.dist));
        break;
      case "ludus":
        state.bar += state.dir * 0.018 * dt;
        if (state.bar >= 1 || state.bar <= 0) state.dir *= -1;
        break;
      case "blocks":
        if (!state.piece) return;
        state.piece.t += dt;
        if (state.piece.t > 420) {
          state.piece.y++;
          state.piece.t = 0;
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
          mergeBlock();
          clearLines();
          spawnBlock();
          return gy <= 0;
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
        y++;
      }
    }
  }

  function draw() {
    ctx.fillStyle = "#1a1428";
    ctx.fillRect(0, 0, W, H);

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
        ctx.fillStyle = "#fff";
        ctx.font = "16px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Выберите игру", W / 2, H / 2);
    }
  }

  function drawReading() {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(state.word || "?", W / 2, H * 0.35);
    ctx.font = "14px system-ui";
    ctx.fillStyle = "#ccc";
    ctx.fillText(`Раунд ${state.round + 1}/5 · ${state.score} ✨`, W / 2, H * 0.48);
    const opts = state.options || [];
    opts.forEach((letter, i) => {
      const bx = W / 2 - 110 + (i % 2) * 120;
      const by = H * 0.55 + Math.floor(i / 2) * 56;
      ctx.fillStyle = "#3d3560";
      ctx.fillRect(bx, by, 100, 44);
      ctx.fillStyle = "#ffd250";
      ctx.font = "bold 22px system-ui";
      ctx.fillText(letter, bx + 50, by + 30);
    });
  }

  function drawCommunity() {
    ctx.fillStyle = "#2a2040";
    ctx.fillRect(0, 0, W, H);
    ctx.font = "40px serif";
    ctx.textAlign = "center";
    ctx.fillText("👩", W / 2, H * 0.45);
    state.items.forEach((it) => {
      ctx.font = "28px serif";
      ctx.fillText("❤️", it.x, it.y);
    });
    ctx.fillStyle = "#fff";
    ctx.font = "14px system-ui";
    ctx.fillText(`${state.hearts}/${state.target} ❤️ → ✨`, W / 2, 24);
  }

  function drawHole() {
    state.dots.forEach((d) => {
      ctx.fillStyle = "#8bc34a";
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(state.x, state.y, state.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${state.eaten}/${state.need}`, W / 2, 20);
  }

  function drawShop() {
    ctx.fillStyle = "#fff3e0";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#333";
    ctx.font = "bold 16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`Магазин ур.${state.level}`, W / 2, 28);
    ctx.fillText(`💰 ${state.gold} → ${state.aura} ✨`, W / 2, 52);
    ctx.fillStyle = "#ff9800";
    ctx.fillRect(W / 2 - 60, H / 2 - 30, 120, 60);
    ctx.fillStyle = "#fff";
    ctx.fillText("ТАП", W / 2, H / 2 + 8);
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#666";
    ctx.fillText(`Цель: ${state.target} 💰`, W / 2, H - 24);
  }

  function drawDash() {
    ctx.fillStyle = "#1a237e";
    ctx.fillRect(0, 0, W, state.ground);
    ctx.fillStyle = "#3949ab";
    ctx.fillRect(0, state.ground, W, H - state.ground);
    ctx.fillStyle = "#ffeb3b";
    ctx.fillRect(48, state.y - 16, 24, 24);
    ctx.fillStyle = "#e53935";
    state.obstacles.forEach((o) => {
      ctx.fillRect(o.x, state.ground - o.h, o.w, o.h);
    });
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`${Math.floor(state.dist)}/${state.need}`, 8, 18);
  }

  function drawLudus() {
    ctx.fillStyle = "#4a148c";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#333";
    ctx.fillRect(40, H * 0.4, W - 80, 24);
    const z0 = 40 + (W - 80) * state.zone;
    const zw = (W - 80) * 0.12;
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(z0, H * 0.4, zw, 24);
    ctx.fillStyle = "#ffd250";
    ctx.fillRect(40 + (W - 80) * state.bar - 6, H * 0.38, 12, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`Удары ${state.hits}/${state.need}`, W / 2, 30);
    ctx.fillText("Тап в зелёной зоне", W / 2, H - 20);
  }

  function drawWar() {
    ctx.fillStyle = "#3e2723";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`Вы: ${state.player}  Враг: ${state.enemy}`, W / 2, H * 0.35);
    ctx.fillText(`Раунд ${state.round}`, W / 2, H * 0.45);
    ctx.fillStyle = "#ffd250";
    ctx.fillRect(W / 2 - 50, H * 0.55, 100, 44);
    ctx.fillStyle = "#333";
    ctx.fillText("🎲 Бросок", W / 2, H * 0.55 + 28);
  }

  function drawBolt() {
    ctx.fillStyle = "#37474f";
    ctx.fillRect(0, 0, W, H);
    const positions = [
      [W * 0.3, H * 0.35],
      [W * 0.7, H * 0.35],
      [W * 0.3, H * 0.65],
      [W * 0.7, H * 0.65],
    ];
    positions.forEach((p, i) => {
      ctx.fillStyle = state.step > state.order.indexOf(i) ? "#666" : "#ffc107";
      ctx.beginPath();
      ctx.arc(p[0], p[1], 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#333";
      ctx.font = "20px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("🔩", p[0], p[1] + 8);
    });
    ctx.fillStyle = "#fff";
    ctx.font = "13px system-ui";
    ctx.fillText(`Шаг ${state.step + 1}/4`, W / 2, 24);
  }

  function drawIndycat() {
    const cs = W / 5;
    for (let i = 0; i < 25; i++) {
      const x = (i % 5) * cs;
      const y = Math.floor(i / 5) * cs;
      ctx.fillStyle = (i === state.sel ? "#ffd250" : "#2a2040");
      ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      ctx.font = `${cs * 0.45}px serif`;
      ctx.textAlign = "center";
      ctx.fillText(state.cells[i], x + cs / 2, y + cs * 0.65);
    }
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui";
    ctx.fillText(`${state.score}/${state.need} ✨`, W / 2, H - 8);
  }

  function drawBlocks() {
    const cw = W / 8;
    const ch = H / 10;
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
      const p = state.piece;
      p.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
          if (cell) {
            ctx.fillRect((p.x + dx) * cw + 1, (p.y + dy) * ch + 1, cw - 2, ch - 2);
          }
        });
      });
    }
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`Линии ${state.lines}/${state.need}`, W / 2, H - 6);
  }

  function drawRoyal() {
    const cs = W / 4;
    for (let i = 0; i < 16; i++) {
      const v = state.board[i];
      const x = (i % 4) * cs;
      const y = Math.floor(i / 4) * cs;
      ctx.fillStyle = v ? (v >= 128 ? "#ffd250" : "#5c6bc0") : "#2a2040";
      ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
      if (v) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(String(v), x + cs / 2, y + cs / 2 + 6);
      }
    }
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui";
    ctx.fillText(`Макс ${Math.max(0, ...state.board)} / ${state.need}`, W / 2, H - 6);
  }

  function onTap(cx, cy) {
    if (!playing || gameOver) return;

    switch (gameId) {
      case "reading": {
        const opts = state.options || [];
        opts.forEach((letter, i) => {
          const bx = W / 2 - 110 + (i % 2) * 120;
          const by = H * 0.55 + Math.floor(i / 2) * 56;
          if (cx >= bx && cx <= bx + 100 && cy >= by && cy <= by + 44) {
            const w = state.words[state.round];
            if (letter === w[1]) {
              state.score++;
              state.round++;
              if (state.round >= state.words.length) finish(true, state.score);
              else pickReadingOptions();
            } else finish(false, state.score);
          }
        });
        break;
      }
      case "community":
        state.items.forEach((it) => {
          if (Math.hypot(cx - it.x, cy - it.y) < 36) {
            state.hearts++;
            it.life = 0;
            if (typeof burstParticles === "function") burstParticles(4);
          }
        });
        break;
      case "hole":
        state.x = cx;
        state.y = cy;
        break;
      case "shop":
        if (cy > H / 2 - 30 && cy < H / 2 + 30) {
          state.gold += state.level;
          state.clicks++;
          if (state.gold >= state.target) {
            state.aura += AuraEconomy.rewardForKind("shop");
            state.level++;
            state.target += 40;
            if (state.level > 4) finish(true, state.aura);
          }
        }
        break;
      case "dash":
        if (state.y >= state.ground - 1) state.vy = -9.5;
        break;
      case "ludus": {
        const inZone = state.bar >= state.zone && state.bar <= state.zone + 0.12;
        if (inZone) {
          state.hits++;
          state.zone = 0.25 + Math.random() * 0.55;
          if (state.hits >= state.need) finish(true, state.hits);
        } else finish(false, state.hits);
        break;
      }
      case "war":
        if (cy > H * 0.5) {
          const pr = 1 + ((Math.random() * 6) | 0);
          const er = 1 + ((Math.random() * 6) | 0);
          state.player += pr;
          state.enemy += er;
          state.round++;
          setStatus(`Вы +${pr} · враг +${er}`);
          if (state.player >= state.need * 3 || state.enemy >= state.need * 3) {
            finish(state.player > state.enemy, state.player);
          }
        }
        break;
      case "bolt": {
        const positions = [
          [W * 0.3, H * 0.35],
          [W * 0.7, H * 0.35],
          [W * 0.3, H * 0.65],
          [W * 0.7, H * 0.65],
        ];
        positions.forEach((p, i) => {
          if (Math.hypot(cx - p[0], cy - p[1]) < 32) {
            if (i === state.order[state.step]) {
              state.step++;
              if (state.step >= 4) finish(true, 4);
            } else finish(false, state.step);
          }
        });
        break;
      }
      case "indycat": {
        const cs = W / 5;
        const idx = Math.floor(cy / cs) * 5 + Math.floor(cx / cs);
        if (idx < 0 || idx >= 25) break;
        if (state.sel == null) state.sel = idx;
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
        if (state.piece) {
          state.piece.x += cx < W / 2 ? -1 : 1;
          state.piece.x = Math.max(0, Math.min(7, state.piece.x));
          if (cy < H / 2) {
            const rot = state.piece.shape[0].map((_, i) =>
              state.piece.shape.map((row) => row[i]).reverse()
            );
            state.piece.shape = rot;
          }
        }
        break;
      case "royal": {
        const cs = W / 4;
        const idx = Math.floor(cy / cs) * 4 + Math.floor(cx / cs);
        if (state.sel == null) state.sel = idx;
        else if (idx === state.sel) state.sel = null;
        else {
          const dirs = [
            [1, -1],
            [1, 1],
            [-1, -1],
            [-1, 1],
          ];
          for (const [dx, dy] of dirs) {
            let i = state.sel;
            let v = state.board[i];
            while (true) {
              const nx = (i % 4) + dx;
              const ny = Math.floor(i / 4) + dy;
              if (nx < 0 || nx > 3 || ny < 0 || ny > 3) break;
              i = ny * 4 + nx;
              if (state.board[i] && state.board[i] === v) {
                state.board[i] *= 2;
                state.board[state.sel] = 0;
                state.score = Math.max(state.score, state.board[i]);
                spawnRoyalTile();
                if (state.score >= state.need) finish(true, state.score);
                break;
              }
              if (!state.board[i]) continue;
              break;
            }
          }
          state.sel = null;
        }
        break;
      }
      default:
        break;
    }
  }

  let last = 0;
  function loop(ts) {
    if (window.activeTab !== gameId && document.getElementById("minigame")?.classList.contains("active")) {
      /* keep running */
    }
    const dt = last ? ts - last : 16;
    last = ts;
    if (document.getElementById("minigame")?.classList.contains("active")) {
      update(dt);
      draw();
    }
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    onTap(e.clientX - r.left, e.clientY - r.top);
  });
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      onTap(t.clientX - r.left, t.clientY - r.top);
    },
    { passive: false }
  );

  canvas.addEventListener("pointermove", (e) => {
    if (!playing || gameId !== "hole") return;
    const r = canvas.getBoundingClientRect();
    state.x = e.clientX - r.left;
    state.y = e.clientY - r.top;
  });

  startBtn?.addEventListener("click", () => {
    if (gameId) start(gameId);
  });

  setupCanvas();
  window.addEventListener("resize", setupCanvas);
  requestAnimationFrame(loop);

  window.MiniGames = {
    show(id) {
      gameId = id;
      if (titleEl) titleEl.textContent = TITLES[id] || id;
      resetState(id);
      draw();
      return true;
    },
    start,
    stop,
  };
})();
