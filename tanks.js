/* Танчики — Battle City в духе Dendy */
(function initTanks() {
  const canvas = document.getElementById("tanksCanvas");
  const frame = document.getElementById("tanksFrame");
  const startBtn = document.getElementById("tanksStartBtn");
  if (!canvas) return;

  const TILE = 16;
  const TW = 13;
  const TH = 13;
  const W = TW * TILE;
  const H = TH * TILE;
  const ENEMY_TOTAL = 12;
  const MAX_ON_FIELD = 4;
  const SPAWN_CD = 90;
  const PLAYER_TILE = { x: 2, y: 10 };
  const ENEMY_SPAWN_TILES = [
    [1, 1],
    [6, 1],
    [11, 1],
  ];

  const DEFAULT_LEVEL = [
    "#############",
    "#...........#",
    "#...........#",
    "#.##.....##.#",
    "#.##.....##.#",
    "#...........#",
    "#....###....#",
    "#...........#",
    "#.####.####.#",
    "#...........#",
    "#...........#",
    "#...........#",
    "####..#B####",
  ];

  let levelRows = [...DEFAULT_LEVEL];
  let mapSource = "builtin";
  let mapLoading = false;

  const keys = { up: false, down: false, left: false, right: false, fire: false };
  let dpr = 1;
  let viewScale = 1;
  let ctx;
  let map = [];
  let player;
  let enemies = [];
  let bullets = [];
  let explosions = [];
  let playing = false;
  let gameOver = false;
  let won = false;
  let enemiesLeft = ENEMY_TOTAL;
  let spawnTimer = 0;
  let baseAlive = true;
  let baseHit = false;
  let animTime = 0;
  let lastStartAt = 0;

  let enemySpawnSlot = 0;

  function setupCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxW = Math.min(360, Math.floor(window.innerWidth * 0.96));
    viewScale = maxW / W;
    const viewH = H * viewScale;
    canvas.style.width = `${maxW}px`;
    canvas.style.height = `${viewH}px`;
    canvas.width = Math.floor(maxW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function finalizeMapRows(rows) {
    const grid = rows.slice(0, TH).map((line) => {
      const s = String(line).slice(0, TW).padEnd(TW, ".");
      return s.split("");
    });
    while (grid.length < TH) grid.push(".".repeat(TW).split(""));

    for (let x = 0; x < TW; x++) {
      grid[0][x] = "#";
      grid[TH - 1][x] = "#";
    }
    for (let y = 0; y < TH; y++) {
      grid[y][0] = "#";
      grid[y][TW - 1] = "#";
    }

    for (let y = 10; y <= 11; y++) {
      for (let x = 1; x <= 3; x++) {
        grid[y][x] = ".";
      }
    }

    for (const [tx, ty] of ENEMY_SPAWN_TILES) {
      grid[ty][tx] = ".";
      for (const [dx, dy] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (ny > 0 && ny < TH - 1 && nx > 0 && nx < TW - 1 && grid[ny][nx] !== "B") {
          grid[ny][nx] = ".";
        }
      }
    }

    const bx = 7;
    grid[TH - 1][bx] = "B";
    for (const dx of [-1, 0, 1]) {
      const nx = bx + dx;
      if (nx > 0 && nx < TW - 1) grid[TH - 2][nx] = "#";
    }
    grid[TH - 2][bx] = ".";

    return grid.map((r) => r.join(""));
  }

  function proceduralMapClient(seed) {
    const rng = (() => {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();
    const rows = Array.from({ length: TH }, () => Array(TW).fill("."));
    for (let n = 0; n < 12 + Math.floor(rng() * 6); n++) {
      const x = 2 + Math.floor(rng() * (TW - 5));
      const y = 3 + Math.floor(rng() * (TH - 6));
      const w = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < w; i++) {
        if (x + i < TW - 1) rows[y][x + i] = rng() < 0.72 ? "#" : "@";
      }
    }
    if (rng() < 0.3) {
      const wx = 3 + Math.floor(rng() * (TW - 6));
      const wy = 4 + Math.floor(rng() * (TH - 7));
      rows[wy][wx] = "~";
    }
    return finalizeMapRows(rows.map((r) => r.join("")));
  }

  function setMapRows(rows, source) {
    if (Array.isArray(rows) && rows.length === TH) {
      levelRows = finalizeMapRows(rows);
      mapSource = source || "random";
    }
  }

  function setMapStatus(text) {
    const el = document.getElementById("tanksMapLabel");
    if (el) el.textContent = text;
  }

  async function fetchLevelMap() {
    setMapStatus("Карта: загрузка…");
    try {
      const res = await fetch("/api/tanks-map", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.rows && data.rows.length === TH) {
          setMapRows(data.rows, data.source === "deepseek" ? "deepseek" : "random");
          setMapStatus(
            data.source === "deepseek" ? "Карта: ✨ DeepSeek" : "Карта: случайная"
          );
          return;
        }
      }
    } catch {
      /* нет API — классическая карта */
    }
    setMapRows([...DEFAULT_LEVEL], "classic");
    setMapStatus("Карта: Battle City");
  }

  function parseLevel() {
    map = [];
    for (let y = 0; y < TH; y++) {
      const row = [];
      const line = levelRows[y] || "";
      for (let x = 0; x < TW; x++) {
        const ch = line[x] || ".";
        if (ch === "#") row.push(1);
        else if (ch === "@") row.push(2);
        else if (ch === "~") row.push(3);
        else if (ch === "B") row.push(4);
        else row.push(0);
      }
      map.push(row);
    }
  }

  function tileSolid(t, bullet = false) {
    if (t === 1 || t === 2) return true;
    if (t === 3) return !bullet;
    if (t === 4) return true;
    return false;
  }

  function tankAt(tx, ty, skip) {
    const check = (t) => {
      if (!t || t === skip) return false;
      const px = t.x + 1;
      const py = t.y + 1;
      const pw = TILE - 2;
      const ph = TILE - 2;
      return (
        tx < px + pw &&
        tx + TILE > px &&
        ty < py + ph &&
        ty + TILE > py
      );
    };
    if (check(player)) return true;
    return enemies.some((e) => e.alive && check(e));
  }

  function blockAt(px, py, w, h, skip) {
    const x0 = Math.floor(px / TILE);
    const y0 = Math.floor(py / TILE);
    const x1 = Math.floor((px + w - 0.01) / TILE);
    const y1 = Math.floor((py + h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= TW || ty >= TH) return true;
        const t = map[ty][tx];
        if (tileSolid(t)) return true;
        if (tankAt(tx * TILE, ty * TILE, skip)) return true;
      }
    }
    return false;
  }

  function resetPlayer() {
    player = {
      x: PLAYER_TILE.x * TILE,
      y: PLAYER_TILE.y * TILE,
      dir: 0,
      alive: true,
      lives: 3,
      shootCd: 0,
      moveCd: 0,
      invuln: 90,
    };
  }

  function spawnEnemy() {
    if (enemiesLeft <= 0 || enemies.filter((e) => e.alive).length >= MAX_ON_FIELD) {
      return false;
    }
    for (let tryN = 0; tryN < ENEMY_SPAWN_TILES.length; tryN++) {
      const idx = (enemySpawnSlot + tryN) % ENEMY_SPAWN_TILES.length;
      enemySpawnSlot = (idx + 1) % ENEMY_SPAWN_TILES.length;
      const [tx, ty] = ENEMY_SPAWN_TILES[idx];
      const ex = tx * TILE;
      const ey = ty * TILE;
      if (blockAt(ex, ey, TILE - 2, TILE - 2, null)) continue;
      enemies.push({
        x: ex,
        y: ey,
        dir: 2,
        alive: true,
        shootCd: 40 + Math.random() * 40,
        moveCd: 0,
        aiTimer: 0,
        flash: 50,
      });
      enemiesLeft--;
      updateHud();
      return true;
    }
    return false;
  }

  function spawnInitialWave() {
    let n = 0;
    while (n < MAX_ON_FIELD && enemiesLeft > 0) {
      if (!spawnEnemy()) break;
      n++;
    }
    spawnTimer = SPAWN_CD;
  }

  function resetGame() {
    parseLevel();
    resetPlayer();
    enemies = [];
    bullets = [];
    explosions = [];
    enemiesLeft = ENEMY_TOTAL;
    enemySpawnSlot = 0;
    spawnTimer = 0;
    baseAlive = true;
    baseHit = false;
    gameOver = false;
    won = false;
    spawnInitialWave();
    updateHud();
  }

  function updateHud() {
    const el = document.getElementById("tanksScore");
    const livesEl = document.getElementById("tanksLives");
    const enEl = document.getElementById("tanksEnemies");
    if (el) el.textContent = won ? "Победа!" : gameOver ? "Поражение" : "В бою";
    if (livesEl) livesEl.textContent = "❤️".repeat(Math.max(0, player?.lives || 0));
    if (enEl) enEl.textContent = `🎯 ${enemiesLeft + enemies.filter((e) => e.alive).length}`;
    const onField = enemies.filter((e) => e.alive).length;
    setProgress("tanksProgress", ENEMY_TOTAL - enemiesLeft - onField, ENEMY_TOTAL);
  }

  async function startGame(e) {
    const now = Date.now();
    if (now - lastStartAt < 400) return;
    if (playing && !gameOver) return;
    if (mapLoading) return;
    lastStartAt = now;
    if (e?.cancelable) e.preventDefault();
    mapLoading = true;
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = "Карта…";
    }
    await fetchLevelMap();
    mapLoading = false;
    resetGame();
    playing = true;
    frame?.classList.add("tanks-running");
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = "Игра идёт…";
    }
    const st = document.getElementById("tanksStatus");
    if (st) {
      st.textContent = "Уничтожьте все танки · берегите орёл";
      st.classList.remove("win");
    }
  }

  function endGame(didWin) {
    playing = false;
    gameOver = true;
    won = didWin;
    frame?.classList.remove("tanks-running");
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "🔄 Снова";
    }
    const st = document.getElementById("tanksStatus");
    const bonus = didWin && !baseHit;
    if (st) {
      st.textContent = didWin
        ? bonus
          ? "🎉 Победа! База цела — бонус ✨"
          : "🎉 Победа!"
        : "Партия окончена";
      st.classList.toggle("win", didWin);
    }
    if (typeof setResult === "function") {
      setResult("tanks", didWin, didWin ? (bonus ? 18 : 14) : 0, {
        kind: bonus ? "tanks_bonus" : "tanks",
      });
    }
    if (didWin && typeof burstParticles === "function") burstParticles(24);
    updateHud();
  }

  function addExplosion(x, y, big = false) {
    explosions.push({ x, y, life: big ? 28 : 18, big });
  }

  function shoot(tank, isPlayer) {
    if (tank.shootCd > 0) return;
    const cx = tank.x + TILE / 2;
    const cy = tank.y + TILE / 2;
    const off = TILE / 2 + 2;
    let bx = cx;
    let by = cy;
    if (tank.dir === 0) by = tank.y - 2;
    if (tank.dir === 1) bx = tank.x + TILE + 2;
    if (tank.dir === 2) by = tank.y + TILE + 2;
    if (tank.dir === 3) bx = tank.x - 2;
    bullets.push({
      x: bx,
      y: by,
      dir: tank.dir,
      owner: isPlayer ? "p" : "e",
      speed: isPlayer ? 4 : 3,
    });
    tank.shootCd = isPlayer ? 22 : 50;
  }

  function moveTank(tank, dir, speed) {
    tank.dir = dir;
    let nx = tank.x;
    let ny = tank.y;
    if (dir === 0) ny -= speed;
    if (dir === 1) nx += speed;
    if (dir === 2) ny += speed;
    if (dir === 3) nx -= speed;
    if (!blockAt(nx, ny, TILE - 2, TILE - 2, tank)) {
      tank.x = nx;
      tank.y = ny;
      return true;
    }
    return false;
  }

  function hitBase() {
    if (!baseAlive) return;
    baseAlive = false;
    baseHit = true;
    addExplosion(7 * TILE, (TH - 1) * TILE, true);
    endGame(false);
  }

  function damageBrick(tx, ty) {
    if (map[ty][tx] === 1) map[ty][tx] = 0;
    if (map[ty][tx] === 4) hitBase();
  }

  function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.dir === 0) b.y -= b.speed;
      if (b.dir === 1) b.x += b.speed;
      if (b.dir === 2) b.y += b.speed;
      if (b.dir === 3) b.x -= b.speed;

      if (b.x < 0 || b.y < 0 || b.x > W || b.y > H) {
        bullets.splice(i, 1);
        continue;
      }

      const tx = Math.floor(b.x / TILE);
      const ty = Math.floor(b.y / TILE);
      if (tx >= 0 && ty >= 0 && tx < TW && ty < TH) {
        const t = map[ty][tx];
        if (t === 1) {
          damageBrick(tx, ty);
          addExplosion(b.x, b.y);
          bullets.splice(i, 1);
          continue;
        }
        if (t === 2 || t === 3) {
          if (t === 2) addExplosion(b.x, b.y, false);
          bullets.splice(i, 1);
          continue;
        }
        if (t === 4) {
          hitBase();
          bullets.splice(i, 1);
          continue;
        }
      }

      if (b.owner === "p") {
        for (const e of enemies) {
          if (!e.alive) continue;
          if (
            b.x > e.x &&
            b.x < e.x + TILE &&
            b.y > e.y &&
            b.y < e.y + TILE
          ) {
            e.alive = false;
            addExplosion(e.x + TILE / 2, e.y + TILE / 2, true);
            bullets.splice(i, 1);
            if (enemiesLeft <= 0 && enemies.every((x) => !x.alive)) {
              setTimeout(() => endGame(true), 600);
            }
            break;
          }
        }
      } else if (player.alive && player.invuln <= 0) {
        if (
          b.x > player.x &&
          b.x < player.x + TILE &&
          b.y > player.y &&
          b.y < player.y + TILE
        ) {
          killPlayer();
          bullets.splice(i, 1);
        }
      }
    }
  }

  function killPlayer() {
    addExplosion(player.x + TILE / 2, player.y + TILE / 2, true);
    player.lives--;
    player.invuln = 0;
    updateHud();
    if (player.lives <= 0) {
      player.alive = false;
      endGame(false);
      return;
    }
    player.alive = false;
    setTimeout(() => {
      if (!gameOver) {
        player.x = PLAYER_TILE.x * TILE;
        player.y = PLAYER_TILE.y * TILE;
        player.alive = true;
        player.invuln = 120;
      }
    }, 1500);
  }

  function updatePlayer() {
    if (!player.alive) return;
    if (player.invuln > 0) player.invuln--;
    if (player.shootCd > 0) player.shootCd--;
    const speed = 1.8;
    if (keys.up) moveTank(player, 0, speed);
    else if (keys.down) moveTank(player, 2, speed);
    else if (keys.left) moveTank(player, 3, speed);
    else if (keys.right) moveTank(player, 1, speed);
    if (keys.fire) shoot(player, true);
  }

  function updateEnemies() {
    enemies.forEach((e) => {
      if (!e.alive) return;
      if (e.shootCd > 0) e.shootCd--;
      e.aiTimer++;
      if (e.aiTimer % 45 === 0) e.dir = Math.floor(Math.random() * 4);
      if (e.aiTimer % 8 === 0) moveTank(e, e.dir, 1.1);
      if (Math.random() < 0.02) shoot(e, false);
      if (player.alive && player.invuln <= 0) {
        if (
          e.x < player.x + TILE &&
          e.x + TILE > player.x &&
          e.y < player.y + TILE &&
          e.y + TILE > player.y
        ) {
          killPlayer();
        }
      }
    });
  }

  function update() {
    if (!playing || gameOver) return;
    updatePlayer();
    updateEnemies();
    updateBullets();
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].life--;
      if (explosions[i].life <= 0) explosions.splice(i, 1);
    }
    if (spawnTimer > 0) spawnTimer--;
    else if (enemiesLeft > 0) {
      spawnEnemy();
      spawnTimer = SPAWN_CD;
    }
  }

  function drawTile(x, y, t) {
    const px = x * TILE;
    const py = y * TILE;
    if (t === 0) {
      const c1 = (x + y) % 2 === 0 ? "#3a3a3a" : "#323232";
      ctx.fillStyle = c1;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(px, py + TILE - 2, TILE, 2);
    } else if (t === 1) {
      ctx.fillStyle = "#b84a18";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#d06828";
      ctx.fillRect(px + 1, py + 1, 6, 6);
      ctx.fillRect(px + 9, py + 1, 6, 6);
      ctx.fillStyle = "#8a3810";
      ctx.fillRect(px + 1, py + 9, 6, 6);
      ctx.fillRect(px + 9, py + 9, 6, 6);
      ctx.strokeStyle = "#5c2808";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    } else if (t === 2) {
      ctx.fillStyle = "#909098";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#d8d8e0";
      ctx.fillRect(px + 2, py + 2, 5, 5);
      ctx.fillRect(px + 9, py + 9, 5, 5);
      ctx.fillStyle = "#686870";
      ctx.fillRect(px + 9, py + 2, 5, 5);
      ctx.fillRect(px + 2, py + 9, 5, 5);
    } else if (t === 3) {
      const wave = Math.sin(animTime * 0.06 + x * 0.7 + y) * 1.5;
      ctx.fillStyle = "#1a48a0";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#3890e8";
      ctx.fillRect(px, py + 3 + wave, TILE, 5);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(px + 2, py + 2 + wave, TILE - 4, 2);
    } else if (t === 4) {
      drawEagle(px, py, baseAlive);
    }
  }

  function drawEagle(px, py, alive) {
    if (!alive) {
      ctx.fillStyle = "#3a2020";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#666";
      ctx.fillRect(px + 4, py + 4, 8, 8);
      return;
    }
    ctx.fillStyle = "#888";
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "#e8c040";
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 2);
    ctx.lineTo(px + 14, py + 10);
    ctx.lineTo(px + 10, py + 14);
    ctx.lineTo(px + 6, py + 14);
    ctx.lineTo(px + 2, py + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(px + 6, py + 6, 4, 4);
  }

  function drawTank(t, isPlayer) {
    if (!t.alive) return;
    const px = t.x;
    const py = t.y;
    if (isPlayer && t.invuln > 0 && Math.floor(t.invuln / 5) % 2 === 0) return;

    if (!isPlayer && t.flash > 0) {
      t.flash--;
      ctx.fillStyle = "rgba(255, 200, 80, 0.55)";
      ctx.fillRect(px - 1, py - 1, TILE + 2, TILE + 2);
    }

    const body = isPlayer ? "#f0d038" : "#b0b0b8";
    const dark = isPlayer ? "#c08818" : "#686870";
    const tread = "#2a2a2a";
    const treadHi = "#444";

    if (t.dir === 0 || t.dir === 2) {
      ctx.fillStyle = tread;
      ctx.fillRect(px, py + 1, 5, TILE - 2);
      ctx.fillRect(px + TILE - 5, py + 1, 5, TILE - 2);
      ctx.fillStyle = treadHi;
      ctx.fillRect(px + 1, py + 2, 2, TILE - 4);
      ctx.fillRect(px + TILE - 3, py + 2, 2, TILE - 4);
    } else {
      ctx.fillStyle = tread;
      ctx.fillRect(px + 1, py, TILE - 2, 5);
      ctx.fillRect(px + 1, py + TILE - 5, TILE - 2, 5);
      ctx.fillStyle = treadHi;
      ctx.fillRect(px + 2, py + 1, TILE - 4, 2);
      ctx.fillRect(px + 2, py + TILE - 3, TILE - 4, 2);
    }

    ctx.fillStyle = body;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = dark;
    ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
    if (isPlayer) {
      ctx.fillStyle = "#fff8c0";
      ctx.fillRect(px + 6, py + 6, 4, 4);
    }

    ctx.fillStyle = body;
    const cx = px + TILE / 2;
    const cy = py + TILE / 2;
    if (t.dir === 0) ctx.fillRect(cx - 2, py, 4, 9);
    if (t.dir === 2) ctx.fillRect(cx - 2, py + TILE - 9, 4, 9);
    if (t.dir === 1) ctx.fillRect(px + TILE - 9, cy - 2, 9, 4);
    if (t.dir === 3) ctx.fillRect(px, cy - 2, 9, 4);
  }

  function drawBullet(b) {
    ctx.fillStyle = b.owner === "p" ? "#fff8c0" : "#ff9080";
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }

  function drawExplosion(ex) {
    const p = ex.life / (ex.big ? 28 : 18);
    const r = (ex.big ? 14 : 8) * (1 - p * 0.3);
    ctx.fillStyle = `rgba(255, ${180 + Math.floor(40 * p)}, 40, ${p})`;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 80, 20, ${p * 0.8})`;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHudBar() {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, W, 10);
    ctx.fillStyle = "#ffd250";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`P${player.lives}`, 4, 8);
    ctx.textAlign = "right";
    const rem = enemiesLeft + enemies.filter((e) => e.alive).length;
    ctx.fillText(`E${rem}`, W - 4, 8);
  }

  function draw() {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) drawTile(x, y, map[y][x]);
    }
    drawHudBar();
    enemies.forEach((e) => drawTank(e, false));
    if (player.alive) drawTank(player, true);
    bullets.forEach(drawBullet);
    explosions.forEach(drawExplosion);
  }

  function drawOverlay() {
    if (playing) return;
    ctx.fillStyle = "rgba(8, 10, 24, 0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffd250";
    ctx.font = "bold 14px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(gameOver ? "Снова" : "Старт", W / 2, H / 2 - 6);
    ctx.font = "9px system-ui,sans-serif";
    ctx.fillStyle = "#ccc";
    ctx.fillText("14 ✨ · база цела 18 ✨", W / 2, H / 2 + 10);
  }

  function loop(t) {
    animTime = t;
    if (activeTab === "tanks" && playing && !gameOver) update();
    if (activeTab === "tanks") {
      draw();
      drawOverlay();
    }
    requestAnimationFrame(loop);
  }

  function setKey(code, down) {
    if (!playing || gameOver) return;
    if (code in keys) keys[code] = down;
  }

  document.querySelectorAll("[data-tanks]").forEach((btn) => {
    const action = btn.dataset.tanks;
    let touchFromPointer = false;
    const down = (e) => {
      if (e.cancelable) e.preventDefault();
      btn.classList.add("tanks-pad-active");
      setKey(action, true);
    };
    const up = (e) => {
      if (e.cancelable) e.preventDefault();
      btn.classList.remove("tanks-pad-active");
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
    btn.addEventListener("touchstart", (e) => {
      if (touchFromPointer) return;
      down(e);
    }, { passive: false });
    btn.addEventListener("touchend", (e) => {
      if (touchFromPointer) {
        touchFromPointer = false;
        return;
      }
      up(e);
    }, { passive: false });
  });

  document.addEventListener("keydown", (e) => {
    if (activeTab !== "tanks") return;
    if (e.key === "ArrowUp") setKey("up", true);
    if (e.key === "ArrowDown") setKey("down", true);
    if (e.key === "ArrowLeft") setKey("left", true);
    if (e.key === "ArrowRight") setKey("right", true);
    if (e.key === " " || e.key === "z") setKey("fire", true);
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp") setKey("up", false);
    if (e.key === "ArrowDown") setKey("down", false);
    if (e.key === "ArrowLeft") setKey("left", false);
    if (e.key === "ArrowRight") setKey("right", false);
    if (e.key === " " || e.key === "z") setKey("fire", false);
  });

  if (startBtn) {
    startBtn.addEventListener("click", (e) => startGame(e));
    startBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      startGame(e);
    }, { passive: false });
  }

  setupCanvas();
  levelRows = finalizeMapRows([...DEFAULT_LEVEL]);
  parseLevel();
  updateHud();
  window.addEventListener("resize", setupCanvas);
  requestAnimationFrame(loop);
})();
