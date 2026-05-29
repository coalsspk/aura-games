/* Aura Poker — 5 карт, удержание и замена, награда ауры за сильную комбинацию */
(function initPoker() {
  const SUITS = ["♠", "♥", "♦", "♣"];
  const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
  const RANK_CHARS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const POKER_MAX_HANDS = 5;
  const HAND_NAMES = [
    "Старшая карта",
    "Пара",
    "Две пары",
    "Тройка",
    "Стрит",
    "Флеш",
    "Фул-хаус",
    "Каре",
    "Стрит-флеш",
    "Роял-флеш",
  ];

  let deck = [];
  let hand = [];
  let held = [false, false, false, false, false];
  let handsPlayed = 0;
  let phase = "idle";
  let busy = false;
  let bestRank = 0;
  let winHands = 0;
  let lastComboRank = -1;

  const tableEl = document.getElementById("pokerTable");
  const cardsEl = document.getElementById("pokerCards");
  const dealBtn = document.getElementById("pokerDealBtn");
  const statusEl = document.getElementById("pokerStatus");
  const msgEl = document.getElementById("pokerMsg");
  const handsEl = document.getElementById("pokerHands");
  const comboEl = document.getElementById("pokerCombo");
  const dotsEl = document.getElementById("pokerDots");

  function newDeck() {
    const d = [];
    for (let s = 0; s < 4; s++) {
      for (let r = 2; r <= 14; r++) d.push({ r, s });
    }
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function drawCard() {
    return deck.pop();
  }

  function isStraight(sortedUnique) {
    if (sortedUnique.length < 5) return false;
    const u = [...sortedUnique].sort((a, b) => a - b);
    if (u.length >= 5) {
      for (let i = 0; i <= u.length - 5; i++) {
        let ok = true;
        for (let j = 1; j < 5; j++) {
          if (u[i + j] !== u[i] + j) ok = false;
        }
        if (ok) return true;
      }
    }
    const wheel = [2, 3, 4, 5, 14];
    return wheel.every((v) => u.includes(v));
  }

  function evaluate5(cards) {
    const ranks = cards.map((c) => c.r);
    const suits = cards.map((c) => c.s);
    const counts = {};
    ranks.forEach((r) => {
      counts[r] = (counts[r] || 0) + 1;
    });
    const values = Object.values(counts).sort((a, b) => b - a);
    const uniq = [...new Set(ranks)].sort((a, b) => a - b);
    const flush = suits.every((s) => s === suits[0]);
    const straight = isStraight(uniq);
    const royal =
      straight && flush && uniq.includes(14) && uniq.includes(13) && uniq.includes(12);

    if (royal) return { rank: 9, name: HAND_NAMES[9] };
    if (straight && flush) return { rank: 8, name: HAND_NAMES[8] };
    if (values[0] === 4) return { rank: 7, name: HAND_NAMES[7] };
    if (values[0] === 3 && values[1] === 2) return { rank: 6, name: HAND_NAMES[6] };
    if (flush) return { rank: 5, name: HAND_NAMES[5] };
    if (straight) return { rank: 4, name: HAND_NAMES[4] };
    if (values[0] === 3) return { rank: 3, name: HAND_NAMES[3] };
    if (values[0] === 2 && values[1] === 2) return { rank: 2, name: HAND_NAMES[2] };
    if (values[0] === 2) return { rank: 1, name: HAND_NAMES[1] };
    return { rank: 0, name: HAND_NAMES[0] };
  }

  function cardLabel(c) {
    return RANK_CHARS[c.r - 2] + SUITS[c.s];
  }

  function cardRed(s) {
    return s === 1 || s === 2;
  }

  function rankClass(r) {
    const ch = RANK_CHARS[r - 2];
    if (ch === "10") return "rank-10";
    return `rank-${ch.toLowerCase()}`;
  }

  function makeCorner(rank, suit, pos) {
    const corner = document.createElement("span");
    corner.className = `poker-corner ${pos}`;
    const r = document.createElement("span");
    r.className = "poker-corner-rank";
    r.textContent = rank;
    const s = document.createElement("span");
    s.className = "poker-corner-suit";
    s.textContent = suit;
    corner.append(r, s);
    return corner;
  }

  function makeCardFace(c) {
    const rank = RANK_CHARS[c.r - 2];
    const suit = SUITS[c.s];
    const frag = document.createDocumentFragment();
    frag.appendChild(makeCorner(rank, suit, "tl"));
    const center = document.createElement("span");
    center.className = "poker-center";
    const pip = document.createElement("span");
    pip.className = "poker-pip";
    pip.textContent = suit;
    center.appendChild(pip);
    if (c.r >= 11) {
      const face = document.createElement("span");
      face.className = "poker-face-art";
      face.textContent = rank;
      center.appendChild(face);
    }
    frag.appendChild(center);
    frag.appendChild(makeCorner(rank, suit, "br"));
    return frag;
  }

  function makeCardBack() {
    const frag = document.createDocumentFragment();
    const pattern = document.createElement("span");
    pattern.className = "poker-back-pattern";
    pattern.setAttribute("aria-hidden", "true");
    const logo = document.createElement("span");
    logo.className = "poker-back-logo";
    logo.textContent = "✨";
    frag.append(pattern, logo);
    return frag;
  }

  function buildCardElement(c, i, faceDown) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "poker-card";
    el.dataset.idx = String(i);
    el.style.setProperty("--card-i", String(i));

    if (faceDown) {
      el.classList.add("back");
      el.appendChild(makeCardBack());
      el.setAttribute("aria-label", "Карта рубашкой");
    } else {
      if (cardRed(c.s)) el.classList.add("red");
      el.classList.add(`suit-${SUIT_NAMES[c.s]}`, rankClass(c.r));
      if (c.r >= 11) el.classList.add("face-card");
      el.appendChild(makeCardFace(c));
      el.setAttribute("aria-label", cardLabel(c));
    }

    if (held[i]) {
      el.classList.add("held");
      const tag = document.createElement("span");
      tag.className = "poker-hold-tag";
      tag.textContent = "HOLD";
      el.appendChild(tag);
    }

    if (lastComboRank >= 2 && !faceDown) el.classList.add("combo-glow");

    if (phase === "dealt" && !busy && !faceDown) {
      el.addEventListener("click", () => toggleHold(i));
    }
    return el;
  }

  function renderCards(faceDown = false) {
    if (!cardsEl) return;
    cardsEl.innerHTML = "";
    hand.forEach((c, i) => {
      cardsEl.appendChild(buildCardElement(c, i, faceDown));
    });
  }

  function updateDots() {
    if (!dotsEl) return;
    const dots = dotsEl.querySelectorAll("span");
    dots.forEach((d, i) => {
      d.classList.remove("done", "win");
      if (i < handsPlayed) {
        d.classList.add("done");
        if (i === handsPlayed - 1 && lastComboRank >= 1) d.classList.add("win");
      }
    });
  }

  function showCombo(result) {
    lastComboRank = result.rank;
    if (!comboEl) return;
    comboEl.hidden = false;
    comboEl.className = "poker-combo";
    if (result.rank >= 2) comboEl.classList.add("poker-combo-big");
    if (result.rank >= 5) comboEl.classList.add("poker-combo-mega");
    comboEl.textContent = result.name;
    tableEl?.classList.toggle("poker-table-win", result.rank >= 2);
    if (result.rank >= 1 && typeof burstParticles === "function") burstParticles(8 + result.rank * 2);
  }

  function hideComboSoon() {
    setTimeout(() => {
      comboEl?.classList.remove("poker-combo-mega", "poker-combo-big");
    }, 2200);
  }

  function toggleHold(i) {
    if (phase !== "dealt" || busy) return;
    held[i] = !held[i];
    renderCards();
  }

  function updateHud() {
    if (handsEl) handsEl.textContent = `Раздача ${handsPlayed} / ${POKER_MAX_HANDS}`;
    updateDots();
    if (msgEl && phase === "idle" && handsPlayed < POKER_MAX_HANDS) {
      msgEl.textContent = "Пара или лучше — очки ауры";
    }
  }

  function setStatus(text, win = false) {
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.classList.toggle("win", win);
    }
  }

  function setBtnLabel() {
    if (!dealBtn) return;
    if (phase === "idle" || phase === "finished") {
      dealBtn.textContent = handsPlayed === 0 ? "🃏 Раздать" : "🃏 Следующая раздача";
      dealBtn.disabled = busy || handsPlayed >= POKER_MAX_HANDS;
    } else if (phase === "dealt") {
      dealBtn.textContent = "🔄 Заменить карты";
      dealBtn.disabled = busy;
    }
  }

  function auraRewardForSession(best, wins) {
    if (best >= 8) return { won: true, kind: "poker_royal", pts: 22, label: "Роял / стрит-флеш" };
    if (best >= 6) return { won: true, kind: "poker_full", pts: 18, label: "Фул-хаус или каре" };
    if (best >= 4) return { won: true, kind: "poker_strong", pts: 14, label: "Стрит или флеш" };
    if (best >= 3) return { won: true, kind: "poker", pts: 12, label: "Тройка" };
    if (best >= 2 || wins >= 2) return { won: true, kind: "poker", pts: 10, label: "Две пары+" };
    if (wins >= 1) return { won: true, kind: "poker_pair", pts: 6, label: "Пара" };
    return { won: false, kind: "poker", pts: 0, label: "" };
  }

  function finishSession() {
    phase = "finished";
    const reward = auraRewardForSession(bestRank, winHands);
    tableEl?.classList.toggle("poker-table-win", reward.won);
    if (reward.won) {
      setStatus(`🏆 ${reward.label}! +${reward.pts} ✨`, true);
      if (comboEl) {
        comboEl.hidden = false;
        comboEl.className = "poker-combo poker-combo-mega";
        comboEl.textContent = `+${reward.pts} ✨ ауры`;
      }
      if (typeof setResult === "function") {
        setResult("poker", true, reward.pts, { kind: reward.kind, best_rank: bestRank });
      }
      if (typeof burstParticles === "function") burstParticles(28);
      cardsEl?.classList.add("session-win");
    } else {
      setStatus("Партия окончена — нет приза");
      if (typeof setResult === "function") setResult("poker", false, 0);
    }
    setBtnLabel();
    if (dealBtn) dealBtn.disabled = true;
  }

  function afterEvaluate(result) {
    if (result.rank >= 1) winHands++;
    if (result.rank > bestRank) bestRank = result.rank;
    showCombo(result);
    hideComboSoon();
    setStatus(`${result.name}${result.rank >= 1 ? " ✨" : ""}`, result.rank >= 2);
    if (msgEl) {
      msgEl.textContent =
        result.rank >= 3
          ? "Отличная комбинация!"
          : result.rank >= 1
            ? "Есть пара — копите силу к финалу"
            : "Попробуйте удержать старшие карты";
    }
    handsPlayed++;
    phase = "idle";
    held = [false, false, false, false, false];
    renderCards();
    updateHud();
    setBtnLabel();
    if (handsPlayed >= POKER_MAX_HANDS) {
      setTimeout(finishSession, 1200);
    }
  }

  function deal() {
    if (busy || handsPlayed >= POKER_MAX_HANDS) return;
    if (phase === "finished") return;

    if (phase === "idle") {
      busy = true;
      comboEl?.classList.remove("poker-combo-mega", "poker-combo-big");
      tableEl?.classList.remove("poker-table-win");
      cardsEl?.classList.remove("session-win");
      lastComboRank = -1;
      deck = newDeck();
      hand = [drawCard(), drawCard(), drawCard(), drawCard(), drawCard()];
      held = [false, false, false, false, false];
      phase = "dealt";
      setStatus("Выберите карты для удержания");
      renderCards();
      cardsEl?.classList.add("dealing");
      setTimeout(() => {
        cardsEl?.classList.remove("dealing");
        busy = false;
        setBtnLabel();
      }, 550);
      return;
    }

    if (phase === "dealt") {
      busy = true;
      dealBtn.disabled = true;
      for (let i = 0; i < 5; i++) {
        if (!held[i]) hand[i] = drawCard();
      }
      phase = "drawn";
      renderCards();
      cardsEl?.classList.add("draw-flip");
      setTimeout(() => {
        cardsEl?.classList.remove("draw-flip");
        const result = evaluate5(hand);
        renderCards();
        cardsEl?.classList.add("reveal-win");
        setTimeout(() => cardsEl?.classList.remove("reveal-win"), 600);
        afterEvaluate(result);
        busy = false;
        setBtnLabel();
      }, 650);
    }
  }

  if (dealBtn) dealBtn.addEventListener("click", () => deal());

  updateHud();
  setBtnLabel();
  setStatus("Нажмите «Раздать»");
})();
