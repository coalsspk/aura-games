"""Логика мини-игр (текст + кнопки Telegram)."""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass, field
from typing import Any

from app.numerology.interpretations import pick_fresh
from app.telegram.arcade.config import (
    CASINO_MAX_SPINS,
    CRYSTALS_MAX_ACTIONS,
    CRYSTALS_MAX_SWAPS,
    CRYSTALS_WIN_SCORE,
    DURAK_MAX_ROUNDS,
    PARTIAL_REWARD,
    SNAKE_MAX_STEPS,
    SNAKE_WIN_SCORE,
    SOLITAIRE_MAX_MOVES,
    WIN_REWARD,
)

_END_LINE = "\n\n🏁 Партия окончена — выберите другую игру ниже."

# --- Кнопки игр ---
BTN_ARCADE_MENU = "🎮 Игры за очки"
BTN_ARCADE_CASINO = "🎰 Казино"
BTN_ARCADE_SOLITAIRE = "🃏 Солитер"
BTN_ARCADE_DURAK = "🎴 Дурак"
BTN_ARCADE_SNAKE = "🐍 Змейка"
BTN_ARCADE_CRYSTALS = "💎 Кристалики"
BTN_ARCADE_BACK = "◀️ К играм"
BTN_ARCADE_EXIT = "⏹ Выйти из игры"

BTN_SPIN = "🎰 Крутить"
BTN_FLIP = "🂠 Открыть"
BTN_ATTACK = "⚔ Ход"
BTN_SNAKE_UP = "⬆️"
BTN_SNAKE_DOWN = "⬇️"
BTN_SNAKE_LEFT = "⬅️"
BTN_SNAKE_RIGHT = "➡️"
BTN_SWAP = "🔄 Выбрать"

ARCADE_MENU_BUTTONS = frozenset(
    {
        BTN_ARCADE_MENU,
        BTN_ARCADE_CASINO,
        BTN_ARCADE_SOLITAIRE,
        BTN_ARCADE_DURAK,
        BTN_ARCADE_SNAKE,
        BTN_ARCADE_CRYSTALS,
        BTN_ARCADE_BACK,
        BTN_ARCADE_EXIT,
        BTN_SPIN,
        BTN_FLIP,
        BTN_ATTACK,
        BTN_SNAKE_UP,
        BTN_SNAKE_DOWN,
        BTN_SNAKE_LEFT,
        BTN_SNAKE_RIGHT,
        BTN_SWAP,
    }
)

GAME_BY_BUTTON = {
    BTN_ARCADE_CASINO: "casino",
    BTN_ARCADE_SOLITAIRE: "solitaire",
    BTN_ARCADE_DURAK: "durak",
    BTN_ARCADE_SNAKE: "snake",
    BTN_ARCADE_CRYSTALS: "crystals",
}

SYMBOLS = ("🍒", "🔔", "7️⃣", "💎", "⭐")
CRYSTAL_GEMS = ("💎", "🔮", "⭐", "🌙", "✨")
RANKS = ("6", "7", "8", "9", "10", "В", "Д", "К", "Т")
SUITS = ("♠", "♥", "♦", "♣")


def _rng(user_id: int, salt: str) -> random.Random:
    h = hashlib.sha256(f"{user_id}|{salt}|{random.random()}".encode()).hexdigest()
    return random.Random(int(h[:16], 16))


@dataclass
class GameResult:
    text: str
    won: bool = False
    reward_kind: str = ""
    reward_points: int = 0
    finished: bool = False
    keyboard: str = "play"  # play | menu | snake | crystals


def _finish(text: str, *, won: bool = False, kind: str = "", pts: int = 0) -> GameResult:
    return GameResult(
        text + _END_LINE,
        won=won,
        reward_kind=kind,
        reward_points=pts,
        finished=True,
        keyboard="menu",
    )


def new_state(game_id: str, user_id: int) -> dict[str, Any]:
    if game_id == "casino":
        return {"id": "casino", "spins": 0}
    if game_id == "solitaire":
        rng = _rng(user_id, "sol")
        deck = []
        for i in range(1, 8):
            deck.extend([i, i])
        rng.shuffle(deck)
        return {
            "id": "solitaire",
            "hidden": deck,
            "pairs": 0,
            "last": None,
            "moves": 0,
            "max_moves": SOLITAIRE_MAX_MOVES,
        }
    if game_id == "durak":
        rng = _rng(user_id, "durak")
        trump = rng.choice(SUITS)
        return {
            "id": "durak",
            "trump": trump,
            "round": 0,
            "user_wins": 0,
            "bot_wins": 0,
            "user_card": None,
            "bot_card": None,
        }
    if game_id == "snake":
        return {
            "id": "snake",
            "w": 6,
            "h": 6,
            "snake": [(2, 2), (2, 1), (2, 0)],
            "dir": (0, 1),
            "food": (4, 4),
            "score": 0,
            "alive": True,
            "steps": 0,
            "max_steps": SNAKE_MAX_STEPS,
        }
    if game_id == "crystals":
        rng = _rng(user_id, "cry")
        grid = [[rng.choice(CRYSTAL_GEMS) for _ in range(4)] for _ in range(4)]
        return {
            "id": "crystals",
            "grid": grid,
            "score": 0,
            "moves": 0,
            "max_moves": CRYSTALS_MAX_SWAPS,
            "max_actions": CRYSTALS_MAX_ACTIONS,
            "actions": 0,
            "pick": None,
        }
    return {"id": game_id}


def intro_text(game_id: str, plays_left: int) -> str:
    intros = {
        "casino": (
            "🎰 КАЗИНО AURA\n\n"
            f"До {CASINO_MAX_SPINS} вращений за партию. "
            "Три одинаковых = джекпот, два = малый приз.\n"
            f"Партий сегодня осталось: {plays_left}"
        ),
        "solitaire": (
            "🃏 СОЛИТЕР (пары)\n\n"
            "Открывайте карты и собирайте пары одинакового достоинства.\n"
            "Уложитесь в лимит ходов — получите очки.\n"
            f"Попыток осталось: {plays_left}"
        ),
        "durak": (
            "🎴 ДУРАК (быстрый)\n\n"
            "Три раунда: у кого карта сильнее — забирает очко.\n"
            "Козырь бьёт некозырную. Победа 2 из 3 — награда.\n"
            f"Попыток осталось: {plays_left}"
        ),
        "snake": (
            "🐍 ЗМЕЙКА\n\n"
            "Управление: стрелки. Соберите ✨, не врежьтесь в стену и хвост.\n"
            f"Счёт {SNAKE_WIN_SCORE}+ — победа; не более {SNAKE_MAX_STEPS} шагов.\n"
            f"Попыток осталось: {plays_left}"
        ),
        "crystals": (
            "💎 КРИСТАЛИКИ\n\n"
            "Нажмите «Выбрать» и две соседние клетки по очереди — они поменяются.\n"
            f"Три в ряд дают очки. Наберите {CRYSTALS_WIN_SCORE}+ за {CRYSTALS_MAX_SWAPS} обменов — победа.\n"
            f"Попыток осталось: {plays_left}"
        ),
    }
    return intros.get(game_id, "🎮 Игра")


def _card_strength(card: str, trump: str) -> int:
    rank, suit = card[:-1], card[-1]
    r = RANKS.index(rank) if rank in RANKS else 0
    if suit == trump:
        return 100 + r
    return r


def _deal_card(rng: random.Random, trump: str) -> str:
    return f"{rng.choice(RANKS)}{rng.choice(SUITS)}"


def play_casino(state: dict, user_id: int, action: str) -> GameResult:
    if action != BTN_SPIN:
        spins = state.get("spins", 0)
        left = max(0, CASINO_MAX_SPINS - spins)
        return GameResult(
            f"Нажмите «🎰 Крутить».\nОсталось вращений: {left}/{CASINO_MAX_SPINS}.",
            keyboard="casino",
        )
    state["spins"] = state.get("spins", 0) + 1
    spins = state["spins"]
    rng = _rng(user_id, f"spin{spins}")
    reels = [rng.choice(SYMBOLS) for _ in range(3)]
    state["last_reels"] = reels
    line = " | ".join(reels)
    if reels[0] == reels[1] == reels[2]:
        pts = WIN_REWARD["casino_jackpot"]
        return _finish(
            f"🎰 {line}\n\n🎉 ДЖЕКПОТ! Три совпадения!\n+{pts} очков ауры ✨",
            won=True,
            kind="casino_jackpot",
            pts=pts,
        )
    if reels[0] == reels[1] or reels[1] == reels[2] or reels[0] == reels[2]:
        pts = PARTIAL_REWARD["casino"]
        return _finish(
            f"🎰 {line}\n\n✨ Два символа совпали!\n+{pts} очков ауры.",
            won=True,
            kind="casino",
            pts=pts,
        )
    if spins >= CASINO_MAX_SPINS:
        tail = pick_fresh(
            user_id,
            "casino_lose",
            [
                "Шесть вращений — смена энергии. Завтра снова 🌙",
                "Барабан замолк. Новая партия — завтра.",
            ],
        )
        return _finish(f"🎰 {line}\n\n{tail}\nОчки не начислены.")
    tail = pick_fresh(
        user_id,
        "casino_lose",
        ["Не совпало — крутите ещё.", "Символы мимо — ещё попытка в этой партии."],
    )
    return GameResult(
        f"🎰 {line}\n\n{tail}\n"
        f"Вращение {spins}/{CASINO_MAX_SPINS}.",
        keyboard="casino",
    )


def _solitaire_end(state: dict, extra: str, *, won: bool = False) -> GameResult:
    pairs = state["pairs"]
    if won:
        pts = WIN_REWARD["solitaire"]
        return _finish(
            f"{extra}\n\n🎉 Все 7 пар — победа!\n+{pts} очков ауры ✨",
            won=True,
            kind="solitaire",
            pts=pts,
        )
    return _finish(
        f"{extra}\n\nПар собрано: {pairs}/7.\nПобеда не засчитана."
    )


def play_solitaire(state: dict, user_id: int, action: str) -> GameResult:
    if action != BTN_FLIP:
        return GameResult(
            f"Карт в колоде: {len(state['hidden'])}\nПар собрано: {state['pairs']}/7\n"
            f"Ход {state['moves']}/{state['max_moves']}\n"
            "Нажмите «🂠 Открыть».",
            keyboard="play",
        )
    if not state["hidden"]:
        return _solitaire_end(state, "🃏 Колода закончилась.", won=state["pairs"] >= 7)
    state["moves"] += 1
    card = state["hidden"].pop()
    last = state.get("last")
    if last is not None and last == card:
        state["pairs"] += 1
        state["last"] = None
        if state["pairs"] >= 7:
            return _solitaire_end(
                state, f"🃏 Пара: {card} + {card}", won=True
            )
        if not state["hidden"]:
            return _solitaire_end(
                state,
                f"🃏 Пара: {card} + {card}\nКолода закончилась.",
                won=False,
            )
        return GameResult(
            f"🃏 Пара найдена! ({state['pairs']}/7)\n"
            f"Ход {state['moves']}/{state['max_moves']}",
            keyboard="play",
        )
    state["last"] = card
    if state["moves"] >= state["max_moves"]:
        return _solitaire_end(
            state, f"🃏 Ходы закончились. Открыта: {card}."
        )
    if not state["hidden"]:
        return _solitaire_end(
            state, f"🃏 Колода закончилась. Последняя карта: {card}."
        )
    return GameResult(
        f"🃏 Открыта карта: {card}\n"
        f"Ход {state['moves']}/{state['max_moves']}. "
        "Следующая такая же подряд — пара.",
        keyboard="play",
    )


def play_durak(state: dict, user_id: int, action: str) -> GameResult:
    if action != BTN_ATTACK:
        return GameResult(
            f"Козырь: {state['trump']}\n"
            f"Счёт — вы {state['user_wins']} : {state['bot_wins']} бот\n"
            "Нажмите «⚔ Ход» для раунда.",
            keyboard="play",
        )
    rng = _rng(user_id, f"r{state['round']}")
    uc = _deal_card(rng, state["trump"])
    bc = _deal_card(rng, state["trump"])
    state["user_card"] = uc
    state["bot_card"] = bc
    us, bs = _card_strength(uc, state["trump"]), _card_strength(bc, state["trump"])
    state["round"] += 1
    if us > bs:
        state["user_wins"] += 1
        round_msg = f"Вы: {uc}  vs  Бот: {bc}\n✅ Раунд ваш!"
    elif bs > us:
        state["bot_wins"] += 1
        round_msg = f"Вы: {uc}  vs  Бот: {bc}\n🤖 Раунд бота."
    else:
        round_msg = f"Вы: {uc}  vs  Бот: {bc}\n😐 Ничья в раунде."

    uw, bw = state["user_wins"], state["bot_wins"]
    rnd = state["round"]

    if uw >= 2:
        pts = WIN_REWARD["durak"]
        return _finish(
            f"{round_msg}\n\n🎉 Победа 2 из {DURAK_MAX_ROUNDS}!\n+{pts} очков ауры ✨",
            won=True,
            kind="durak",
            pts=pts,
        )
    if bw >= 2:
        return _finish(f"{round_msg}\n\nБот выиграл 2 из {DURAK_MAX_ROUNDS}.\nЗавтра — реванш 🌙")

    if rnd >= DURAK_MAX_ROUNDS:
        if uw > bw:
            pts = WIN_REWARD["durak"]
            return _finish(
                f"{round_msg}\n\n🎉 Счёт {uw}:{bw} — ваша победа!\n+{pts} очков ауры ✨",
                won=True,
                kind="durak",
                pts=pts,
            )
        if bw > uw:
            return _finish(
                f"{round_msg}\n\nИтог {uw}:{bw} — победа бота.\nЗавтра — реванш 🌙"
            )
        return _finish(
            f"{round_msg}\n\nИтог {uw}:{bw} — ничья.\nОчки не начислены."
        )

    return GameResult(
        f"Козырь {state['trump']}\n{round_msg}\n"
        f"Счёт {uw}:{bw} · раунд {rnd}/{DURAK_MAX_ROUNDS}",
        keyboard="durak",
    )


def _render_snake(state: dict) -> str:
    w, h = state["w"], state["h"]
    snake = set(state["snake"])
    food = state["food"]
    lines = []
    for y in range(h):
        row = []
        for x in range(w):
            if (x, y) in snake:
                row.append("🟢" if (x, y) == state["snake"][0] else "🟩")
            elif (x, y) == food:
                row.append("✨")
            else:
                row.append("⬜")
        lines.append("".join(row))
    return "\n".join(lines)


def play_snake(state: dict, user_id: int, action: str) -> GameResult:
    dirs = {
        BTN_SNAKE_UP: (0, -1),
        BTN_SNAKE_DOWN: (0, 1),
        BTN_SNAKE_LEFT: (-1, 0),
        BTN_SNAKE_RIGHT: (1, 0),
    }
    if action not in dirs:
        return GameResult(
            _render_snake(state) + f"\n\nСчёт: {state['score']}\nУправление — стрелками ⬆️⬇️⬅️➡️",
            keyboard="snake",
        )
    if not state.get("alive", True):
        return _finish("Игра уже завершена.")
    d = dirs[action]
    state["dir"] = d
    state["steps"] = state.get("steps", 0) + 1
    hx, hy = state["snake"][0]
    nx, ny = hx + d[0], hy + d[1]
    w, h = state["w"], state["h"]
    if nx < 0 or ny < 0 or nx >= w or ny >= h or (nx, ny) in state["snake"]:
        state["alive"] = False
        return _finish(
            _render_snake(state)
            + f"\n\n💥 Столкновение! Счёт: {state['score']}/{SNAKE_WIN_SCORE}.\n"
            "Очки не начислены."
        )
    state["snake"].insert(0, (nx, ny))
    if (nx, ny) == state["food"]:
        state["score"] += 1
        rng = _rng(user_id, f"f{state['score']}")
        while True:
            fx, fy = rng.randrange(w), rng.randrange(h)
            if (fx, fy) not in state["snake"]:
                state["food"] = (fx, fy)
                break
    else:
        state["snake"].pop()
    if state["score"] >= SNAKE_WIN_SCORE:
        pts = WIN_REWARD["snake"]
        return _finish(
            _render_snake(state)
            + f"\n\n🎉 Счёт {state['score']} — победа!\n+{pts} очков ауры ✨",
            won=True,
            kind="snake",
            pts=pts,
        )
    steps = state["steps"]
    max_steps = state.get("max_steps", SNAKE_MAX_STEPS)
    if steps >= max_steps:
        return _finish(
            _render_snake(state)
            + f"\n\n⏱ Лимит {max_steps} шагов. Счёт: {state['score']}/{SNAKE_WIN_SCORE}.\n"
            "Очки не начислены."
        )
    return GameResult(
        _render_snake(state)
        + f"\n\nСчёт: {state['score']}/{SNAKE_WIN_SCORE} · шаг {steps}/{max_steps}",
        keyboard="snake",
    )


def _find_matches(grid: list[list[str]]) -> set[tuple[int, int]]:
    matched: set[tuple[int, int]] = set()
    n = len(grid)
    m = len(grid[0])
    for y in range(n):
        for x in range(m - 2):
            if grid[y][x] == grid[y][x + 1] == grid[y][x + 2]:
                matched.update({(x, y), (x + 1, y), (x + 2, y)})
    for x in range(m):
        for y in range(n - 2):
            if grid[y][x] == grid[y + 1][x] == grid[y + 2][x]:
                matched.update({(x, y), (x, y + 1), (x, y + 2)})
    return matched


def _render_crystals(grid: list[list[str]], pick: tuple[int, int] | None) -> str:
    lines = []
    for y, row in enumerate(grid):
        cells = []
        for x, g in enumerate(row):
            mark = "🔸" if pick == (x, y) else ""
            cells.append(f"{mark}{g}")
        lines.append(" ".join(cells))
    return "\n".join(lines)


def _crystals_over_actions(state: dict, grid: list[list[str]]) -> GameResult | None:
    if state.get("actions", 0) >= state.get("max_actions", CRYSTALS_MAX_ACTIONS):
        msg = (
            _render_crystals(grid, state.get("pick"))
            + f"\n\n⏱ Лимит действий. Счёт: {state['score']}/{CRYSTALS_WIN_SCORE}.\n"
            "Очки не начислены."
        )
        return _finish(msg)
    return None


def play_crystals(state: dict, user_id: int, action: str) -> GameResult:
    grid = state["grid"]
    state["actions"] = state.get("actions", 0) + 1
    over = _crystals_over_actions(state, grid)
    if over:
        return over

    if action == BTN_SWAP:
        if state["pick"] is None:
            return GameResult(
                _render_crystals(grid, None) + "\n\nНажмите координату: A1–D4 (буква+цифра)",
                keyboard="crystals",
            )
        return GameResult("Сначала выберите клетку, напр. B2", keyboard="crystals")

    coord = action.strip().upper()
    if len(coord) == 2 and coord[0] in "ABCD" and coord[1] in "1234":
        x, y = ord(coord[0]) - ord("A"), int(coord[1]) - 1
        if state["pick"] is None:
            state["pick"] = (x, y)
            return GameResult(
                _render_crystals(grid, state["pick"])
                + f"\n\nВыбрано {coord}. Выберите соседнюю клетку.",
                keyboard="crystals",
            )
        x0, y0 = state["pick"]
        if abs(x - x0) + abs(y - y0) != 1:
            state["pick"] = None
            return GameResult("Клетки должны быть соседними. Выберите снова.", keyboard="crystals")
        grid[y][x], grid[y0][x0] = grid[y0][x0], grid[y][x]
        state["pick"] = None
        state["moves"] += 1
        matched = _find_matches(grid)
        gained = len(matched)
        state["score"] += gained
        msg = _render_crystals(grid, None) + f"\n\n+{gained} очков. Всего: {state['score']}"
        if state["score"] >= CRYSTALS_WIN_SCORE:
            pts = WIN_REWARD["crystals"]
            return _finish(msg + f"\n\n🎉 Победа!\n+{pts} очков ауры ✨", won=True, kind="crystals", pts=pts)
        if state["moves"] >= state["max_moves"]:
            return _finish(msg + "\n\nОбмены закончились. Победа не засчитана.")
        return GameResult(
            msg + f"\n\nОбмен {state['moves']}/{state['max_moves']}",
            keyboard="crystals",
        )

    return GameResult(
        _render_crystals(grid, state.get("pick"))
        + f"\n\nСчёт {state['score']}/{CRYSTALS_WIN_SCORE}. "
        "«🔄 Выбрать» + две соседние клетки A1–D4.",
        keyboard="crystals",
    )


def process_turn(state: dict, user_id: int, action: str) -> GameResult:
    gid = state.get("id", "")
    if gid == "casino":
        return play_casino(state, user_id, action)
    if gid == "solitaire":
        return play_solitaire(state, user_id, action)
    if gid == "durak":
        return play_durak(state, user_id, action)
    if gid == "snake":
        return play_snake(state, user_id, action)
    if gid == "crystals":
        return play_crystals(state, user_id, action)
    return GameResult("Неизвестная игра.", finished=True, keyboard="menu")
