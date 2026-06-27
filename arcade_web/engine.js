/* Aura Engine — общие циклы, canvas, пауза фона */
(function initAuraEngine() {
  const IDLE_MS = 350;
  const MAX_DPR = 1.75;
  const loops = new Map();

  function isVisible() {
    return document.visibilityState !== "hidden";
  }

  function isActiveTab(tabId) {
    const tab = window.activeTab || "";
    if (tab === tabId) return true;
    const el = document.getElementById(tabId);
    return el?.classList.contains("active") === true;
  }

  function isPanelActive(id) {
    return document.getElementById(id)?.classList.contains("active") === true;
  }

  function setupCanvas(canvas, opts = {}) {
    if (!canvas) return null;
    const maxSize = opts.maxSize ?? 320;
    const aspect = opts.aspect ?? 1;
    const maxDpr = opts.maxDpr ?? MAX_DPR;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.min(maxSize, Math.floor(window.innerWidth * (opts.widthRatio ?? 0.92)));
    const h = Math.floor(w * aspect);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: opts.desync !== false,
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (opts.pixelated !== false) {
      ctx.imageSmoothingEnabled = false;
      canvas.style.imageRendering = "pixelated";
    }
    return { ctx, w, h, size: w, dpr };
  }

  function debounce(fn, ms = 160) {
    let t = 0;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /** Цикл только на активной вкладке; в фоне — редкий опрос */
  function createTabLoop(tabId, fn, opts = {}) {
    const match = opts.match || ((id) => isActiveTab(id));
    let raf = 0;
    let idle = 0;

    function tick(t) {
      clearTimeout(idle);
      idle = 0;
      raf = 0;
      if (isVisible() && match(tabId)) {
        fn(t);
        raf = requestAnimationFrame(tick);
      } else {
        idle = setTimeout(() => {
          raf = requestAnimationFrame(tick);
        }, opts.idleMs ?? IDLE_MS);
      }
    }

    function kick() {
      if (raf || idle) {
        if (idle) {
          clearTimeout(idle);
          idle = 0;
        }
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);
    loops.set(tabId, { kick });
    return { kick };
  }

  function wakeTab(tabId) {
    loops.get(tabId)?.kick();
  }

  function wakeAll() {
    loops.forEach((l) => l.kick());
  }

  document.addEventListener("visibilitychange", () => {
    if (isVisible()) wakeAll();
  });

  window.AuraEngine = {
    IDLE_MS,
    MAX_DPR,
    isVisible,
    isActiveTab,
    isPanelActive,
    setupCanvas,
    debounce,
    createTabLoop,
    wakeTab,
    wakeAll,
  };
})();
