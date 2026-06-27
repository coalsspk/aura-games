"""Рендер картинок для мини-игр (Pillow → PNG в чат Telegram)."""

from __future__ import annotations

import io
from typing import Any

from PIL import Image, ImageDraw, ImageFont

# Палитра Aura
BG = (18, 12, 36)
GRID = (45, 35, 75)
ACCENT = (140, 90, 220)
GOLD = (255, 210, 80)
TEXT = (230, 220, 255)
SNAKE_HEAD = (120, 220, 140)
SNAKE_BODY = (70, 160, 100)
FOOD = (255, 180, 60)
EMPTY = (30, 24, 52)
GEM_COLORS = {
    "💎": (100, 180, 255),
    "🔮": (180, 100, 255),
    "⭐": (255, 220, 100),
    "🌙": (200, 200, 255),
    "✨": (255, 150, 220),
}
CARD_BG = (250, 245, 255)
CARD_BORDER = (90, 60, 140)
REEL_BG = (25, 18, 48)


def _font(size: int = 18) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _save(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _header(draw: ImageDraw.ImageDraw, title: str, w: int) -> None:
    draw.text((12, 8), title, fill=GOLD, font=_font(20))


def render_snake(state: dict[str, Any]) -> bytes:
    cell = 44
    w, h = state["w"], state["h"]
    pad = 40
    img_w, img_h = w * cell + 24, h * cell + pad + 16
    img = Image.new("RGB", (img_w, img_h), BG)
    draw = ImageDraw.Draw(img)
    _header(draw, f"🐍 Змейка · {state['score']}/{6}", img_w)
    snake = set(state["snake"])
    head = state["snake"][0]
    food = state["food"]
    y0 = pad
    for y in range(h):
        for x in range(w):
            x1, y1 = 12 + x * cell, y0 + y * cell
            x2, y2 = x1 + cell - 4, y1 + cell - 4
            if (x, y) == head:
                fill = SNAKE_HEAD
            elif (x, y) in snake:
                fill = SNAKE_BODY
            elif (x, y) == food:
                fill = FOOD
            else:
                fill = EMPTY
            draw.rounded_rectangle([x1, y1, x2, y2], radius=8, fill=fill, outline=GRID)
    if not state.get("alive", True):
        draw.text((12, img_h - 28), "💥 Столкновение", fill=(255, 100, 100), font=_font(16))
    return _save(img)


def render_crystals(state: dict[str, Any]) -> bytes:
    cell = 72
    grid = state["grid"]
    n = len(grid)
    pad = 44
    img = Image.new("RGB", (n * cell + 24, n * cell + pad + 8), BG)
    draw = ImageDraw.Draw(img)
    pick = state.get("pick")
    _header(
        draw,
        f"💎 Кристалики · {state['score']}/20 · ход {state['moves']}/{state['max_moves']}",
        n * cell + 24,
    )
    labels = "ABCD"
    for y in range(n):
        for x in range(n):
            x1, y1 = 12 + x * cell, pad + y * cell
            x2, y2 = x1 + cell - 6, y1 + cell - 6
            gem = grid[y][x]
            fill = GEM_COLORS.get(gem, ACCENT)
            if pick == (x, y):
                outline = GOLD
                width = 4
            else:
                outline = GRID
                width = 2
            draw.rounded_rectangle([x1, y1, x2, y2], radius=10, fill=fill, outline=outline, width=width)
            draw.text((x1 + 8, y1 + 6), labels[x] + str(y + 1), fill=TEXT, font=_font(14))
            draw.text((x1 + 22, y1 + 28), gem, fill=TEXT, font=_font(22))
    return _save(img)


def render_casino(reels: list[str] | None = None, spins: int = 0, max_spins: int = 6) -> bytes:
    img = Image.new("RGB", (420, 200), BG)
    draw = ImageDraw.Draw(img)
    _header(draw, f"🎰 Казино · вращение {spins}/{max_spins}", 420)
    symbols = reels or ["?", "?", "?"]
    for i, sym in enumerate(symbols):
        x1 = 24 + i * 130
        draw.rounded_rectangle([x1, 52, x1 + 110, 150], radius=14, fill=REEL_BG, outline=GOLD, width=2)
        draw.text((x1 + 36, 78), sym, fill=TEXT, font=_font(40))
    return _save(img)


def render_solitaire(state: dict[str, Any]) -> bytes:
    img = Image.new("RGB", (400, 220), BG)
    draw = ImageDraw.Draw(img)
    pairs = state["pairs"]
    left = len(state["hidden"])
    last = state.get("last")
    _header(draw, f"🃏 Солитер · пары {pairs}/7 · в колоде {left}", 400)
    for i in range(min(left, 8)):
        x = 20 + i * 42
        draw.rounded_rectangle([x, 70, x + 36, 120], radius=6, fill=CARD_BORDER)
    if last is not None:
        draw.rounded_rectangle([280, 70, 360, 150], radius=10, fill=CARD_BG, outline=GOLD, width=3)
        draw.text((300, 95), str(last), fill=(40, 20, 60), font=_font(36))
        draw.text((280, 160), "открыта", fill=TEXT, font=_font(14))
    draw.text((20, 170), f"Ход {state['moves']}/{state['max_moves']}", fill=TEXT, font=_font(16))
    return _save(img)


def render_durak(
    state: dict[str, Any],
    user_card: str | None = None,
    bot_card: str | None = None,
) -> bytes:
    img = Image.new("RGB", (400, 240), BG)
    draw = ImageDraw.Draw(img)
    trump = state["trump"]
    _header(
        draw,
        f"🎴 Дурак · {state['user_wins']}:{state['bot_wins']} · козырь {trump}",
        400,
    )

    def card(x: int, label: str, title: str) -> None:
        draw.rounded_rectangle([x, 60, x + 90, 150], radius=10, fill=CARD_BG, outline=ACCENT, width=2)
        draw.text((x + 8, 42), title, fill=TEXT, font=_font(14))
        draw.text((x + 12, 88), label or "—", fill=(50, 30, 70), font=_font(28))

    card(40, user_card or "?", "Вы")
    card(250, bot_card or "?", "Бот")
    rnd = state.get("round", 0)
    draw.text((20, 190), f"Раунд {rnd}/3", fill=TEXT, font=_font(16))
    return _save(img)


def render_game_image(state: dict[str, Any], *, reels: list[str] | None = None) -> bytes | None:
    """Картинка текущего состояния или None, если игра без визуала."""
    gid = state.get("id")
    if gid == "snake":
        return render_snake(state)
    if gid == "crystals":
        return render_crystals(state)
    if gid == "casino":
        r = reels or state.get("last_reels")
        return render_casino(r, state.get("spins", 0))
    if gid == "solitaire":
        return render_solitaire(state)
    if gid == "durak":
        return render_durak(state, state.get("user_card"), state.get("bot_card"))
    return None
