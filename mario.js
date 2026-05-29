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
  const MARIO_LEVEL_COUNT = 30;
  const BUILD = window.ARCADE_BUILD || "dev";
  const STORAGE_KEY = "aura_mario_unlocked";

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
  let campaignComplete = false;
  let currentLevel = 1;
  let levelClearTimer = 0;
  let lastStartAt = 0;
  let animTime = 0;
  const particles = [];
  const input = { left: false, right: false, jump: false };
  const levelSelect = document.getElementById("marioLevelSelect");

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
    const r = window.AuraEngine?.setupCanvas
      ? window.AuraEngine.setupCanvas(canvas, { maxSize: 360, aspect: 0.72, pixelated: false })
      : null;
    if (r) {
      viewW = r.w;
      viewH = r.h;
      ctx = r.ctx;
      return;
    }
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    viewW = Math.min(360, Math.floor(window.innerWidth * 0.96));
    viewH = Math.floor(viewW * 0.72);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getMaxUnlocked() {
    try {
      const n = parseInt(localStorage.getItem(STORAGE_KEY) || "1", 10);
      return Math.min(MARIO_LEVEL_COUNT, Math.max(1, Number.isFinite(n) ? n : 1));
    } catch {
      return 1;
    }
  }

  function unlockLevel(n) {
    const next = Math.min(MARIO_LEVEL_COUNT, Math.max(1, n));
    if (next <= getMaxUnlocked()) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* private mode */
    }
    fillLevelSelect();
  }

  function buildClassicLevel(levelNum) {
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

    return {
      tiles,
      TW,
      TH,
      coins,
      enemies,
      decor,
      flagX: (TW - 4) * TILE,
      spawnX: 3 * TILE,
      spawnY: (TH - 4) * TILE - 18,
      levelNum,
      theme: 0,
    };
  }

  function buildProceduralLevel(levelNum) {
    const rng = createRng(levelNum * 9973);
    const TH = 13;
    const TW = Math.min(112, 68 + levelNum * 2);
    const tiles = Array.from({ length: TH }, () => new Uint8Array(TW));
    for (let x = 0; x < TW; x++) {
      tiles[TH - 1][x] = 1;
      tiles[TH - 2][x] = 1;
    }

    const addPlatform = (x, y, len, brick = false) => {
      if (x < 6 || x + len > TW - 8) return;
      const t = brick ? 2 : 1;
      for (let i = 0; i < len; i++) {
        if (y >= 0 && y < TH) tiles[y][x + i] = t;
      }
    };

    const coins = [];
    const placeCoins = (tx, ty, n) => {
      for (let i = 0; i < n; i++) {
        const cx = tx + i;
        if (cx >= TW - 6) continue;
        coins.push({
          x: cx * TILE + TILE / 2,
          y: ty * TILE + TILE / 2,
          taken: false,
        });
      }
    };

    const platCount = 5 + Math.floor(levelNum / 2);
    let px = 10;
    for (let p = 0; p < platCount && px < TW - 14; p++) {
      const gap = 3 + Math.floor(rng() * 5);
      px += gap;
      const len = 2 + Math.floor(rng() * 5);
      const y = TH - 4 - Math.floor(rng() * (2 + Math.min(3, levelNum / 6)));
      const brick = rng() < 0.22 + levelNum * 0.012;
      addPlatform(px, y, len, brick);
      if (rng() < 0.75) placeCoins(px, y - 1, Math.min(len, 2 + Math.floor(rng() * 3)));
      if (rng() < 0.18 && px + 1 < TW - 8) {
        tiles[y - 1][px + Math.floor(len / 2)] = 3;
      }
      px += len;
    }

    for (let x = 8; x < TW - 10; x += 4 + Math.floor(rng() * 3)) {
      if (rng() < 0.45) placeCoins(x, TH - 5, 2);
    }

    const enemies = [];
    const enemyN = Math.min(9, 1 + Math.floor(levelNum / 2));
    for (let e = 0; e < enemyN; e++) {
      const seg = 12 + Math.floor((rng() * (TW - 28)) | 0);
      const patrol = 2 + Math.floor(rng() * 3);
      const spd = 1.1 + levelNum * 0.04 + rng() * 0.35;
      enemies.push({
        x: seg * TILE,
        y: (TH - 3) * TILE - 14,
        w: 14,
        h: 14,
        vx: rng() < 0.5 ? -spd : spd,
        min: (seg - patrol) * TILE,
        max: (seg + patrol) * TILE,
        dead: false,
      });
    }

    const decor = [];
    const decorN = Math.max(8, Math.floor(TW / 6));
    for (let i = 0; i < decorN; i++) {
      decor.push({
        type: "hill",
        x: i * (TW * TILE) / decorN + 16,
        scale: 0.65 + (i % 4) * 0.12,
      });
      if (i % 2 === 0) {
        decor.push({ type: "bush", x: i * (TW * TILE) / decorN + 40, yOff: 0 });
      }
    }
    decor.push({ type: "castle", x: (TW - 5) * TILE });

    return {
      tiles,
      TW,
      TH,
      coins,
      enemies,
      decor,
      flagX: (TW - 4) * TILE,
      spawnX: 3 * TILE,
      spawnY: (TH - 4) * TILE - 18,
      levelNum,
      theme: (levelNum - 1) % 4,
    };
  }

  function buildLevel(levelNum) {
    const n = Math.max(1, Math.min(MARIO_LEVEL_COUNT, levelNum | 0));
    if (n === 1) return buildClassicLevel(n);
    return buildProceduralLevel(n);
  }

  function fillLevelSelect() {
    if (!levelSelect) return;
    const maxU = getMaxUnlocked();
    const prev = levelSelect.value;
    levelSelect.innerHTML = "";
    for (let i = 1; i <= MARIO_LEVEL_COUNT; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      const locked = i > maxU;
      o.textContent =
        i === 1 ? `1 — Классика${locked ? " 🔒" : ""}` : `Уровень ${i}${locked ? " 🔒" : ""}`;
      o.disabled = locked;
      levelSelect.appendChild(o);
    }
    const pick = prev && parseInt(prev, 10) <= maxU ? prev : "1";
    levelSelect.value = pick;
  }

  function setLevelStatus(text) {
    const st = document.getElementById("marioStatus");
    if (st && text) st.textContent = text;
  }

  function clearInput() {
    input.left = false;
    input.right = false;
    input.jump = false;
    document.querySelectorAll(".mario-pad-active").forEach((b) => {
      b.classList.remove("mario-pad-active");
    });
  }

  function beginLevel(levelNum, freshRun) {
    currentLevel = levelNum;
    level = buildLevel(levelNum);
    particles.length = 0;
    levelClearTimer = 0;
    resetPlayer();
    if (freshRun) {
      coinsCollected = 0;
      lives = 3;
      campaignComplete = false;
      wonFlag = false;
    }
    updateHud();
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
    const lvlEl = document.getElementById("marioLevelHud");
    if (el) el.textContent = `${coinsCollected} 🪙`;
    if (auraEl) auraEl.textContent = `${aura} ✨`;
    if (livesEl) livesEl.textContent = "❤️".repeat(Math.max(0, lives));
    if (lvlEl) {
      lvlEl.textContent = campaignComplete
        ? `✅ ${MARIO_LEVEL_COUNT}/${MARIO_LEVEL_COUNT}`
        : `Ур. ${currentLevel}/${MARIO_LEVEL_COUNT}`;
    }
    const levelProg = ((currentLevel - 1) / MARIO_LEVEL_COUNT) * 100;
    const coinProg = (coinsCollected % 100) / 100;
    setProgress("marioProgress", levelProg + coinProg * (100 / MARIO_LEVEL_COUNT), 100);
  }

  function completeLevel() {
    if (levelClearTimer > 0) return;
    unlockLevel(currentLevel + 1);
    spawnParticles(level.flagX, player.y + player.h / 2, "coin", 18);

    if (currentLevel >= MARIO_LEVEL_COUNT) {
      campaignComplete = true;
      wonFlag = true;
      endGame(true, true);
      return;
    }

    levelClearTimer = 120;
    clearInput();
    setLevelStatus(`🏁 Уровень ${currentLevel} пройден!`);
    if (typeof burstParticles === "function") burstParticles(12);

    window.setTimeout(() => {
      if (!playing || gameOver) return;
      beginLevel(currentLevel + 1, false);
      setLevelStatus(`Уровень ${currentLevel} · до флага →`);
      if (startBtn) startBtn.textContent = `Ур. ${currentLevel}…`;
    }, 1300);
  }

  function startGame(e) {
    const now = Date.now();
    if (now - lastStartAt < 400) return;
    if (playing && !gameOver) return;
    lastStartAt = now;
    if (e?.cancelable) e.preventDefault();
    if (e) e.stopPropagation();

    const selected = parseInt(levelSelect?.value || "1", 10) || 1;
    const startAt = Math.min(selected, getMaxUnlocked());

    gameOver = false;
    campaignComplete = false;
    playing = true;
    beginLevel(startAt, true);
    frame?.classList.add("mario-running");
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = `Ур. ${currentLevel}…`;
    }
    if (levelSelect) levelSelect.disabled = true;
    const st = document.getElementById("marioStatus");
    if (st) {
      st.textContent = `Кампания: уровень ${currentLevel} · к флагу`;
      st.classList.remove("win");
    }
    updateHud();
  }

  function endGame(won, allLevels = false) {
    playing = false;
    gameOver = true;
    wonFlag = won;
    levelClearTimer = 0;
    clearInput();
    frame?.classList.remove("mario-running");
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "🔄 Снова";
    }
    if (levelSelect) levelSelect.disabled = false;
    const st = document.getElementById("marioStatus");
    if (st) {
      const aura = Math.floor(coinsCollected / 100);
      if (allLevels) {
        st.textContent = `🎉 Все ${MARIO_LEVEL_COUNT} уровней! ${coinsCollected} 🪙`;
      } else if (won) {
        st.textContent = `🏁 Финиш! ${coinsCollected} 🪙 · ~${aura} ✨`;
      } else {
        st.textContent =
          lives <= 0
            ? `Партия окончена · ур. ${currentLevel} · ${coinsCollected} 🪙`
            : "Партия окончена";
      }
      st.classList.toggle("win", won || aura > 0 || allLevels);
    }
    if (typeof setMarioResult === "function") setMarioResult(coinsCollected);
    updateHud();
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
    if (levelClearTimer > 0) {
      levelClearTimer--;
      return;
    }

    if (input.left) {
      player.vx = -MOVE_SPEED;
      player.face = -1;
    } else if (input.right) {
      player.vx = MOVE_SPEED;
      player.face = 1;
    } else {
      player.vx *= 0.72;
      if (Math.abs(player.vx) < 0.15) player.vx = 0;
    }

    if (input.jump && player.grounded) {
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

    if (player.x + player.w * 0.6 >= level.flagX) {
      completeLevel();
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
    const theme = level?.theme ?? 0;
    const palettes = [
      ["#4a7fd4", "#6eb4ff", "#9ed4ff", "#c8ecff"],
      ["#3a5a9a", "#6888cc", "#98b8e8", "#c0d8f8"],
      ["#c87840", "#e8a060", "#f0c888", "#ffe8c0"],
      ["#284868", "#407090", "#6098b8", "#88c0d8"],
    ];
    const pal = palettes[theme] || palettes[0];
    const sky = ctx.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, pal[0]);
    sky.addColorStop(0.45, pal[1]);
    sky.addColorStop(0.75, pal[2]);
    sky.addColorStop(1, pal[3]);
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

  function drawLevelClearBanner() {
    if (levelClearTimer <= 0) return;
    ctx.fillStyle = "rgba(8, 12, 32, 0.55)";
    ctx.fillRect(0, viewH * 0.32, viewW, 56);
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd250";
    ctx.fillText(`Уровень ${currentLevel} ✓`, viewW / 2, viewH * 0.36 + 12);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#e8e8ff";
    const next = currentLevel + 1;
    ctx.fillText(
      next <= MARIO_LEVEL_COUNT ? `Далее: ${next}` : "Финал!",
      viewW / 2,
      viewH * 0.36 + 30
    );
  }

  function drawOverlay() {
    if (playing && levelClearTimer <= 0) return;
    if (playing && levelClearTimer > 0) {
      drawLevelClearBanner();
      return;
    }
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
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(
      `${MARIO_LEVEL_COUNT} уровней · открыто ${getMaxUnlocked()}`,
      viewW / 2,
      viewH / 2 + 12
    );
    ctx.fillText("1 ✨ за 100 🪙", viewW / 2, viewH / 2 + 28);
    ctx.font = "28px serif";
    ctx.fillText("🍄", viewW / 2, viewH / 2 - 42);
  }

  function marioLoop(t) {
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
      if (levelClearTimer <= 0) movePlayer();
      updateEnemies();
      updateCamera();
      if (particles.length) updateParticles();
      updateHud();
    } else if (particles.length) {
      updateParticles();
    }
  }

  function setKey(code, down) {
    if (code === "left") input.left = down;
    else if (code === "right") input.right = down;
    else if (code === "jump") input.jump = down;
  }

  document.addEventListener("keydown", (e) => {
    if (activeTab !== "mario") return;
    if (e.key === "ArrowLeft" || e.key === "a") setKey("left", true);
    if (e.key === "ArrowRight" || e.key === "d") setKey("right", true);
    if (e.key === "ArrowUp" || e.key === " " || e.key === "w") setKey("jump", true);
  });
  document.addEventListener("keyup", (e) => {
    if (activeTab !== "mario") return;
    if (e.key === "ArrowLeft" || e.key === "a") setKey("left", false);
    if (e.key === "ArrowRight" || e.key === "d") setKey("right", false);
    if (e.key === "ArrowUp" || e.key === " " || e.key === "w") setKey("jump", false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInput();
  });
  window.addEventListener("blur", clearInput);

  document.querySelectorAll("[data-mario]").forEach((btn) => {
    const action = btn.dataset.mario;
    let touchFromPointer = false;

    const down = (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      btn.classList.add("mario-pad-active");
      setKey(action, true);
    };
    const up = (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      btn.classList.remove("mario-pad-active");
      setKey(action, false);
    };

    btn.addEventListener("pointerdown", (e) => {
      touchFromPointer = true;
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      down(e);
    });
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("lostpointercapture", up);
    btn.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse" && e.buttons === 0) up(e);
    });
    btn.addEventListener(
      "touchstart",
      (e) => {
        if (touchFromPointer) return;
        down(e);
      },
      { passive: false }
    );
    btn.addEventListener(
      "touchend",
      (e) => {
        if (touchFromPointer) {
          touchFromPointer = false;
          return;
        }
        up(e);
      },
      { passive: false }
    );
    btn.addEventListener("touchcancel", up, { passive: false });
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

  fillLevelSelect();
  beginLevel(1, true);
  setupMarioCanvas();
  updateHud();
  setLevelStatus(`${MARIO_LEVEL_COUNT} уровней · открыто ${getMaxUnlocked()} · v${BUILD}`);
  if (levelSelect) {
    levelSelect.addEventListener("change", () => {
      if (playing && !gameOver) return;
      const n = parseInt(levelSelect.value, 10) || 1;
      if (n > getMaxUnlocked()) {
        levelSelect.value = String(getMaxUnlocked());
        return;
      }
      beginLevel(n, true);
      setLevelStatus(`Превью: уровень ${n} / ${MARIO_LEVEL_COUNT}`);
    });
  }
  const onMarioResize = window.AuraEngine?.debounce
    ? window.AuraEngine.debounce(setupMarioCanvas)
    : setupMarioCanvas;
  window.addEventListener("resize", onMarioResize);
  if (window.AuraEngine?.createTabLoop) {
    window.AuraEngine.createTabLoop("mario", marioLoop);
  } else {
    requestAnimationFrame(function loop(t) {
      marioLoop(t);
      requestAnimationFrame(loop);
    });
  }
})();
