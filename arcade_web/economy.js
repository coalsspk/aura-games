/* Экосистема Aura — единая валюта ✨ в Mini App */
(function initAuraEconomy() {
  const STORAGE_KEY = "aura_wallet_v1";
  const START_BALANCE = 50;

  const REWARDS = {
    snake: 12,
    crystals: 14,
    casino: 12,
    casino_partial: 5,
    casino_jackpot: 22,
    mario: 0,
    poker: 10,
    poker_pair: 6,
    poker_strong: 14,
    poker_full: 18,
    poker_royal: 22,
    tanks: 14,
    tanks_bonus: 18,
    reading: 10,
    community: 8,
    hole: 12,
    shop: 14,
    dash: 12,
    ludus: 10,
    war: 14,
    bolt: 10,
    indycat: 12,
    blocks: 14,
    royal: 16,
    zodiac_tapper: 1,
  };

  let balance = START_BALANCE;
  let sessionEarned = 0;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw != null) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 0) balance = n;
      }
    } catch {
      /* private mode */
    }
  }

  function save() {
    if (save._t) clearTimeout(save._t);
    save._t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, String(balance));
      } catch {
        /* ignore */
      }
    }, 280);
  }

  function format(n) {
    return `${Math.max(0, n | 0)} ✨`;
  }

  function updateHud() {
    const el = document.getElementById("auraWallet");
    if (el) el.textContent = format(balance);
    const sess = document.getElementById("auraSession");
    if (sess) {
      sess.textContent = sessionEarned > 0 ? `+${sessionEarned} за сессию` : "";
      sess.hidden = sessionEarned <= 0;
    }
  }

  function updateResultBanner(game, won, auraPts, score) {
    const banner = document.getElementById("resultBanner");
    if (!banner) return;
    banner.hidden = false;
    banner.classList.toggle("win", !!won && auraPts > 0);
    banner.textContent = won && auraPts > 0
      ? `Победа: +${auraPts} ✨ · отправьте результат в бот`
      : `Партия завершена · счёт ${score ?? 0} · можно отправить результат`;
  }

  function getBalance() {
    return balance;
  }

  function canAfford(cost) {
    return balance >= cost;
  }

  function spend(cost, reason) {
    const c = Math.max(0, cost | 0);
    if (c > balance) return false;
    balance -= c;
    save();
    updateHud();
    return true;
  }

  function earn(amount, reason) {
    const a = Math.max(0, amount | 0);
    if (a <= 0) return 0;
    balance += a;
    sessionEarned += a;
    save();
    updateHud();
    if (typeof burstParticles === "function" && a >= 8) burstParticles(16);
    return a;
  }

  function rewardForKind(kind, game) {
    return REWARDS[kind] ?? REWARDS[game] ?? 8;
  }

  function finishGame(game, won, score, extra = {}) {
    const kind = extra.kind || game;
    if (window.lastResult && window.lastResult.won && !won) {
      return window.lastResult;
    }
    let auraPts = extra.aura_pts;
    if (auraPts == null) {
      if (game === "mario") {
        const coins = extra.coins ?? score ?? 0;
        auraPts = Math.floor(coins / (window.MARIO_AURA_RATIO || 100));
      } else if (game === "zodiac_tapper") {
        auraPts = Math.max(0, score | 0);
      } else if (won) {
        auraPts = rewardForKind(kind, game);
      } else {
        auraPts = 0;
      }
    }
    const previousScore = game === "zodiac_tapper" && window.lastResult?.game === "zodiac_tapper"
      ? Math.max(0, window.lastResult.score | 0)
      : 0;
    const clientEarned = game === "zodiac_tapper"
      ? Math.max(0, (score | 0) - previousScore)
      : auraPts;
    if (won && clientEarned > 0) earn(clientEarned, kind);

    const payload = {
      game,
      won: !!won,
      score: score ?? 0,
      aura_pts: auraPts,
      wallet: balance,
      kind,
      ...extra,
    };
    window.lastResult = payload;
    if (typeof lastResult !== "undefined") {
      try {
        lastResult = payload;
      } catch {
        /* app scope */
      }
    }

    const btn = document.getElementById("sendResult");
    if (btn) {
      btn.disabled = false;
      btn.textContent = won && auraPts > 0
        ? `✨ Отправить +${auraPts} в бот (💫 ${balance})`
        : `Завершить · 💫 ${balance}`;
    }
    updateResultBanner(game, won, auraPts, score);
    return payload;
  }

  function resetSession() {
    sessionEarned = 0;
    const banner = document.getElementById("resultBanner");
    if (banner) {
      banner.hidden = true;
      banner.classList.remove("win");
      banner.textContent = "";
    }
    updateHud();
  }

  load();
  updateHud();

  window.AuraEconomy = {
    getBalance,
    canAfford,
    spend,
    earn,
    format,
    finishGame,
    rewardForKind,
    updateHud,
    resetSession,
    REWARDS,
  };

  window.setResult = function setResult(game, won, score, extra = {}) {
    return AuraEconomy.finishGame(game, won, score, extra);
  };

  window.setMarioResult = function setMarioResult(coins) {
    const aura = Math.floor(coins / (window.MARIO_AURA_RATIO || 100));
    return AuraEconomy.finishGame("mario", aura > 0, coins, {
      coins,
      aura_pts: aura,
      kind: "mario",
    });
  };
})();
