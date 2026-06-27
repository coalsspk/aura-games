"""Интерфейс тестов в Telegram."""

from __future__ import annotations

from telegram import KeyboardButton, ReplyKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.quizzes.engine import build_quiz_report
from app.quizzes.registry import QUIZ_MENU, get_quiz
from app.telegram.keyboards import BTN_QUIZ

BTN_QUIZ_AURA = "🌬 Код ауры"
BTN_QUIZ_FATE = "🔢 20 вопросов судьбы"
BTN_QUIZ_SHADOW = "🌓 Тень и свет"
BTN_QUIZ_PARTNER = "💞 Подбор партнёра"
BTN_QUIZ_STOP = "⏹ Выйти из теста"

QUIZ_BUTTON_TO_ID = {
    BTN_QUIZ_AURA: "aura_code",
    BTN_QUIZ_PARTNER: "partner_match",
    BTN_QUIZ_FATE: "fate_20",
    BTN_QUIZ_SHADOW: "shadow_light",
}

QUIZ_MENU_BUTTONS = frozenset(
    {
        BTN_QUIZ,
        BTN_QUIZ_AURA,
        BTN_QUIZ_FATE,
        BTN_QUIZ_SHADOW,
        BTN_QUIZ_PARTNER,
        BTN_QUIZ_STOP,
        *QUIZ_BUTTON_TO_ID.keys(),
    }
)

ANSWER_BUTTONS = ("A", "B", "C", "D")
ANSWER_KEYBOARD = ReplyKeyboardMarkup(
    [
        [KeyboardButton("A"), KeyboardButton("B")],
        [KeyboardButton("C"), KeyboardButton("D")],
        [KeyboardButton(BTN_QUIZ_STOP)],
    ],
    resize_keyboard=True,
    one_time_keyboard=True,
)


def quiz_list_keyboard() -> ReplyKeyboardMarkup:
    rows = [[KeyboardButton(label)] for _, label in QUIZ_MENU]
    rows.append([KeyboardButton(BTN_QUIZ_STOP)])
    return ReplyKeyboardMarkup(rows, resize_keyboard=True)


def format_question(quiz_id: str, step: int) -> str:
    quiz = get_quiz(quiz_id)
    if not quiz:
        return ""
    q = quiz.questions[step]
    n = quiz.total
    lines = [
        f"🧩 {quiz.title}",
        f"Вопрос {step + 1} из {n}",
        "",
        q.text,
        "",
        f"A) {q.options[0].text}",
        f"B) {q.options[1].text}",
        f"C) {q.options[2].text}",
        f"D) {q.options[3].text}",
        "",
        "Выберите A, B, C или D 👇",
    ]
    return "\n".join(lines)


def clear_quiz_state(context: ContextTypes.DEFAULT_TYPE) -> None:
    for key in ("quiz_id", "quiz_step", "quiz_picks", "quiz_menu"):
        context.user_data.pop(key, None)


def start_quiz(context: ContextTypes.DEFAULT_TYPE, quiz_id: str) -> None:
    context.user_data["quiz_id"] = quiz_id
    context.user_data["quiz_step"] = 0
    context.user_data["quiz_picks"] = []
    context.user_data.pop("quiz_menu", None)


async def send_quiz_intro(update: Update, quiz_id: str) -> None:
    quiz = get_quiz(quiz_id)
    if quiz and update.message:
        await update.message.reply_text(quiz.intro)


async def send_current_question(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    quiz_id = context.user_data.get("quiz_id")
    step = context.user_data.get("quiz_step", 0)
    if not quiz_id or not update.message:
        return
    text = format_question(quiz_id, step)
    await update.message.reply_text(text, reply_markup=ANSWER_KEYBOARD)


def record_answer(context: ContextTypes.DEFAULT_TYPE, letter: str) -> bool:
    """True если тест завершён."""
    picks: list[str] = context.user_data.setdefault("quiz_picks", [])
    picks.append(letter.upper()[:1])
    step = context.user_data.get("quiz_step", 0) + 1
    context.user_data["quiz_step"] = step
    quiz_id = context.user_data.get("quiz_id")
    quiz = get_quiz(quiz_id) if quiz_id else None
    return quiz is not None and step >= quiz.total


def build_result(
    context: ContextTypes.DEFAULT_TYPE, user_id: int = 0
) -> str:
    quiz_id = context.user_data.get("quiz_id")
    picks: list[str] = context.user_data.get("quiz_picks", [])
    quiz = get_quiz(quiz_id) if quiz_id else None
    if not quiz:
        return "Тест не найден."
    return build_quiz_report(quiz, picks, user_id=user_id)
