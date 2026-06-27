"""Клавиатуры аркады."""

from telegram import KeyboardButton, ReplyKeyboardMarkup, WebAppInfo

from app.telegram.arcade.games import (
    BTN_ARCADE_BACK,
    BTN_ARCADE_CASINO,
    BTN_ARCADE_CRYSTALS,
    BTN_ARCADE_DURAK,
    BTN_ARCADE_MENU,
    BTN_ARCADE_SNAKE,
    BTN_ARCADE_SOLITAIRE,
    BTN_ARCADE_EXIT,
    BTN_ATTACK,
    BTN_FLIP,
    BTN_SNAKE_DOWN,
    BTN_SNAKE_LEFT,
    BTN_SNAKE_RIGHT,
    BTN_SNAKE_UP,
    BTN_SPIN,
    BTN_SWAP,
)


def arcade_menu_keyboard(webapp_url: str = "") -> ReplyKeyboardMarkup:
    rows: list[list[KeyboardButton]] = []
    url = (webapp_url or "").strip()
    if url.startswith("https://"):
        rows.append(
            [KeyboardButton("🕹 Визуальные игры", web_app=WebAppInfo(url=url))]
        )
    rows.extend(
        [
            [KeyboardButton(BTN_ARCADE_CASINO), KeyboardButton(BTN_ARCADE_SOLITAIRE)],
            [KeyboardButton(BTN_ARCADE_DURAK), KeyboardButton(BTN_ARCADE_SNAKE)],
            [KeyboardButton(BTN_ARCADE_CRYSTALS)],
            [KeyboardButton(BTN_ARCADE_BACK)],
        ]
    )
    return ReplyKeyboardMarkup(rows, resize_keyboard=True)


def arcade_play_keyboard(kind: str = "play") -> ReplyKeyboardMarkup:
    if kind == "snake":
        return ReplyKeyboardMarkup(
            [
                [KeyboardButton(BTN_SNAKE_UP)],
                [KeyboardButton(BTN_SNAKE_LEFT), KeyboardButton(BTN_SNAKE_RIGHT)],
                [KeyboardButton(BTN_SNAKE_DOWN)],
                [KeyboardButton(BTN_ARCADE_EXIT)],
            ],
            resize_keyboard=True,
        )
    if kind == "crystals":
        rows = [[KeyboardButton(BTN_SWAP), KeyboardButton(BTN_ARCADE_EXIT)]]
        for r in "1234":
            rows.insert(
                -1,
                [
                    KeyboardButton(f"A{r}"),
                    KeyboardButton(f"B{r}"),
                    KeyboardButton(f"C{r}"),
                    KeyboardButton(f"D{r}"),
                ],
            )
        return ReplyKeyboardMarkup(rows, resize_keyboard=True)
    if kind == "casino":
        return ReplyKeyboardMarkup(
            [[KeyboardButton(BTN_SPIN)], [KeyboardButton(BTN_ARCADE_EXIT)]],
            resize_keyboard=True,
        )
    if kind == "durak":
        return ReplyKeyboardMarkup(
            [[KeyboardButton(BTN_ATTACK)], [KeyboardButton(BTN_ARCADE_EXIT)]],
            resize_keyboard=True,
        )
    return ReplyKeyboardMarkup(
        [[KeyboardButton(BTN_FLIP)], [KeyboardButton(BTN_ARCADE_EXIT)]],
        resize_keyboard=True,
    )
