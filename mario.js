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
  let animTime = 0;
  const particles = [];
  const keys = { left: false, right: false, jump: false };

  function groundOff() {
    return viewH - level.TH * TILE;
  }

  function spawnParticles(x, y, kind, n = 8) {
    const colors =
      kind === "coin"
        ? ["#ffd250", "#fff8b0", "#ffaa00"]
        : kind === "stomp"
          ? ["#8b6914", "#c4a050", "#6b4a20"]
          : ["#e8e8ff", "#ffffff", "#b8d4ff"];
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * (kind === "coin" ? 5 : 4),
        vy: -2 - Math.random() * 4,
        life: 1,
        r: 2 + Math.random() * 3,
        color: colors[i % colors.length],
        kind,
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.life -= 0.035;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticlesLayer() {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      if (p.kind === "coin") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x - cameraX, p.y + groundOff(), p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - cameraX - p.r, p.y + groundOff() - p.r, p.r * 2, p.r * 2);
      }
      ctx.globalAlpha = 1;
    }
  }

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
    tiles[TH - 5][18] = 3;
    tiles[TH - 5][34] = 3;
    tiles[TH - 7][62] = 3;
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

    const decor = [];
    for (let i = 0; i < 18; i++) {
      decor.push({ type: "hill", x: i * 52 + 20, scale: 0.7 + (i % 3) * 0.15 });
      if (i % 2 === 0) decor.push({ type: "bush", x: i * 48 + 60, yOff: 0 });
    }
    decor.push({ type: "castle", x: (TW - 5) * TILE });

    const flagX = (TW - 4) * TILE;
    const spawnX = 3 * TILE;
    const spawnY = (TH - 4) * TILE - 18;

    return { tiles, TW, TH, coins, enemies, decor, flagX, spawnX, spawnY };
  }

  function tileAt(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || ty >= level.TH || tx >= level.TW) return 0;
    return level.tiles[ty][tx];
  }

  function solidAt(px, py) {
    const t = tileAt(px, py);
    return t === 1 || t === 2 || t === 3;
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
    particles.length = 0;
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
        spawnParticles(c.x, c.y, "coin", 10);
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
        e.deadTimer = 24;
        player.vy = STOMP_BOUNCE;
        spawnParticles(e.x + e.w / 2, e.y + e.h, "stomp", 12);
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

  function drawBackground(t) {
    const go = level ? groundOff() : viewH * 0.35;
    const sky = ctx.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, "#4a7fd4");
    sky.addColorStop(0.45, "#6eb4ff");
    sky.addColorStop(0.75, "#9ed4ff");
    sky.addColorStop(1, "#c8ecff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewW, viewH);

    const sunX = viewW * 0.78;
    const sunY = 42 + Math.sin(t * 0.001) * 3;
    const sunG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 36);
    sunG.addColorStop(0, "#fffce8");
    sunG.addColorStop(0.4, "#ffe866");
    sunG.addColorStop(1, "rgba(255, 232, 100, 0)");
    ctx.fillStyle = sunG;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
    ctx.fill();

    const drawCloud = (wx, wy, s) => {
      const x = ((wx - cameraX * 0.08) % (viewW + 120)) - 30;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(x, wy, 10 * s, 0, Math.PI * 2);
      ctx.arc(x + 14 * s, wy - 4, 12 * s, 0, Math.PI * 2);
      ctx.arc(x + 28 * s, wy, 9 * s, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCloud(30, 48, 1.1);
    drawCloud(160, 62, 0.85);
    drawCloud(280, 40, 1);

    const hillBase = go + 8;
    const drawHill = (wx, h, color, parallax) => {
      const x = wx - cameraX * parallax;
      if (x < -120 || x > viewW + 120) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - h, hillBase);
      ctx.quadraticCurveTo(x, hillBase - h * 0.85, x + h, hillBase);
      ctx.fill();
    };
    drawHill(80, 36, "#4cb85a", 0.15);
    drawHill(200, 28, "#3da84e", 0.12);
    drawHill(320, 44, "#5ec96a", 0.18);
    drawHill(480, 32, "#45b055", 0.14);
  }

  function drawDecor(t) {
    if (!level?.decor) return;
    const go = groundOff();
    const baseY = go + (level.TH - 2) * TILE;
    for (const d of level.decor) {
      const sx = d.x - cameraX * (d.type === "hill" ? 0.25 : 0.5);
      if (sx < -80 || sx > viewW + 80) continue;
      if (d.type === "hill") {
        const h = 22 * d.scale;
        ctx.fillStyle = "#3dad52";
        ctx.beginPath();
        ctx.ellipse(sx, baseY - 4, h, h * 0.45, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#52c868";
        ctx.beginPath();
        ctx.ellipse(sx - h * 0.2, baseY - 6, h * 0.55, h * 0.3, 0, Math.PI, 0);
        ctx.fill();
      } else if (d.type === "bush") {
        ctx.fillStyle = "#2d8a40";
        [[0, 0], [-6, 2], [6, 2]].forEach(([ox, oy]) => {
          ctx.beginPath();
          ctx.arc(sx + ox, baseY - 10 + oy, 8, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
  }

  function drawEndCastle(t) {
    const d = level.decor?.find((x) => x.type === "castle");
    if (!d) return;
    const sx = d.x - cameraX;
    const baseY = groundOff() + (level.TH - 2) * TILE;
    if (sx > -100 && sx < viewW + 100) drawCastle(sx, baseY, t);
  }

  function drawCastle(sx, baseY, t) {
    const w = 56;
    const h = 52;
    const x = sx - w / 2;
    const y = baseY - h;
    ctx.fillStyle = "#b8b8c8";
    ctx.fillRect(x, y + 12, w, h - 12);
    ctx.fillStyle = "#9898a8";
    [[x + 4, y + 16, 10, 14], [x + w - 14, y + 16, 10, 14], [x + w / 2 - 6, y + 28, 12, 18]].forEach(
      ([rx, ry, rw, rh]) => {
        ctx.fillStyle = "#4a3028";
        ctx.fillRect(rx, ry, rw, rh);
      }
    );
    ctx.fillStyle = "#a0a0b0";
    [[x, y, 14, 14], [x + w - 14, y, 14, 14]].forEach(([tx, ty, tw, th]) => {
      ctx.fillRect(tx, ty, tw, th);
      ctx.fillStyle = "#c03030";
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + tw / 2, ty - 8);
      ctx.lineTo(tx + tw, ty);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#a0a0b0";
    });
  }

  function drawGroundTile(sx, sy, t, tx, ty) {
    if (t === 1) {
      const dirt = (tx + ty) % 2 === 0 ? "#c06028" : "#b05020";
      ctx.fillStyle = dirt;
      ctx.fillRect(sx, sy, TILE, TILE);
      ctx.fillStyle = "#5cb838";
      ctx.fillRect(sx, sy, TILE, 5);
      ctx.fillStyle = "#48a030";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(sx + 2 + i * 4, sy + 2, 2, 3);
      }
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(sx, sy + TILE - 2, TILE, 2);
    } else if (t === 2) {
      ctx.fillStyle = "#b84a18";
      ctx.fillRect(sx, sy, TILE, TILE);
      ctx.fillStyle = "#8c3810";
      ctx.fillRect(sx + 1, sy + 1, 6, 6);
      ctx.fillRect(sx + 9, sy + 1, 6, 6);
      ctx.fillRect(sx + 1, sy + 9, 6, 6);
      ctx.fillRect(sx + 9, sy + 9, 6, 6);
      ctx.strokeStyle = "#5c2808";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
    } else if (t === 3) {
      const bounce = Math.sin(animTime * 0.08 + tx) * 0.5;
      ctx.fillStyle = "#e8a030";
      ctx.fillRect(sx, sy + bounce, TILE, TILE);
      ctx.fillStyle = "#c87818";
      ctx.fillRect(sx + 2, sy + 2 + bounce, TILE - 4, TILE - 4);
      ctx.fillStyle = "#5c3010";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", sx + TILE / 2, sy + TILE / 2 + bounce);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(sx + 2, sy + 2 + bounce, TILE - 4, 3);
    }
  }

  function drawTiles() {
    const go = groundOff();
    const x0 = Math.floor(cameraX / TILE);
    const x1 = Math.min(level.TW, x0 + Math.ceil(viewW / TILE) + 2);
    for (let ty = 0; ty < level.TH; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        const t = level.tiles[ty][tx];
        if (!t) continue;
        const sx = tx * TILE - cameraX;
        const sy = ty * TILE + go;
        drawGroundTile(sx, sy, t, tx, ty);
      }
    }
  }

  function drawCoins(t) {
    const go = groundOff();
    for (const c of level.coins) {
      if (c.taken) continue;
      const sx = c.x - cameraX;
      const sy = c.y + go;
      if (sx < -24 || sx > viewW + 24) continue;
      const bob = Math.sin(t * 0.012 + c.x * 0.1) * 3;
      const spin = Math.abs(Math.sin(t * 0.015 + c.x * 0.05));
      const rw = 5 + spin * 3;
      const rh = 7;
      const g = ctx.createRadialGradient(sx, sy + bob, 0, sx, sy + bob, 14);
      g.addColorStop(0, "rgba(255, 240, 120, 0.5)");
      g.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sx, sy + bob, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd838";
      ctx.beginPath();
      ctx.ellipse(sx, sy + bob, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c89010";
      ctx.beginPath();
      ctx.ellipse(sx - 1, sy + bob, rw * 0.65, rh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8c0";
      ctx.fillRect(sx - rw * 0.3, sy + bob - rh * 0.5, 2, rh * 0.6);
    }
  }

  function drawFlag(t) {
    const go = groundOff();
    const sx = level.flagX - cameraX;
    const sy = (level.TH - 3) * TILE + go;
    const wave = Math.sin(t * 0.01) * 3;
    ctx.fillStyle = "#3d2818";
    ctx.fillRect(sx - 2, sy - 56, 6, 58);
    ctx.fillStyle = "#ffd250";
    ctx.beginPath();
    ctx.arc(sx + 1, sy - 54, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e82030";
    ctx.beginPath();
    ctx.moveTo(sx + 6, sy - 52);
    ctx.lineTo(sx + 34 + wave, sy - 44 + wave * 0.3);
    ctx.lineTo(sx + 6, sy - 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(sx + 8, sy - 50);
    ctx.lineTo(sx + 22 + wave * 0.5, sy - 44);
    ctx.lineTo(sx + 8, sy - 38);
    ctx.closePath();
    ctx.fill();
  }

  function drawGoomba(sx, sy, e, t) {
    if (e.dead) {
      if (e.deadTimer > 0) {
        e.deadTimer--;
        ctx.fillStyle = "#6b4a30";
        ctx.beginPath();
        ctx.ellipse(sx + e.w / 2, sy + e.h - 3, e.w / 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    const squash = Math.sin(t * 0.02 + e.x * 0.05) * 1.5;
    ctx.fillStyle = "#9b4a20";
    ctx.beginPath();
    ctx.ellipse(sx + e.w / 2, sy + e.h / 2 + 2 + squash * 0.3, e.w / 2 + 1, e.h / 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b3010";
    ctx.beginPath();
    ctx.ellipse(sx + e.w / 2, sy + e.h / 2 + 4, e.w / 2.5, e.h / 3, 0, 0, Math.PI);
    ctx.fill();
    const foot = Math.sin(t * 0.025 + e.x) > 0 ? 2 : -2;
    ctx.fillStyle = "#222";
    ctx.fillRect(sx + 2, sy + e.h - 3 + foot, 4, 3);
    ctx.fillRect(sx + e.w - 6, sy + e.h - 3 - foot, 4, 3);
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx + 3, sy + 5, 5, 5);
    ctx.fillRect(sx + e.w - 8, sy + 5, 5, 5);
    ctx.fillStyle = "#111";
    ctx.fillRect(sx + 5, sy + 7, 2, 2);
    ctx.fillRect(sx + e.w - 7, sy + 7, 2, 2);
    ctx.strokeStyle = "#4a2010";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy + 12);
    ctx.lineTo(sx + e.w - 4, sy + 12);
    ctx.stroke();
    ctx.fillStyle = "#5c3018";
    ctx.fillRect(sx + e.w / 2 - 3, sy + 2, 6, 4);
  }

  function drawEnemies(t) {
    const go = groundOff();
    for (const e of level.enemies) {
      const sx = e.x - cameraX;
      const sy = e.y + go;
      if (sx < -40 || sx > viewW + 40) continue;
      drawGoomba(sx, sy, e, t);
    }
  }

  function drawPlayer(t) {
    const go = groundOff();
    const sx = player.x - cameraX;
    const sy = player.y + go;
    if (player.invuln > 0 && Math.floor(player.invuln / 5) % 2 === 0) return;

    const moving = Math.abs(player.vx) > 0.5;
    const frame = moving ? Math.floor(animTime / 6) % 2 : 0;
    const dir = player.face;
    const jumpPose = !player.grounded;

    ctx.save();
    if (dir < 0) {
      ctx.translate(sx + player.w, sy);
      ctx.scale(-1, 1);
      drawMarioSprite(0, 0, frame, jumpPose, t);
    } else {
      drawMarioSprite(sx, sy, frame, jumpPose, t);
    }
    ctx.restore();

    if (player.grounded && moving && frame === 1) {
      ctx.fillStyle = "rgba(180, 140, 100, 0.4)";
      ctx.beginPath();
      ctx.ellipse(sx + player.w / 2, sy + player.h + 2, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarioSprite(x, y, frame, jumpPose, t) {
    const w = 13;
    const h = 17;
    const legOff = jumpPose ? 0 : frame === 1 ? 2 : 0;
    ctx.fillStyle = "#e52521";
    ctx.fillRect(x, y, w, 7);
    ctx.fillRect(x - 1, y + 2, 2, 4);
    ctx.fillStyle = "#b01018";
    ctx.fillRect(x + 2, y + 5, w - 4, 2);
    ctx.fillStyle = "#f5c99d";
    ctx.fillRect(x + 3, y + 5, 7, 6);
    ctx.fillStyle = "#5c3018";
    ctx.fillRect(x + 4, y + 9, 5, 2);
    ctx.fillStyle = "#111";
    ctx.fillRect(x + 5, y + 6, 2, 2);
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(x, y + 10, w, 5);
    ctx.fillStyle = "#f5c99d";
    ctx.fillRect(x - 1, y + 11, 3, 4);
    ctx.fillStyle = "#5c3d2e";
    ctx.fillRect(x + 1, y + 14 + legOff, 4, 3);
    ctx.fillRect(x + 7, y + 14 - legOff, 4, 3);
    ctx.fillStyle = "#222";
    ctx.fillRect(x + 1, y + 16 + legOff, 4, 2);
    ctx.fillRect(x + 7, y + 16 - legOff, 4, 2);
    if (jumpPose) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(x + 4, y + 12, 2, 2);
    }
  }

  function drawOverlay() {
    if (playing) return;
    const g = ctx.createRadialGradient(viewW / 2, viewH / 2, 20, viewW / 2, viewH / 2, viewW * 0.6);
    g.addColorStop(0, "rgba(20, 16, 48, 0.75)");
    g.addColorStop(1, "rgba(8, 6, 24, 0.88)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffd250";
    ctx.fillText(gameOver ? "🔄 Снова" : "▶ Старт", viewW / 2, viewH / 2 - 12);
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText("1 ✨ за 100 🪙", viewW / 2, viewH / 2 + 14);
    ctx.font = "28px serif";
    ctx.fillText("🍄", viewW / 2, viewH / 2 - 42);
  }

  function loop(t) {
    if (activeTab !== "mario") {
      requestAnimationFrame(loop);
      return;
    }

    animTime = t;
    drawBackground(t);
    if (level) {
      drawDecor(t);
      drawTiles();
      drawEndCastle(t);
      drawFlag(t);
      drawCoins(t);
      drawEnemies(t);
      drawParticlesLayer();
      if (player) drawPlayer(t);
    }
    drawOverlay();

    if (playing && !gameOver && player) {
      if (player.invuln > 0) player.invuln--;
      movePlayer();
      updateEnemies();
      updateCamera();
      updateParticles();
      updateHud();
    } else {
      updateParticles();
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
