"""Уведомления пользователям Telegram (подарки, начисления)."""

from __future__ import annotations

from app.numerology.interpretations import pick_fresh
from app.runtime_settings import POINTS_LABEL

_GIFT_BODIES = (
    "Вселенная передала вам знак внимания — очки уже на счету.",
    "Кто-то из хранителей Aura открыл для вас поток энергии.",
    "Подарок созвучен с вашим путём — используйте его мудро.",
)


def format_manual_gift_message(
    points: int,
    balance: int,
    *,
    user_id: int = 0,
) -> str:
    tail = pick_fresh(user_id, "gift_manual", list(_GIFT_BODIES))
    word = "очко" if points % 10 == 1 and points % 100 != 11 else (
        "очка" if 2 <= points % 10 <= 4 and (points % 100 < 10 or points % 100 >= 20) else "очков"
    )
    return (
        "✨ ПОДАРОК ОТ AURA\n\n"
        f"Вам начислено {points} {word} ауры.\n"
        f"{tail}\n\n"
        f"💫 На счету: {balance} {POINTS_LABEL}.\n\n"
        "Расчёты — в главном меню · «💰 Мой баланс» — проверить счёт."
    )
