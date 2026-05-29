/* Telegram Mini App — визуальные игры Aura (результат → бот). */
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  document.body.style.backgroundColor = tg.themeParams.bg_color || "#120c24";
}

const SYM = ["🍒", "🔔", "7️⃣", "💎", "⭐"];
const GEMS = ["💎", "🔮", "⭐", "🌙", "✨"];

let lastResult = null;
let snake = null;
let crystals = null;
let slotsSpins = 0;
const SLOTS_MAX = 6;

// --- Tabs ---
document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

function setResult(game, won, score, extra = {}) {
  lastResult = { game, won, score, ...extra };
  const btn = document.getElementById("sendResult");
  btn.disabled = false;
  btn.textContent = won
    ? `✨ Отправить победу (${game})`
    : `Завершить партию (${game})`;
}

document.getElementById("sendResult").addEventListener("click", () => {
  if (!lastResult || !tg) return;
  tg.sendData(JSON.stringify(lastResult));
  tg.close();
});

// --- Snake ---
(function initSnake() {
  const canvas = document.getElementById("snakeCanvas");
  const ctx = canvas.getContext("2d");
  const W = 6;
  const cell = canvas.width / W;
  let dir = [0, 1];
  let body = [
    [2, 2],
    [2, 1],
    [2, 0],
  ];
  let food = [4, 4];
  let score = 0;
  let alive = true;
  let steps = 0;
  const MAX = 42;

  function draw() {
    ctx.fillStyle = "#1a1230";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffc83c";
    ctx.fillRect(food[0] * cell + 4, food[1] * cell + 4, cell - 8, cell - 8);
    body.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? "#78dc8c" : "#46a064";
      ctx.fillRect(p[0] * cell + 2, p[1] * cell + 2, cell - 4, cell - 4);
    });
  }

  function tick() {
    if (!alive) return;
    steps++;
    const nx = body[0][0] + dir[0];
    const ny = body[0][1] + dir[1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= W || body.some((p) => p[0] === nx && p[1] === ny)) {
      alive = false;
      setResult("snake", score >= 6, score);
      return;
    }
    body.unshift([nx, ny]);
    if (nx === food[0] && ny === food[1]) {
      score++;
      document.getElementById("snakeScore").textContent = `${score} / 6`;
      do {
        food = [Math.floor(Math.random() * W), Math.floor(Math.random() * W)];
      } while (body.some((p) => p[0] === food[0] && p[1] === food[1]));
      if (score >= 6) {
        alive = false;
        setResult("snake", true, score);
      }
    } else body.pop();
    if (steps >= MAX) {
      alive = false;
      setResult("snake", false, score);
    }
    draw();
  }

  function setDirection(dx, dy) {
    if (!alive) return;
    if (dx === -dir[0] && dy === -dir[1]) return;
    dir = [dx, dy];
  }

  document.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowUp") setDirection(0, -1);
    if (k === "ArrowDown") setDirection(0, 1);
    if (k === "ArrowLeft") setDirection(-1, 0);
    if (k === "ArrowRight") setDirection(1, 0);
  });

  let touchStart = null;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      touchStart = e.touches[0];
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchend",
    (e) => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.clientX;
      const dy = t.clientY - touchStart.clientY;
      if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
      else setDirection(0, dy > 0 ? 1 : -1);
      touchStart = null;
    },
    { passive: true }
  );

  draw();
  setInterval(tick, 280);
})();

// --- Crystals ---
(function initCrystals() {
  const canvas = document.getElementById("crystalsCanvas");
  const ctx = canvas.getContext("2d");
  const N = 4;
  const cell = canvas.width / N;
  let grid = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => GEMS[Math.floor(Math.random() * GEMS.length)])
  );
  let pick = null;
  let score = 0;
  let swaps = 0;
  const MAX_SWAPS = 12;

  function draw() {
    ctx.fillStyle = "#1a1230";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const sel = pick && pick[0] === x && pick[1] === y;
        ctx.fillStyle = sel ? "#6b3fa0" : "#2a2048";
        ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
        ctx.font = "28px serif";
        ctx.textAlign = "center";
        ctx.fillText(grid[y][x], x * cell + cell / 2, y * cell + cell / 2 + 10);
      }
    }
    document.getElementById("crystalsScore").textContent = `${score} / 20`;
  }

  function matches() {
    let pts = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N - 2; x++) {
        if (grid[y][x] === grid[y][x + 1] && grid[y][x] === grid[y][x + 2]) pts += 3;
      }
    }
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N - 2; y++) {
        if (grid[y][x] === grid[y + 1][x] && grid[y][x] === grid[y + 2][x]) pts += 3;
      }
    }
    return pts;
  }

  canvas.addEventListener("click", (e) => {
    if (swaps >= MAX_SWAPS) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * N);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * N);
    if (!pick) {
      pick = [x, y];
      draw();
      return;
    }
    const [x0, y0] = pick;
    if (Math.abs(x - x0) + Math.abs(y - y0) !== 1) {
      pick = [x, y];
      draw();
      return;
    }
    const t = grid[y][x];
    grid[y][x] = grid[y0][x0];
    grid[y0][x0] = t;
    pick = null;
    swaps++;
    score += matches();
    draw();
    if (score >= 20) setResult("crystals", true, score);
    else if (swaps >= MAX_SWAPS) setResult("crystals", false, score);
  });

  draw();
})();

// --- Slots ---
document.getElementById("spinBtn").addEventListener("click", () => {
  if (slotsSpins >= SLOTS_MAX) return;
  slotsSpins++;
  const reels = [0, 1, 2].map(() => SYM[Math.floor(Math.random() * SYM.length)]);
  document.querySelectorAll(".reel").forEach((el, i) => {
    el.textContent = reels[i];
  });
  const msg = document.getElementById("slotsMsg");
  const all = reels[0] === reels[1] && reels[1] === reels[2];
  const two =
    reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
  if (all) {
    msg.textContent = "🎉 Джекпот!";
    setResult("casino", true, 22, { kind: "casino_jackpot" });
  } else if (two) {
    msg.textContent = "✨ Два символа!";
    setResult("casino", true, 5, { kind: "casino" });
  } else if (slotsSpins >= SLOTS_MAX) {
    msg.textContent = "Партия окончена";
    setResult("casino", false, 0);
  } else {
    msg.textContent = `Вращение ${slotsSpins}/${SLOTS_MAX}`;
  }
});
