/* Библиотека игр Aura — сетка как в «Мои игры» */
(function initLibrary() {
  const GAMES = [
    { id: "reading", title: "Я читаю!", icon: "📗", color: "#4caf50", reward: 10 },
    { id: "community", title: "Modern Community", icon: "👩", color: "#e91e8c", reward: 8 },
    { id: "hole", title: "Hole Express", icon: "🕳️", color: "#2196f3", reward: 12 },
    { id: "shop", title: "City Shop", icon: "🏪", color: "#ff9800", reward: 14 },
    { id: "dash", title: "Geometry Dash", icon: "⬛", color: "#00bcd4", reward: 12 },
    { id: "ludus", title: "Лудус", icon: "⚔️", color: "#9c27b0", reward: 10 },
    { id: "war", title: "Война судьбы", icon: "🛡️", color: "#795548", reward: 14 },
    { id: "bolt", title: "Мастер Болт", icon: "🔩", color: "#ffc107", reward: 10 },
    { id: "indycat", title: "Инди кот", icon: "🐱", color: "#ff5722", reward: 12 },
    { id: "blocks", title: "Блоки", icon: "🧱", color: "#607d8b", reward: 14 },
    { id: "royal", title: "Royal Kingdom", icon: "👑", color: "#ffd250", reward: 16 },
    { id: "snake", title: "Змейка", icon: "🐍", color: "#5ee88a", reward: 12 },
    { id: "crystals", title: "Кристаллы", icon: "💎", color: "#5ec8ff", reward: 14 },
    { id: "slots", title: "Слоты", icon: "🎰", color: "#ffd250", reward: 12 },
    { id: "mario", title: "Марио", icon: "🍄", color: "#e85030", reward: "🪙" },
    { id: "poker", title: "Покер", icon: "🃏", color: "#2e7d32", reward: "6–22" },
    { id: "tanks", title: "Танчики", icon: "🎮", color: "#78909c", reward: "14–18" },
  ];

  const grid = document.getElementById("libraryGrid");
  if (!grid) return;

  function openGame(id) {
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    document.querySelectorAll(".tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === id);
    });
    let panel = document.getElementById(id);
    if (!panel && window.MiniGames?.show(id)) {
      panel = document.getElementById("minigame");
    }
    if (panel) {
      panel.classList.add("active");
      window.activeTab = id;
      document.getElementById("library")?.classList.remove("active");
      const back = document.getElementById("libraryBackBar");
      if (back) back.hidden = false;
      if (panel.id === "minigame" && window.MiniGames?.show) {
        window.MiniGames.show(id);
      }
    }
  }

  window.openAuraGame = openGame;

  function goLibrary() {
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    document.getElementById("library")?.classList.add("active");
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
    window.activeTab = "library";
    const back = document.getElementById("libraryBackBar");
    if (back) back.hidden = true;
    if (window.MiniGames?.stop) window.MiniGames.stop();
  }

  window.goAuraLibrary = goLibrary;

  GAMES.forEach((g) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "library-card";
    card.style.setProperty("--card-accent", g.color);
    const rewardLabel = String(g.reward).includes("–") || g.reward === "🪙"
      ? `${g.reward} ✨`
      : `+${g.reward} ✨`;
    card.innerHTML = `
      <span class="library-card-icon" aria-hidden="true">${g.icon}</span>
      <span class="library-card-title">${g.title}</span>
      <span class="library-card-reward">${rewardLabel}</span>
    `;
    card.addEventListener("click", () => openGame(g.id));
    grid.appendChild(card);
  });

  document.getElementById("libraryBackBtn")?.addEventListener("click", goLibrary);
})();
