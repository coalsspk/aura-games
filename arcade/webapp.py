"""Обработка результатов Telegram Mini App (визуальные игры)."""

from __future__ import annotations

import json
import logging

from telegram import Update
from telegram.ext import ContextTypes

from app.storage.history import ClientHistory
from app.telegram.arcade.config import (
    GAME_IDS,
    MARIO_COINS_PER_AURA,
    PARTIAL_REWARD,
    WIN_REWARD,
)
from app.telegram.arcade.keyboards import arcade_menu_keyboard

logger = logging.getLogger(__name__)

_WEB_TO_KIND = {
    "casino": "casino",
    "snake": "snake",
    "crystals": "crystals",
    "mario": "mario",
    "poker": "poker",
    "tanks": "tanks",
    "reading": "reading",
    "community": "community",
    "hole": "hole",
    "shop": "shop",
    "dash": "dash",
    "ludus": "ludus",
    "war": "war",
    "bolt": "bolt",
    "indycat": "indycat",
    "blocks": "blocks",
    "royal": "royal",
    "zodiac_tapper": "zodiac_tapper",
}


def _mario_aura_points(data: dict) -> int:
    coins = int(data.get("coins", data.get("score", 0)) or 0)
    return max(0, coins // MARIO_COINS_PER_AURA)


def _points_for_payload(data: dict) -> tuple[bool, str, int]:
    game = str(data.get("game", ""))
    if game == "zodiac_tapper":
        hits = int(data.get("hits", data.get("score", 0)) or 0)
        pts = max(0, min(hits, 10000))
        return pts > 0, "zodiac_tapper", pts
    if game == "mario":
        pts = _mario_aura_points(data)
        return pts > 0, "mario", pts
    if game not in _WEB_TO_KIND:
        return False, "", 0
    if not data.get("won"):
        return False, game, 0
    kind = str(data.get("kind") or game)
    if game == "casino" and kind == "casino":
        pts = PARTIAL_REWARD.get("casino_partial", PARTIAL_REWARD.get("casino", 0))
    else:
        pts = WIN_REWARD.get(kind) or PARTIAL_REWARD.get(kind, 0)
    if not pts:
        pts = WIN_REWARD.get(game, 0)
    return True, kind, pts


async def handle_web_app_data(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    history: ClientHistory,
    *,
    webapp_url: str = "",
) -> None:
    user = update.effective_user
    msg = update.message
    if not user or not msg or not msg.web_app_data:
        return
    try:
        data = json.loads(msg.web_app_data.data)
    except (json.JSONDecodeError, TypeError):
        await msg.reply_text("Не удалось прочитать результат игры.")
        return

    game = str(data.get("game", ""))
    if game not in GAME_IDS:
        await msg.reply_text("Неизвестная игра.")
        return

    won, kind, pts = _points_for_payload(data)
    if game == "zodiac_tapper":
        if won and pts > 0:
            total, rubles_gained, rubles_total = history.award_zodiac_tapper_hits(
                user.id, pts
            )
            rub_line = (
                f"\n₽ +{rubles_gained} к выводу · всего {rubles_total} ₽"
                if rubles_gained
                else f"\nДо следующего рубля: {1000 - (history.get_game_progress(user.id).zodiac_tapper_hits % 1000)} ✨"
            )
            await msg.reply_text(
                "♈ Зодиак таппер — результат принят!\n"
                f"Попаданий: {pts}\n"
                f"+{pts} очков ауры ✨\n"
                f"{rub_line}\n\n"
                f"💫 На счету: {total} очков.",
                reply_markup=arcade_menu_keyboard(webapp_url),
            )
        else:
            await msg.reply_text(
                "♈ Зодиак таппер: пока нет попаданий для начисления.",
                reply_markup=arcade_menu_keyboard(webapp_url),
            )
        return

    ok, _left, err = history.try_arcade_start(user.id, game)
    if not ok:
        await msg.reply_text(err, reply_markup=arcade_menu_keyboard(webapp_url))
        return
    if game == "mario":
        coins = int(data.get("coins", data.get("score", 0)) or 0)
        if won and pts > 0:
            total = history.award_arcade_win(user.id, kind, pts)
            await msg.reply_text(
                f"🍄 Марино — партия завершена!\n"
                f"🪙 Монет: {coins}\n"
                f"+{pts} очков ауры ✨ (1 за каждые {MARIO_COINS_PER_AURA} монет)\n\n"
                f"💫 На счету: {total} очков.",
                reply_markup=arcade_menu_keyboard(webapp_url),
            )
        else:
            await msg.reply_text(
                f"🍄 Марино — партия завершена.\n"
                f"🪙 Монет: {coins}.\n"
                f"Для начисления ауры нужно собрать хотя бы {MARIO_COINS_PER_AURA} монет "
                f"(1 ✨ за {MARIO_COINS_PER_AURA} 🪙).",
                reply_markup=arcade_menu_keyboard(webapp_url),
            )
        return

    if won and pts > 0:
        total = history.award_arcade_win(user.id, kind, pts)
        await msg.reply_text(
            f"🎉 Победа в мини-приложении ({game})!\n"
            f"+{pts} очков ауры ✨\n\n💫 На счету: {total} очков.",
            reply_markup=arcade_menu_keyboard(webapp_url),
        )
    else:
        score = data.get("score", "—")
        await msg.reply_text(
            f"🏁 Партия в визуальном режиме завершена ({game}).\n"
            f"Счёт: {score}. Очки не начислены.",
            reply_markup=arcade_menu_keyboard(webapp_url),
        )
