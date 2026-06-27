"""Свободное общение с Магистром Aura."""

from __future__ import annotations

from telegram import KeyboardButton, ReplyKeyboardMarkup

from app.telegram.keyboards import BTN_BACK

BTN_MAGISTER_DESTINY = "🔢 Судьба"
BTN_MAGISTER_FORECAST = "📅 Прогноз"
BTN_MAGISTER_COMPAT = "💑 Совместимость"
BTN_MAGISTER_NAME = "🔤 Имя"
BTN_MAGISTER_NOTAL = "🗺 Нотальная карта"
BTN_MAGISTER_EXTRA = "📚 Доп. расчёты"
BTN_MAGISTER_CHANGE_TOPIC = "🔄 Сменить тему"

MAGISTER_TOPICS: dict[str, tuple[str, str]] = {
    BTN_MAGISTER_DESTINY: ("destiny", "судьба"),
    BTN_MAGISTER_FORECAST: ("forecast", "прогноз"),
    BTN_MAGISTER_COMPAT: ("compat", "совместимость"),
    BTN_MAGISTER_NAME: ("name", "имя"),
    BTN_MAGISTER_NOTAL: ("notal_map", "нотальная карта"),
    BTN_MAGISTER_EXTRA: ("extra", "дополнительные расчёты"),
}

MAGISTER_BUTTONS = frozenset(
    {*MAGISTER_TOPICS.keys(), BTN_MAGISTER_CHANGE_TOPIC, BTN_BACK}
)


def magister_topics_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(BTN_MAGISTER_DESTINY), KeyboardButton(BTN_MAGISTER_FORECAST)],
            [KeyboardButton(BTN_MAGISTER_COMPAT), KeyboardButton(BTN_MAGISTER_NAME)],
            [KeyboardButton(BTN_MAGISTER_NOTAL), KeyboardButton(BTN_MAGISTER_EXTRA)],
            [KeyboardButton(BTN_BACK)],
        ],
        resize_keyboard=True,
    )


def magister_chat_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(BTN_MAGISTER_CHANGE_TOPIC)],
            [KeyboardButton(BTN_BACK)],
        ],
        resize_keyboard=True,
    )


def magister_intro() -> str:
    return (
        "🧙‍♂️ Магистр Aura\n\n"
        "Выберите тему, и дальше можно писать любой вопрос свободным текстом. "
        "Ответы будет готовить Aura по промпту выбранной категории."
    )


def magister_topic_prompt(title: str) -> str:
    return (
        f"Тема: {title}.\n\n"
        "Напишите вопрос Магистру одним сообщением. "
        "Можно спрашивать про себя, отношения, период, имя, карту или расчёты."
    )

