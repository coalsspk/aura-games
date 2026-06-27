"""Генерация карт для Mini App «Танчики» (DeepSeek + локальный fallback)."""

from __future__ import annotations

import json
import random
import re
from typing import Any

from app.ai.deepseek import DeepSeekClient
from app.config import AppConfig

TW = 13
TH = 13
VALID_CHARS = set("#.~@B")

# Классическая раскладка в духе Battle City (Dendy): игрок слева внизу, база по центру
DEFAULT_LEVEL = [
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
    "####..#B#####",
]

# Зоны, которые всегда очищаются (y, x от и до включительно)
PLAYER_ZONE = (10, 11, 1, 3)  # y0, y1, x0, x1 (не нижняя граница y=12)
ENEMY_SPAWNS = ((1, 1), (6, 1), (11, 1))
BASE_CENTER_X = 7


def finalize_map_rows(rows: list[str]) -> list[str]:
    """Гарантировать спавн игрока, врагов и базу как на Dendy."""
    grid = [list(_normalize_row(r)) for r in rows[:TH]]
    while len(grid) < TH:
        grid.append(list("." * TW))
    for y in range(TH):
        while len(grid[y]) < TW:
            grid[y].append(".")
        grid[y] = grid[y][:TW]

    for x in range(TW):
        grid[0][x] = "#"
        grid[TH - 1][x] = "#"
    for y in range(TH):
        grid[y][0] = "#"
        grid[y][TW - 1] = "#"

    y0, y1, x0, x1 = PLAYER_ZONE
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 < y < TH - 1 and 0 < x < TW - 1:
                grid[y][x] = "."

    for tx, ty in ENEMY_SPAWNS:
        if 0 < ty < TH - 1 and 0 < tx < TW - 1:
            grid[ty][tx] = "."
            for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nx, ny = tx + dx, ty + dy
                if 0 < ny < TH - 1 and 0 < nx < TW - 1:
                    if grid[ny][nx] not in "B":
                        grid[ny][nx] = "."

    bx = BASE_CENTER_X
    if 0 < bx < TW - 1:
        grid[TH - 1][bx] = "B"
        for dx in (-1, 0, 1):
            nx = bx + dx
            if 0 < nx < TW - 1:
                grid[TH - 2][nx] = "#"
        grid[TH - 2][bx] = "."

    return ["".join(r) for r in grid]


def _normalize_row(line: str) -> str:
    line = line.strip().replace(" ", "")
    if len(line) > TW:
        line = line[:TW]
    return line.ljust(TW, ".")


def validate_map(rows: list[str]) -> tuple[bool, str]:
    if len(rows) != TH:
        return False, f"нужно {TH} строк, получено {len(rows)}"
    norm = finalize_map_rows(rows)
    y0, y1, x0, x1 = PLAYER_ZONE
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if norm[y][x] in "#@":
                return False, f"зона игрока ({x},{y}) занята"
    for tx, ty in ENEMY_SPAWNS:
        if norm[ty][tx] in "#@B":
            return False, f"спавн врага ({tx},{ty}) занят"
    if sum(r.count("B") for r in norm) != 1:
        return False, "ровно одна база B"
    return True, ""


def _extract_rows_from_text(text: str) -> list[str] | None:
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            data = json.loads(m.group(0))
            rows = data.get("rows")
            if isinstance(rows, list):
                return [str(r) for r in rows]
        except json.JSONDecodeError:
            pass
    lines = []
    for line in text.splitlines():
        line = re.sub(r"[^#\.~@B]", "", line.strip())
        if len(line) >= TW:
            lines.append(line[:TW])
    if len(lines) >= TH:
        return lines[:TH]
    return None


def procedural_map(seed: int | None = None) -> list[str]:
    rng = random.Random(seed)
    rows = [list("." * TW) for _ in range(TH)]

    for _ in range(rng.randint(10, 16)):
        x = rng.randint(2, TW - 4)
        y = rng.randint(3, TH - 5)
        w = rng.randint(2, 3)
        h = rng.randint(1, 2)
        brick = rng.random() < 0.7
        for dy in range(h):
            for dx in range(w):
                nx, ny = x + dx, y + dy
                if 1 <= nx < TW - 1 and 2 <= ny < TH - 3:
                    rows[ny][nx] = "#" if brick else "@"

    if rng.random() < 0.35:
        wx = rng.randint(3, TW - 5)
        wy = rng.randint(4, TH - 6)
        rows[wy][wx] = "~"
        if wx + 1 < TW - 1:
            rows[wy][wx + 1] = "~"

    return finalize_map_rows(["".join(r) for r in rows])


def generate_map_deepseek(client: DeepSeekClient) -> list[str] | None:
    if not client.available:
        return None
    seed_hint = random.randint(1000, 99999)
    url = f"{client.base_url}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {client.api_key}",
        "Content-Type": "application/json",
    }
    from app.http_client import api_session

    payload = {
        "model": client.model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Генератор уровней Battle City 13x13. JSON: {\"rows\":[...]}. "
                    "Символы: # кирпич, @ сталь, ~ вода, . пусто, B база (одна, внизу центр). "
                    "Обязательно: клетки (1-3,10-11) и (2,10) пустые для игрока; "
                    "(1,1), (6,1), (11,1) пустые для врагов; периметр #."
                ),
            },
            {
                "role": "user",
                "content": f"Уровень seed={seed_hint}. Только JSON.",
            },
        ],
        "temperature": 0.8,
        "max_tokens": 600,
    }
    try:
        resp = api_session().post(url, headers=headers, json=payload, timeout=45)
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return None

    rows = _extract_rows_from_text(raw)
    if not rows:
        return None
    fixed = finalize_map_rows(rows)
    ok, _ = validate_map(fixed)
    if not ok:
        return None
    return fixed


def get_tanks_map(use_deepseek: bool = True) -> dict[str, Any]:
    if use_deepseek:
        cfg = AppConfig.load()
        if cfg.deepseek_api_key.strip():
            client = DeepSeekClient(
                api_key=cfg.deepseek_api_key,
                base_url=cfg.deepseek_base_url,
                model=cfg.deepseek_model,
                use_trained_knowledge=False,
                use_cache=False,
            )
            rows = generate_map_deepseek(client)
            if rows:
                return {"source": "deepseek", "rows": rows}

    seed = random.randint(0, 2_000_000_000)
    return {"source": "random", "rows": procedural_map(seed), "seed": seed}
