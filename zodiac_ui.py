"""Выбор знака зодиака кнопками (без даты рождения)."""

from __future__ import annotations

from telegram import KeyboardButton, ReplyKeyboardMarkup

# Кнопки для клавиатуры (подпись → название знака)
ZODIAC_SIGN_BUTTONS: dict[str, str] = {
    "♈ Овен": "Овен",
    "♉ Телец": "Телец",
    "♊ Близнецы": "Близнецы",
    "♋ Рак": "Рак",
    "♌ Лев": "Лев",
    "♍ Дева": "Дева",
    "♎ Весы": "Весы",
    "♏ Скорпион": "Скорпион",
    "♐ Стрелец": "Стрелец",
    "♑ Козерог": "Козерог",
    "♒ Водолей": "Водолей",
    "♓ Рыбы": "Рыбы",
}

ZODIAC_CHOICE_BUTTONS = frozenset(ZODIAC_SIGN_BUTTONS.keys())

_SIGN_ALIASES: dict[str, str] = {
    "овен": "Овен",
    "телец": "Телец",
    "близнецы": "Близнецы",
    "близнец": "Близнецы",
    "рак": "Рак",
    "лев": "Лев",
    "дева": "Дева",
    "весы": "Весы",
    "скорпион": "Скорпион",
    "стрелец": "Стрелец",
    "козерог": "Козерог",
    "водолей": "Водолей",
    "рыбы": "Рыбы",
    "рыба": "Рыбы",
}


def zodiac_sign_keyboard() -> ReplyKeyboardMarkup:
    rows = [
        ["♈ Овен", "♉ Телец", "♊ Близнецы"],
        ["♋ Рак", "♌ Лев", "♍ Дева"],
        ["♎ Весы", "♏ Скорпион", "♐ Стрелец"],
        ["♑ Козерог", "♒ Водолей", "♓ Рыбы"],
    ]
    return ReplyKeyboardMarkup(
        [[KeyboardButton(t) for t in row] for row in rows],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def parse_zodiac_sign_input(text: str) -> str | None:
    t = text.strip()
    if t in ZODIAC_SIGN_BUTTONS:
        return ZODIAC_SIGN_BUTTONS[t]
    low = t.lower().lstrip("♈♉♊♋♌♍♎♏♐♑♒♓ ").strip()
    if low in _SIGN_ALIASES:
        return _SIGN_ALIASES[low]
    for name in ZODIAC_SIGN_BUTTONS.values():
        if low == name.lower():
            return name
    return None
