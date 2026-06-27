"""UI нотальной карты в Telegram."""

from __future__ import annotations

from telegram import KeyboardButton, ReplyKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.numerology.notal_map.builder import build_section_message
from app.numerology.notal_map.content import section_by_index
from app.numerology.notal_map.engine import (
    NotalMapSession,
    create_session,
    current_question,
    show_questions,
)
from app.numerology.notal_map.models import NotalMapSession as SessionModel
from app.telegram.keyboards import BTN_BACK, BTN_NOTAL_MAP
BTN_NOTAL_NEXT = "▶ Следующий подраздел"
BTN_NOTAL_SUMMARY = "📋 Итог сейчас"
BTN_NOTAL_SKIP = "⏭ Пропустить вопросы"

NOTAL_NAV_BUTTONS = frozenset(
    {BTN_NOTAL_NEXT, BTN_NOTAL_SUMMARY, BTN_NOTAL_SKIP, BTN_BACK}
)

NOTAL_MENU_BUTTONS = frozenset({BTN_NOTAL_MAP, *NOTAL_NAV_BUTTONS})

ANSWER_WITH_SKIP = ReplyKeyboardMarkup(
    [
        [KeyboardButton("A"), KeyboardButton("B")],
        [KeyboardButton("C"), KeyboardButton("D")],
        [KeyboardButton(BTN_NOTAL_SKIP)],
        [KeyboardButton(BTN_BACK)],
    ],
    resize_keyboard=True,
)

NOTAL_NAV_KEYBOARD = ReplyKeyboardMarkup(
    [
        [KeyboardButton(BTN_NOTAL_NEXT)],
        [KeyboardButton(BTN_NOTAL_SUMMARY)],
        [KeyboardButton(BTN_BACK)],
    ],
    resize_keyboard=True,
)


def clear_notal_state(context: ContextTypes.DEFAULT_TYPE) -> None:
    for key in ("notal_session", "notal_charged"):
        context.user_data.pop(key, None)


def save_notal_session(context: ContextTypes.DEFAULT_TYPE, session: NotalMapSession) -> None:
    context.user_data["notal_session"] = session.to_dict()


def load_notal_session(context: ContextTypes.DEFAULT_TYPE) -> NotalMapSession | None:
    raw = context.user_data.get("notal_session")
    if not raw:
        return None
    return SessionModel.from_dict(raw)


def start_notal_session(
    context: ContextTypes.DEFAULT_TYPE,
    name: str,
    birth,
    user_id: int,
) -> NotalMapSession:
    session = create_session(name, birth, user_id)
    save_notal_session(context, session)
    context.user_data.pop("flow", None)
    context.user_data.pop("step", None)
    return session


def _format_question(session: NotalMapSession) -> str:
    q = current_question(session)
    if not q:
        return ""
    section_num = session.section_index + 1
    lines = [
        f"❓ Вопрос по подразделу {section_num}:",
        "",
        q.text,
        "",
    ]
    for opt in q.options:
        lines.append(opt.label)
    lines.extend(["", "Выберите A, B, C или D 👇"])
    return "\n".join(lines)


async def send_section_start(update: Update, session: NotalMapSession) -> None:
    """Показать предсказание подраздела и первый вопрос (если есть)."""
    text = build_section_message(session, include_question=False)
    section = section_by_index(session.section_index)
    if section and section.questions:
        show_questions(session)
        await update.message.reply_text(text)
        await update.message.reply_text(
            _format_question(session),
            reply_markup=ANSWER_WITH_SKIP,
        )
    else:
        session.phase = "nav"
        await update.message.reply_text(text, reply_markup=NOTAL_NAV_KEYBOARD)
