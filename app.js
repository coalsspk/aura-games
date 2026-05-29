/* Aura Games — Telegram Mini App (оптимизация + графика) */
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  const bg = tg.themeParams.bg_color || "#0a0618";
  document.body.style.backgroundColor = bg;
}

const SYM = ["🍒", "🔔", "7️⃣", "💎", "⭐"];
const GEM_DEFS = [
  { emoji: "💎", color: "#5ec8ff", glow: "#2a88dd" },
  { emoji: "🔮", color: "#c878ff", glow: "#8844cc" },
  { emoji: "⭐", color: "#ffd250", glow: "#cc9900" },
  { emoji: "🌙", color: "#a8b8ff", glow: "#6677cc" },
  { emoji: "✨", color: "#fff8c0", glow: "#ddcc66" },
  { emoji: "🔴", color: "#ff6a6a", glow: "#cc3333" },
  { emoji: "🟢", color: "#6aff8a", glow: "#33aa55" },
  { emoji: "🟣", color: "#d070ff", glow: "#9933cc" },
  { emoji: "🧡", color: "#ffaa55", glow: "#dd7722" },
];

const SLOTS_MAX = 6;
const SNAKE_WIN = 6;
const SNAKE_MAX_STEPS = 42;
const CRYSTALS_WIN = 20;
const CRYSTALS_MAX_SWAPS = 12;

let lastResult = null;
let activeTab = "snake";
let slotsSpins = 0;
let slotsBusy = false;

// --- UI helpers ---
function setResult(game, won, score, extra = {}) {
  lastResult = { game, won, score, ...extra };
  const btn = document.getElementById("sendResult");
  btn.disabled = false;
  btn.textContent = won
    ? `✨ Отправить победу (${game})`
    : `Завершить партию (${game})`;
  if (won) burstParticles(24);
}

function setProgress(id, value, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.min(100, (value / max) * 100)}%`;
}

function burstParticles(count) {
  const root = document.getElementById("particles");
  if (!root) return;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const ang = (Math.PI * 2 * i) / count + Math.random();
    const dist = 60 + Math.random() * 120;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.setProperty("--tx", `${Math.cos(ang) * dist}px`);
    p.style.setProperty("--ty", `${Math.sin(ang) * dist}px`);
    p.style.background = i % 2 ? "#ffd250" : "#b88ae8";
    root.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }
}

document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    document.getElementById(activeTab).classList.add("active");
  });
});

document.getElementById("sendResult").addEventListener("click", () => {
  if (!lastResult || !tg) return;
  tg.sendData(JSON.stringify(lastResult));
  tg.close();
});

// --- Canvas setup (retina + resize) ---
function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.min(320, Math.floor(window.innerWidth * 0.92));
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.width = Math.floor(size * dpr);
  canvas.height = Math.floor(size * dpr);
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, size, dpr };
}

// --- Snake ---
(function initSnake() {
  const canvas = document.getElementById("snakeCanvas");
  const { ctx, size } = setupCanvas(canvas);
  const W = 8;
  const cell = size / W;
  let dir = [0, 1];
  let nextDir = [0, 1];
  let body = [
    [3, 3],
    [3, 2],
    [3, 1],
  ];
  let food = [6, 5];
  let score = 0;
  let alive = true;
  let steps = 0;
  let lastTick = 0;
  const TICK_MS = 220;
  const particles = [];

  function randFood() {
    do {
      food = [Math.floor(Math.random() * W), Math.floor(Math.random() * W)];
    } while (body.some((p) => p[0] === food[0] && p[1] === food[1]));
  }

  function drawGrid() {
    ctx.fillStyle = "#120a22";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(100, 70, 160, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= W; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }
  }

  function drawFood(t) {
    const cx = food[0] * cell + cell / 2;
    const cy = food[1] * cell + cell / 2;
    const pulse = 0.85 + Math.sin(t * 0.008) * 0.15;
    const r = (cell * 0.32) * pulse;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
    g.addColorStop(0, "#fff8b0");
    g.addColorStop(0.4, "#ffd250");
    g.addColorStop(1, "rgba(255, 150, 50, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${cell * 0.55}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✨", cx, cy + 1);
  }

  function drawSnake() {
    body.forEach((p, i) => {
      const x = p[0] * cell;
      const y = p[1] * cell;
      const pad = i === 0 ? 2 : 4;
      const r = 8;
      const grd = ctx.createLinearGradient(x, y, x + cell, y + cell);
      if (i === 0) {
        grd.addColorStop(0, "#7dffb0");
        grd.addColorStop(1, "#3cb86a");
      } else {
        grd.addColorStop(0, "#5ee88a");
        grd.addColorStop(1, "#2d8a50");
      }
      ctx.fillStyle = grd;
      roundRect(ctx, x + pad, y + pad, cell - pad * 2, cell - pad * 2, r);
      ctx.fill();
      if (i === 0) {
        ctx.fillStyle = "#1a4030";
        const ex = x + cell * 0.65;
        const ey = y + cell * 0.35;
        ctx.beginPath();
        ctx.arc(ex, ey, cell * 0.08, 0, Math.PI * 2);
        ctx.arc(ex + cell * 0.12, ey, cell * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function spawnEatParticles() {
    const cx = food[0] * cell + cell / 2;
    const cy = food[1] * cell + cell / 2;
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        r: 2 + Math.random() * 3,
        life: 1,
        color: Math.random() > 0.5 ? "#ffd250" : "#9fffb8",
      });
    }
  }

  function endGame(won) {
    alive = false;
    const st = document.getElementById("snakeStatus");
    if (st) {
      st.textContent = won ? "🎉 Победа!" : "Партия окончена";
      st.classList.toggle("win", won);
    }
    setResult("snake", won, score);
  }

  function tick() {
    if (!alive || activeTab !== "snake") return;
    dir = nextDir;
    steps++;
    const nx = body[0][0] + dir[0];
    const ny = body[0][1] + dir[1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= W || body.some((p) => p[0] === nx && p[1] === ny)) {
      endGame(score >= SNAKE_WIN);
      return;
    }
    body.unshift([nx, ny]);
    if (nx === food[0] && ny === food[1]) {
      score++;
      spawnEatParticles();
      document.getElementById("snakeScore").textContent = `${score} / ${SNAKE_WIN} ✨`;
      setProgress("snakeProgress", score, SNAKE_WIN);
      randFood();
      if (score >= SNAKE_WIN) {
        endGame(true);
        return;
      }
    } else body.pop();
    if (steps >= SNAKE_MAX_STEPS) endGame(false);
  }

  function loop(t) {
    drawGrid();
    drawFood(t);
    drawSnake();
    drawParticles();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      p.vy += 0.05;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (alive && activeTab === "snake" && t - lastTick >= TICK_MS) {
      lastTick = t;
      tick();
    }
    requestAnimationFrame(loop);
  }

  function setDirection(dx, dy) {
    if (!alive) return;
    if (dx === -dir[0] && dy === -dir[1]) return;
    nextDir = [dx, dy];
  }

  document.addEventListener("keydown", (e) => {
    if (activeTab !== "snake") return;
    const k = e.key;
    if (k === "ArrowUp") setDirection(0, -1);
    if (k === "ArrowDown") setDirection(0, 1);
    if (k === "ArrowLeft") setDirection(-1, 0);
    if (k === "ArrowRight") setDirection(1, 0);
  });

  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => { touchStart = e.touches[0]; }, { passive: true });
  canvas.addEventListener(
    "touchend",
    (e) => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.clientX;
      const dy = t.clientY - touchStart.clientY;
      if (Math.abs(dx) > 24 || Math.abs(dy) > 24) {
        if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
        else setDirection(0, dy > 0 ? 1 : -1);
      }
      touchStart = null;
    },
    { passive: true }
  );

  window.addEventListener("resize", () => setupCanvas(canvas));
  requestAnimationFrame(loop);
})();

// --- Crystals (6×6, match-3 с удалением и каскадом) ---
(function initCrystals() {
  const canvas = document.getElementById("crystalsCanvas");
  let { ctx, size } = setupCanvas(canvas);
  const N = 6;
  let cell = size / N;
  let grid = [];
  let pick = null;
  let score = 0;
  let swaps = 0;
  let flashCells = [];
  let popCells = new Map();
  let floatText = null;
  let statusMsg = "";
  let statusUntil = 0;
  let animating = false;
  let shakeUntil = 0;

  function gemIndex(emoji) {
    return GEM_DEFS.findIndex((g) => g.emoji === emoji);
  }

  function randomGem() {
    return GEM_DEFS[Math.floor(Math.random() * GEM_DEFS.length)].emoji;
  }

  function findMatched() {
    const matched = new Set();
    for (let y = 0; y < N; y++) {
      let run = 1;
      for (let x = 1; x <= N; x++) {
        const same =
          x < N && grid[y][x] && grid[y][x] === grid[y][x - 1];
        if (same) run++;
        else {
          if (run >= 3) {
            for (let i = 0; i < run; i++) matched.add(`${x - 1 - i},${y}`);
          }
          run = 1;
        }
      }
    }
    for (let x = 0; x < N; x++) {
      let run = 1;
      for (let y = 1; y <= N; y++) {
        const same =
          y < N && grid[y][x] && grid[y][x] === grid[y - 1][x];
        if (same) run++;
        else {
          if (run >= 3) {
            for (let i = 0; i < run; i++) matched.add(`${x},${y - 1 - i}`);
          }
          run = 1;
        }
      }
    }
    return matched;
  }

  function initGrid() {
    do {
      grid = Array.from({ length: N }, () =>
        Array.from({ length: N }, () => randomGem())
      );
    } while (findMatched().size > 0);
  }
  initGrid();

  function swapCells(x1, y1, x2, y2) {
    const t = grid[y1][x1];
    grid[y1][x1] = grid[y2][x2];
    grid[y2][x2] = t;
  }

  function collapseColumn(x) {
    const col = [];
    for (let y = N - 1; y >= 0; y--) {
      if (grid[y][x]) col.push(grid[y][x]);
    }
    while (col.length < N) col.push(randomGem());
    for (let y = N - 1, i = 0; y >= 0; y--, i++) grid[y][x] = col[i];
  }

  function removeMatched(matched) {
    matched.forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      grid[y][x] = null;
      popCells.set(key, performance.now());
    });
    for (let x = 0; x < N; x++) collapseColumn(x);
  }

  function resolveAllMatches() {
    let total = 0;
    let matched = findMatched();
    while (matched.size > 0) {
      total += matched.size;
      flashCells = [...matched].map((s) => {
        const [a, b] = s.split(",").map(Number);
        return { x: a, y: b };
      });
      removeMatched(matched);
      matched = findMatched();
    }
    return total;
  }

  function setStatus(text, ms = 1200) {
    statusMsg = text;
    statusUntil = performance.now() + ms;
    const st = document.getElementById("crystalsStatus");
    if (st) st.textContent = text;
  }

  function drawGem(cx, cy, emoji, scale, glow) {
    const idx = gemIndex(emoji);
    const def = GEM_DEFS[idx >= 0 ? idx : 0];
    const r = cell * 0.26 * scale;
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 1.8);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, def.color);
    g.addColorStop(1, def.glow);
    ctx.fillStyle = g;
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = glow ? 12 : 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = `${cell * 0.38 * scale}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, cx, cy + 1);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function draw() {
    cell = size / N;
    const t = performance.now();
    const shake =
      shakeUntil > t ? Math.sin(t * 0.08) * 4 * (shakeUntil - t) / 300 : 0;
    ctx.save();
    ctx.translate(shake, 0);
    ctx.fillStyle = "#100820";
    ctx.fillRect(0, 0, size, size);
    const pad = Math.max(2, cell * 0.06);
    const radius = Math.max(4, cell * 0.12);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const gem = grid[y][x];
        if (!gem) continue;
        const px = x * cell;
        const py = y * cell;
        const sel = pick && pick[0] === x && pick[1] === y;
        const flash = flashCells.some((c) => c.x === x && c.y === y);
        const popT = popCells.get(`${x},${y}`);
        let scale = sel ? 0.92 + Math.sin(t * 0.012) * 0.08 : 1;
        if (popT) {
          const p = Math.min(1, (t - popT) / 220);
          scale *= 1 + p * 0.35;
          if (p >= 1) popCells.delete(`${x},${y}`);
        }
        ctx.fillStyle = flash
          ? "rgba(255, 220, 100, 0.55)"
          : sel
            ? "rgba(120, 80, 200, 0.55)"
            : "rgba(40, 28, 72, 0.92)";
        roundRect(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, radius);
        ctx.fill();
        if (sel) {
          ctx.strokeStyle = "#ffd250";
          ctx.lineWidth = 2;
          roundRect(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, radius);
          ctx.stroke();
        }
        drawGem(px + cell / 2, py + cell / 2, gem, scale, sel || flash);
      }
    }
    if (floatText && floatText.until > t) {
      const a = 1 - (t - floatText.start) / 900;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = "#ffe566";
      ctx.font = `bold ${Math.round(cell * 0.55)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        floatText.text,
        floatText.x,
        floatText.y - (t - floatText.start) * 0.04
      );
      ctx.globalAlpha = 1;
    } else if (floatText) floatText = null;
    ctx.restore();
  }

  function updateHud() {
    document.getElementById("crystalsScore").textContent = `${score} / ${CRYSTALS_WIN}`;
    setProgress("crystalsProgress", score, CRYSTALS_WIN);
    if (performance.now() > statusUntil && !animating) {
      const st = document.getElementById("crystalsStatus");
      if (st && st.textContent !== "🎉 Победа!" && st.textContent !== "Партия окончена") {
        st.textContent = "Тап: две соседние клетки";
      }
    }
  }

  function endGame(won) {
    const st = document.getElementById("crystalsStatus");
    if (st) {
      st.textContent = won ? "🎉 Победа!" : "Партия окончена";
      st.classList.toggle("win", won);
    }
    setResult("crystals", won, score);
  }

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    const x = Math.min(N - 1, Math.max(0, Math.floor(cx * N)));
    const y = Math.min(N - 1, Math.max(0, Math.floor(cy * N)));
    return [x, y];
  }

  function onCellTap(x, y) {
    if (animating || swaps >= CRYSTALS_MAX_SWAPS || activeTab !== "crystals") return;
    if (!pick) {
      pick = [x, y];
      return;
    }
    const [x0, y0] = pick;
    if (x === x0 && y === y0) {
      pick = null;
      return;
    }
    if (Math.abs(x - x0) + Math.abs(y - y0) !== 1) {
      pick = [x, y];
      return;
    }
    animating = true;
    pick = null;
    swapCells(x, y, x0, y0);
    const gained = resolveAllMatches();
    if (gained === 0) {
      swapCells(x, y, x0, y0);
      shakeUntil = performance.now() + 300;
      setStatus("Нет совпадения — попробуйте другой обмен");
      animating = false;
      return;
    }
    swaps++;
    score += gained;
    floatText = {
      text: `+${gained}`,
      x: size / 2,
      y: size / 2,
      start: performance.now(),
      until: performance.now() + 900,
    };
    burstParticles(Math.min(24, 8 + gained));
    setStatus(`Серия! +${gained} очков`);
    setTimeout(() => {
      flashCells = [];
      popCells.clear();
      animating = false;
      if (score >= CRYSTALS_WIN) endGame(true);
      else if (swaps >= CRYSTALS_MAX_SWAPS) endGame(false);
    }, 320);
  }

  canvas.addEventListener("click", (e) => {
    const [x, y] = cellFromEvent(e);
    onCellTap(x, y);
  });
  canvas.addEventListener(
    "touchend",
    (e) => {
      if (activeTab !== "crystals") return;
      e.preventDefault();
      const t = e.changedTouches[0];
      const [x, y] = cellFromEvent(t);
      onCellTap(x, y);
    },
    { passive: false }
  );

  function loop() {
    if (activeTab === "crystals") {
      draw();
      updateHud();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", () => {
    ({ ctx, size } = setupCanvas(canvas));
  });
  requestAnimationFrame(loop);
})();

// --- Slots ---
function getReelEls() {
  return [...document.querySelectorAll(".reel-wrap")];
}

document.getElementById("spinBtn").addEventListener("click", () => {
  if (slotsSpins >= SLOTS_MAX || slotsBusy) return;
  slotsBusy = true;
  const btn = document.getElementById("spinBtn");
  btn.disabled = true;
  const wraps = getReelEls();
  const reels = wraps.map((w) => w.querySelector(".reel"));
  reels.forEach((r) => r.classList.add("spinning"));

  const spinDuration = 1200 + Math.random() * 400;
  const interval = setInterval(() => {
    reels.forEach((r) => {
      const cell = r.querySelector(".reel-cell") || r;
      cell.textContent = SYM[Math.floor(Math.random() * SYM.length)];
    });
  }, 70);

  setTimeout(() => {
    clearInterval(interval);
    reels.forEach((r) => r.classList.remove("spinning"));
    slotsSpins++;
    const final = [0, 1, 2].map(() => SYM[Math.floor(Math.random() * SYM.length)]);
    reels.forEach((r, i) => {
      const cell = r.querySelector(".reel-cell") || r;
      cell.textContent = final[i];
    });

    const msg = document.getElementById("slotsMsg");
    const all = final[0] === final[1] && final[1] === final[2];
    const two =
      final[0] === final[1] || final[1] === final[2] || final[0] === final[2];

    wraps.forEach((w) => w.classList.remove("jackpot"));
    if (all) {
      wraps.forEach((w) => w.classList.add("jackpot"));
      msg.textContent = "🎉 ДЖЕКПОТ!";
      setResult("casino", true, 22, { kind: "casino_jackpot" });
    } else if (two) {
      msg.textContent = "✨ Два символа — приз!";
      setResult("casino", true, 5, { kind: "casino" });
    } else if (slotsSpins >= SLOTS_MAX) {
      msg.textContent = "Партия окончена";
      setResult("casino", false, 0);
    } else {
      msg.textContent = `Вращение ${slotsSpins} / ${SLOTS_MAX}`;
    }

    btn.disabled = slotsSpins >= SLOTS_MAX;
    slotsBusy = false;
  }, spinDuration);
});
