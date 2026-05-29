/* Марино — платформер в духе Mario, награда: 1 ✨ за 100 🪙 */
(function initMario() {
  const canvas = document.getElementById("marioCanvas");
  const frame = document.getElementById("marioFrame");
  const startBtn = document.getElementById("marioStartBtn");
  if (!canvas) return;

  const TILE = 16;
  const GRAVITY = 0.55;
  const JUMP_V = -9.2;
  const MOVE_SPEED = 3.2;
  const MAX_FALL = 11;
  const STOMP_BOUNCE = -7;

  let dpr = 1;
  let viewW = 320;
  let viewH = 240;
  let ctx;
  let level;
  let player;
  let cameraX = 0;
  let coinsCollected = 0;
  let lives = 3;
  let playing = false;
  let gameOver = false;
  let wonFlag = false;
  let lastStartAt = 0;
  const keys = { left: false, right: false, jump: false };

  function setupMarioCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = Math.min(360, Math.floor(window.innerWidth * 0.96));
    viewH = Math.floor(viewW * 0.72);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildLevel() {
    const TW = 96;
    const TH = 13;
    const tiles = Array.from({ length: TH }, () => new Uint8Array(TW));
    for (let x = 0; x < TW; x++) {
      tiles[TH - 1][x] = 1;
      tiles[TH - 2][x] = 1;
    }
    const addPlatform = (x, y, len, brick = false) => {
      const t = brick ? 2 : 1;
      for (let i = 0; i < len; i++) {
        if (x + i >= 0 && x + i < TW && y >= 0 && y < TH) tiles[y][x + i] = t;
      }
    };
    addPlatform(8, TH - 4, 4);
    addPlatform(16, TH - 5, 3, true);
    addPlatform(24, TH - 4, 5);
    addPlatform(34, TH - 6, 4, true);
    addPlatform(42, TH - 4, 3);
    addPlatform(50, TH - 5, 6);
    addPlatform(60, TH - 7, 4, true);
    addPlatform(68, TH - 5, 5);
    addPlatform(78, TH - 4, 4);
    addPlatform(86, TH - 6, 6, true);

    const coins = [];
    const placeCoins = (x, y, n) => {
      for (let i = 0; i < n; i++) {
        coins.push({ x: (x + i) * TILE + TILE / 2, y: y * TILE + TILE / 2, taken: false });
      }
    };
    for (let x = 6; x < TW - 8; x += 5) {
      const row = TH - 4 - ((x * 3) % 4);
      placeCoins(x, row, 2);
    }
    placeCoins(16, TH - 7, 3);
    placeCoins(34, TH - 8, 2);
    placeCoins(60, TH - 9, 3);
    placeCoins(78, TH - 6, 4);

    const enemies = [
      { x: 22 * TILE, y: (TH - 3) * TILE - 14, w: 14, h: 14, vx: -1.2, min: 20 * TILE, max: 26 * TILE, dead: false },
      { x: 45 * TILE, y: (TH - 3) * TILE - 14, w: 14, h: 14, vx: -1.4, min: 42 * TILE, max: 48 * TILE, dead: false },
      { x: 70 * TILE, y: (TH - 3) * TILE - 14, w: 14, h: 14, vx: 1.3, min: 66 * TILE, max: 74 * TILE, dead: false },
    ];

    const flagX = (TW - 4) * TILE;
    const spawnX = 3 * TILE;
    const spawnY = (TH - 4) * TILE - 18;

    return { tiles, TW, TH, coins, enemies, flagX, spawnX, spawnY };
  }

  function tileAt(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || ty >= level.TH || tx >= level.TW) return 0;
    return level.tiles[ty][tx];
  }

  function solidAt(px, py) {
    const t = tileAt(px, py);
    return t === 1 || t === 2;
  }

  function resetPlayer() {
    player = {
      x: level.spawnX,
      y: level.spawnY,
      w: 13,
      h: 17,
      vx: 0,
      vy: 0,
      grounded: false,
      face: 1,
      invuln: 0,
    };
    cameraX = Math.max(0, player.x - viewW * 0.35);
  }

  function updateHud() {
    const aura = Math.floor(coinsCollected / 100);
    const el = document.getElementById("marioCoins");
    const auraEl = document.getElementById("marioAura");
    const livesEl = document.getElementById("marioLives");
    if (el) el.textContent = `${coinsCollected} 🪙`;
    if (auraEl) auraEl.textContent = `${aura} ✨`;
    if (livesEl) livesEl.textContent = "❤️".repeat(Math.max(0, lives));
    setProgress("marioProgress", coinsCollected % 100, 100);
  }

  function startGame(e) {
    const now = Date.now();
    if (now - lastStartAt < 400) return;
    if (playing && !gameOver) return;
    lastStartAt = now;
    if (e?.cancelable) e.preventDefault();
    if (e) e.stopPropagation();

    level = buildLevel();
    coinsCollected = 0;
    lives = 3;
    gameOver = false;
    wonFlag = false;
    playing = true;
    resetPlayer();
    frame?.classList.add("mario-running");
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = "Игра идёт…";
    }
    const st = document.getElementById("marioStatus");
    if (st) {
      st.textContent = "◀ ▶ — ходьба · ⬆ — прыжок";
      st.classList.remove("win");
    }
    updateHud();
  }

  function endGame(won) {
    playing = false;
    gameOver = true;
    wonFlag = won;
    frame?.classList.remove("mario-running");
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "🔄 Снова";
    }
    const st = document.getElementById("marioStatus");
    if (st) {
      const aura = Math.floor(coinsCollected / 100);
      st.textContent = won
        ? `🏁 Финиш! +${aura} ✨ возможно`
        : lives <= 0
          ? "Партия окончена"
          : "Партия окончена";
      st.classList.toggle("win", won || aura > 0);
    }
    if (typeof setMarioResult === "function") setMarioResult(coinsCollected);
  }

  function collectCoins() {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    for (const c of level.coins) {
      if (c.taken) continue;
      if (Math.hypot(cx - c.x, cy - c.y) < TILE * 0.55) {
        c.taken = true;
        coinsCollected++;
        updateHud();
      }
    }
  }

  function movePlayer() {
    if (keys.left) {
      player.vx = -MOVE_SPEED;
      player.face = -1;
    } else if (keys.right) {
      player.vx = MOVE_SPEED;
      player.face = 1;
    } else {
      player.vx *= 0.72;
      if (Math.abs(player.vx) < 0.15) player.vx = 0;
    }

    if (keys.jump && player.grounded) {
      player.vy = JUMP_V;
      player.grounded = false;
    }

    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY);
    player.grounded = false;

    let nx = player.x + player.vx;
    let ny = player.y + player.vy;

    if (player.vx > 0) {
      if (solidAt(nx + player.w, player.y + 2) || solidAt(nx + player.w, player.y + player.h - 2)) {
        nx = Math.floor((nx + player.w) / TILE) * TILE - player.w - 0.01;
        player.vx = 0;
      }
    } else if (player.vx < 0) {
      if (solidAt(nx, player.y + 2) || solidAt(nx, player.y + player.h - 2)) {
        nx = Math.floor(nx / TILE + 1) * TILE + 0.01;
        player.vx = 0;
      }
    }

    if (player.vy > 0) {
      if (solidAt(nx + 2, ny + player.h) || solidAt(nx + player.w - 2, ny + player.h)) {
        ny = Math.floor((ny + player.h) / TILE) * TILE - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    } else if (player.vy < 0) {
      if (solidAt(nx + 2, ny) || solidAt(nx + player.w - 2, ny)) {
        ny = Math.floor(ny / TILE + 1) * TILE;
        player.vy = 0;
      }
    }

    player.x = nx;
    player.y = ny;

    if (player.y > level.TH * TILE + 40) {
      hurtPlayer();
    }

    collectCoins();

    if (player.x + player.w >= level.flagX) {
      endGame(true);
    }
  }

  function hurtPlayer() {
    if (player.invuln > 0) return;
    lives--;
    updateHud();
    if (lives <= 0) {
      endGame(false);
      return;
    }
    resetPlayer();
    player.invuln = 90;
  }

  function updateEnemies() {
    for (const e of level.enemies) {
      if (e.dead) continue;
      e.x += e.vx;
      if (e.x < e.min) {
        e.x = e.min;
        e.vx = Math.abs(e.vx);
      }
      if (e.x + e.w > e.max) {
        e.x = e.max - e.w;
        e.vx = -Math.abs(e.vx);
      }

      const px = player.x;
      const py = player.y;
      const overlap =
        px < e.x + e.w &&
        px + player.w > e.x &&
        py < e.y + e.h &&
        py + player.h > e.y;
      if (!overlap || player.invuln > 0) continue;

      if (player.vy > 0 && py + player.h - e.y < 10) {
        e.dead = true;
        player.vy = STOMP_BOUNCE;
        coinsCollected += 5;
        updateHud();
      } else {
        hurtPlayer();
      }
    }
  }

  function updateCamera() {
    const target = player.x - viewW * 0.38;
    cameraX += (target - cameraX) * 0.12;
    const maxCam = level.TW * TILE - viewW;
    cameraX = Math.max(0, Math.min(maxCam, cameraX));
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, "#5c94fc");
    g.addColorStop(0.55, "#8bc8ff");
    g.addColorStop(1, "#c8e8ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const off = -cameraX * 0.15;
    [[40, 36, 28], [140, 52, 36], [260, 40, 24]].forEach(([bx, by, bw]) => {
      const x = ((bx + off) % (viewW + 80)) - 40;
      ctx.beginPath();
      ctx.arc(x, by, bw * 0.35, 0, Math.PI * 2);
      ctx.arc(x + bw * 0.35, by - 4, bw * 0.4, 0, Math.PI * 2);
      ctx.arc(x + bw * 0.7, by, bw * 0.32, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawTiles() {
    const x0 = Math.floor(cameraX / TILE);
    const x1 = Math.min(level.TW, x0 + Math.ceil(viewW / TILE) + 2);
    for (let ty = 0; ty < level.TH; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        const t = level.tiles[ty][tx];
        if (!t) continue;
        const sx = tx * TILE - cameraX;
        const sy = ty * TILE + (viewH - level.TH * TILE);
        if (t === 1) {
          ctx.fillStyle = "#c84c0c";
          ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = "#e88838";
          ctx.fillRect(sx, sy, TILE, 4);
        } else if (t === 2) {
          ctx.fillStyle = "#a83810";
          ctx.fillRect(sx, sy, TILE, TILE);
          ctx.strokeStyle = "#6b2808";
          ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
        }
      }
    }
  }

  function drawCoins(t) {
    const groundOff = viewH - level.TH * TILE;
    for (const c of level.coins) {
      if (c.taken) continue;
      const sx = c.x - cameraX;
      const sy = c.y + groundOff;
      if (sx < -20 || sx > viewW + 20) continue;
      const pulse = 0.85 + Math.sin(t * 0.01 + c.x) * 0.15;
      ctx.fillStyle = "#ffd250";
      ctx.beginPath();
      ctx.arc(sx, sy, 6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b8860b";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🪙", sx, sy + 1);
    }
  }

  function drawFlag() {
    const groundOff = viewH - level.TH * TILE;
    const sx = level.flagX - cameraX;
    const sy = (level.TH - 3) * TILE + groundOff;
    ctx.fillStyle = "#2d8a50";
    ctx.fillRect(sx, sy - 48, 4, 48);
    ctx.fillStyle = "#ff4060";
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy - 48);
    ctx.lineTo(sx + 28, sy - 38);
    ctx.lineTo(sx + 4, sy - 28);
    ctx.closePath();
    ctx.fill();
  }

  function drawEnemies() {
    const groundOff = viewH - level.TH * TILE;
    for (const e of level.enemies) {
      if (e.dead) continue;
      const sx = e.x - cameraX;
      const sy = e.y + groundOff;
      ctx.fillStyle = "#8b4513";
      ctx.beginPath();
      ctx.ellipse(sx + e.w / 2, sy + e.h / 2 + 2, e.w / 2, e.h / 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx + 3, sy + 4, 4, 4);
      ctx.fillRect(sx + e.w - 7, sy + 4, 4, 4);
      ctx.fillStyle = "#222";
      ctx.fillRect(sx + 4, sy + 5, 2, 2);
      ctx.fillRect(sx + e.w - 6, sy + 5, 2, 2);
    }
  }

  function drawPlayer() {
    const groundOff = viewH - level.TH * TILE;
    const sx = player.x - cameraX;
    const sy = player.y + groundOff;
    if (player.invuln > 0 && Math.floor(player.invuln / 5) % 2 === 0) return;

    ctx.fillStyle = "#e52521";
    ctx.fillRect(sx, sy, player.w, 6);
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(sx, sy + 6, player.w, player.h - 6);
    ctx.fillStyle = "#f5c99d";
    if (player.face > 0) {
      ctx.fillRect(sx + player.w - 5, sy + 7, 4, 5);
    } else {
      ctx.fillRect(sx + 1, sy + 7, 4, 5);
    }
    ctx.fillStyle = "#5c3d2e";
    ctx.fillRect(sx + 2, sy + player.h - 4, player.w - 4, 3);
  }

  function drawOverlay() {
    if (playing) return;
    ctx.fillStyle = "rgba(8, 12, 32, 0.55)";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = "#fff";
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(gameOver ? "Снова" : "Старт", viewW / 2, viewH / 2 - 8);
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("1 ✨ за 100 🪙", viewW / 2, viewH / 2 + 16);
  }

  function loop(t) {
    if (activeTab !== "mario") {
      requestAnimationFrame(loop);
      return;
    }

    drawBackground();
    if (level) {
      drawTiles();
      drawFlag();
      drawCoins(t);
      drawEnemies();
      if (player) drawPlayer();
    }
    drawOverlay();

    if (playing && !gameOver && player) {
      if (player.invuln > 0) player.invuln--;
      movePlayer();
      updateEnemies();
      updateCamera();
      updateHud();
    }

    requestAnimationFrame(loop);
  }

  function setKey(code, down) {
    if (!playing || gameOver) return;
    if (code === "left") keys.left = down;
    if (code === "right") keys.right = down;
    if (code === "jump") keys.jump = down;
  }

  document.addEventListener("keydown", (e) => {
    if (activeTab !== "mario") return;
    if (e.key === "ArrowLeft" || e.key === "a") setKey("left", true);
    if (e.key === "ArrowRight" || e.key === "d") setKey("right", true);
    if (e.key === "ArrowUp" || e.key === " " || e.key === "w") setKey("jump", true);
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") setKey("left", false);
    if (e.key === "ArrowRight" || e.key === "d") setKey("right", false);
    if (e.key === "ArrowUp" || e.key === " " || e.key === "w") setKey("jump", false);
  });

  document.querySelectorAll("[data-mario]").forEach((btn) => {
    const action = btn.dataset.mario;
    const down = (e) => {
      e.preventDefault();
      setKey(action, true);
    };
    const up = (e) => {
      e.preventDefault();
      setKey(action, false);
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("touchstart", down, { passive: false });
    btn.addEventListener("touchend", up, { passive: false });
  });

  if (startBtn) {
    startBtn.addEventListener("click", (e) => startGame(e));
    startBtn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        startGame(e);
      },
      { passive: false }
    );
  }

  level = buildLevel();
  setupMarioCanvas();
  updateHud();
  window.addEventListener("resize", setupMarioCanvas);
  requestAnimationFrame(loop);
})();
