"""Проверки Mini App лаунчера (библиотека игр, index.html, economy)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from app.telegram.arcade.config import GAME_IDS, PARTIAL_REWARD, WIN_REWARD

ARCADE_WEB = Path(__file__).resolve().parent.parent / "arcade_web"

MINI_GAME_IDS = frozenset(
    {
        "reading",
        "community",
        "hole",
        "shop",
        "dash",
        "ludus",
        "war",
        "bolt",
        "indycat",
        "blocks",
        "royal",
        "zodiac_tapper",
    }
)

LEGACY_PANEL_IDS = frozenset(
    {
        "snake",
        "crystals",
        "slots",
        "mario",
        "poker",
        "tanks",
    }
)

REQUIRED_SCRIPTS = (
    "engine.js",
    "economy.js",
    "app.js",
    "library.js",
    "mini-games.js",
    "mario.js",
    "poker.js",
    "tanks.js",
)


@dataclass(frozen=True)
class LauncherCheckResult:
    name: str
    ok: bool
    detail: str = ""


def _read(name: str) -> str:
    return (ARCADE_WEB / name).read_text(encoding="utf-8")


def _library_game_ids() -> list[str]:
    text = _read("library.js")
    return re.findall(r'\bid:\s*"([a-z_]+)"', text)


def check_index_and_library_shell() -> None:
    html = _read("index.html")
    assert 'id="library"' in html
    assert 'id="libraryGrid"' in html
    assert 'id="libraryBackBtn"' in html
    assert 'id="auraWallet"' in html
    assert 'id="minigame"' in html
    assert 'id="miniGameCanvas"' in html
    assert "window.ARCADE_BUILD" in html
    assert "Библиотека" in html


def check_script_assets_exist() -> None:
    for name in REQUIRED_SCRIPTS:
        path = ARCADE_WEB / name
        assert path.is_file(), f"нет файла {name}"


def check_script_versions_match_build() -> None:
    html = _read("index.html")
    m = re.search(r'window\.ARCADE_BUILD="([^"]+)"', html)
    assert m, "нет window.ARCADE_BUILD в index.html"
    build = m.group(1)
    for path, ver in re.findall(r'src="([^"]+\.js)\?v=([^"]+)"', html):
        assert ver == build, f"{path}: версия {ver} != {build}"


def check_library_covers_all_panels() -> None:
    html = _read("index.html")
    ids = set(_library_game_ids())
    assert len(ids) == 18

    for gid in MINI_GAME_IDS:
        assert gid in ids
        assert 'id="minigame"' in html

    for gid in LEGACY_PANEL_IDS:
        assert gid in ids
        assert f'id="{gid}"' in html, f"нет секции panel #{gid}"


def check_game_ids_registered_in_backend() -> None:
    ids = set(_library_game_ids())
    submit_ids = (ids - {"slots"}) | {"casino"}
    missing = submit_ids - set(GAME_IDS)
    assert not missing, f"нет в GAME_IDS: {sorted(missing)}"


def check_rewards_synced_with_config() -> None:
    economy = _read("economy.js")
    economy_keys = set(re.findall(r"\n\s+([a-z_]+):\s+\d+", economy))
    web_reward_keys = economy_keys | {"mario", "casino_jackpot"}

    reward_config = {**PARTIAL_REWARD, **WIN_REWARD}
    for key in web_reward_keys - {"mario"}:
        assert key in reward_config, f"нет награды в config для {key}"

    for gid in MINI_GAME_IDS:
        assert gid in WIN_REWARD, f"нет WIN_REWARD для {gid}"
        assert f"{gid}: {WIN_REWARD[gid]}" in economy


def check_engine_and_economy_exports() -> None:
    engine = _read("engine.js")
    assert "window.AuraEngine" in engine
    assert "createTabLoop" in engine
    assert "setupCanvas" in engine

    economy = _read("economy.js")
    assert "window.AuraEconomy" in economy
    assert "window.setResult" in economy
    assert "finishGame" in economy


def check_library_exports() -> None:
    lib = _read("library.js")
    assert "window.openAuraGame" in lib
    assert "window.goAuraLibrary" in lib
    assert "libraryGrid" in lib


def check_mini_games_titles() -> None:
    mini = _read("mini-games.js")
    for gid in MINI_GAME_IDS:
        assert f"{gid}:" in mini, f"нет TITLES для {gid} в mini-games.js"


LAUNCHER_CHECKS: tuple[tuple[str, object], ...] = (
    ("index и библиотека", check_index_and_library_shell),
    ("файлы скриптов", check_script_assets_exist),
    ("версии ?v= и ARCADE_BUILD", check_script_versions_match_build),
    ("17 игр и панели", check_library_covers_all_panels),
    ("GAME_IDS на бэкенде", check_game_ids_registered_in_backend),
    ("награды economy и config", check_rewards_synced_with_config),
    ("экспорты engine и economy", check_engine_and_economy_exports),
    ("экспорты library.js", check_library_exports),
    ("заголовки mini-games", check_mini_games_titles),
)


def run_launcher_checks() -> list[LauncherCheckResult]:
    results: list[LauncherCheckResult] = []
    for name, fn in LAUNCHER_CHECKS:
        try:
            fn()
            results.append(LauncherCheckResult(name, True))
        except AssertionError as exc:
            results.append(LauncherCheckResult(name, False, str(exc) or "ошибка"))
        except OSError as exc:
            results.append(LauncherCheckResult(name, False, str(exc)))
    return results


def format_launcher_report(results: list[LauncherCheckResult]) -> str:
    lines = ["Проверка лаунчера Mini App (arcade_web)", ""]
    passed = sum(1 for r in results if r.ok)
    for r in results:
        mark = "OK" if r.ok else "FAIL"
        line = f"[{mark}] {r.name}"
        if r.detail:
            line += f" — {r.detail}"
        lines.append(line)
    lines.append("")
    lines.append(f"Итого: {passed}/{len(results)}")
    return "\n".join(lines)
