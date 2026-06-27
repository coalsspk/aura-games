"""Покупка очков ауры: Telegram Stars (XTR) и карта RUB (Мир, Visa, MC через провайдера)."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Literal

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, LabeledPrice, Update
from telegram.ext import ContextTypes

from app.aura_shop import AuraShopPackage
from app.runtime_settings import POINTS_LABEL, get_economy
from app.storage.history import get_history

if TYPE_CHECKING:
    from app.telegram.bot import TelegramBotService

logger = logging.getLogger(__name__)

PayKind = Literal["stars", "card"]
CALLBACK_PREFIX = "buy:"


def shop_intro_text() -> str:
    econ = get_economy()
    lines = [
        f"💳 ПОКУПКА {POINTS_LABEL.upper()}",
        "",
        "После оплаты очки зачисляются автоматически.",
        "",
    ]
    if econ.active_stars_packages:
        lines.append("⭐ Telegram Stars — кнопки со звёздочкой")
    if econ.active_card_packages:
        lines.append("💳 Карта (Мир, Visa, MasterCard) — кнопки с ₽")
        lines.append("(через платёжный провайдер в BotFather)")
    if not econ.any_payment_enabled:
        lines.append("Оплата отключена. Настройте в программе Aura.")
    else:
        lines.extend(["", "Выберите пакет и способ оплаты:"])
    return "\n".join(lines)


def build_shop_inline_keyboard() -> InlineKeyboardMarkup | None:
    econ = get_economy()
    rows: list[list[InlineKeyboardButton]] = []

    for p in econ.active_stars_packages[:6]:
        rows.append(
            [
                InlineKeyboardButton(
                    p.button_label_stars(),
                    callback_data=f"{CALLBACK_PREFIX}stars:{p.id}",
                )
            ]
        )
    for p in econ.active_card_packages[:6]:
        rows.append(
            [
                InlineKeyboardButton(
                    p.button_label_card(),
                    callback_data=f"{CALLBACK_PREFIX}card:{p.id}",
                )
            ]
        )
    if not rows:
        return None
    return InlineKeyboardMarkup(rows)


async def send_shop_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    econ = get_economy()
    if not econ.any_payment_enabled:
        await update.effective_message.reply_text(
            "Покупка очков ауры сейчас недоступна.\n"
            "Администратор может включить Stars или оплату картой в программе Aura."
        )
        return
    kb = build_shop_inline_keyboard()
    await update.effective_message.reply_text(
        shop_intro_text(),
        reply_markup=kb,
    )


def find_package(pack_id: str) -> AuraShopPackage | None:
    for p in get_economy().shop_packages:
        if p.id == pack_id and p.enabled:
            return p
    return None


def make_payload(kind: PayKind, pack_id: str, user_id: int) -> str:
    return f"aura_{kind}:{pack_id}:{user_id}"


def parse_payload(payload: str) -> tuple[PayKind, str, int] | None:
    for kind in ("stars", "card"):
        prefix = f"aura_{kind}:"
        if not payload.startswith(prefix):
            continue
        parts = payload.split(":")
        if len(parts) != 3:
            return None
        try:
            return kind, parts[1], int(parts[2])
        except ValueError:
            return None
    return None


async def send_package_invoice(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    kind: PayKind,
    pack_id: str,
) -> None:
    econ = get_economy()
    pack = find_package(pack_id)
    user = update.effective_user
    chat = update.effective_chat
    if user:
        get_history().remember_telegram_user(user.id, user.username, user.first_name)
    if not pack or not user or not chat:
        await update.effective_message.reply_text("Пакет не найден.")
        return

    if kind == "stars":
        if not econ.stars_enabled or pack.stars <= 0:
            await update.effective_message.reply_text("Оплата Stars недоступна.")
            return
        await context.bot.send_invoice(
            chat_id=chat.id,
            title=pack.title,
            description=f"{POINTS_LABEL.capitalize()} для расчётов Aura",
            payload=make_payload("stars", pack.id, user.id),
            currency="XTR",
            prices=[LabeledPrice(pack.title, pack.stars)],
        )
        return

    if not econ.card_enabled or not econ.payment_provider_token:
        await update.effective_message.reply_text(
            "Оплата картой не настроена.\n"
            "В программе Aura: включите «карта Мир» и укажите provider token из @BotFather."
        )
        return
    if pack.rub <= 0:
        await update.effective_message.reply_text("Для этого пакета цена в рублях не задана.")
        return

    await context.bot.send_invoice(
        chat_id=chat.id,
        title=pack.title,
        description=f"{POINTS_LABEL.capitalize()} · оплата картой (в т.ч. Мир)",
        payload=make_payload("card", pack.id, user.id),
        provider_token=econ.payment_provider_token,
        currency="RUB",
        prices=[LabeledPrice(pack.title, pack.rub_kopecks)],
        need_name=False,
        need_phone_number=False,
        need_email=False,
        need_shipping_address=False,
        is_flexible=False,
    )


async def on_buy_callback(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
) -> None:
    query = update.callback_query
    if not query or not query.data or not query.data.startswith(CALLBACK_PREFIX):
        return
    await query.answer()
    rest = query.data[len(CALLBACK_PREFIX) :]
    parts = rest.split(":", 1)
    if len(parts) != 2:
        return
    kind, pack_id = parts[0], parts[1]
    if kind not in ("stars", "card"):
        return
    await send_package_invoice(update, context, kind, pack_id)  # type: ignore[arg-type]


async def on_pre_checkout(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
) -> None:
    query = update.pre_checkout_query
    if not query:
        return
    parsed = parse_payload(query.invoice_payload or "")
    if not parsed:
        await query.answer(ok=False, error_message="Неверный заказ")
        return
    kind, pack_id, uid = parsed
    pack = find_package(pack_id)
    if not pack:
        await query.answer(ok=False, error_message="Пакет недоступен")
        return
    if query.from_user and query.from_user.id != uid:
        await query.answer(ok=False, error_message="Заказ привязан к другому пользователю")
        return

    if kind == "stars":
        if query.currency != "XTR" or query.total_amount != pack.stars:
            await query.answer(ok=False, error_message="Сумма Stars не совпадает")
            return
    else:
        if query.currency != "RUB" or query.total_amount != pack.rub_kopecks:
            await query.answer(ok=False, error_message="Сумма в рублях не совпадает")
            return
    await query.answer(ok=True)


async def on_successful_payment(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    service: "TelegramBotService",
) -> None:
    msg = update.message
    user = update.effective_user
    if not msg or not msg.successful_payment or not user:
        return
    service.history.remember_telegram_user(user.id, user.username, user.first_name)
    pay = msg.successful_payment
    parsed = parse_payload(pay.invoice_payload or "")
    if not parsed:
        await msg.reply_text("Оплата получена, но заказ не распознан. Напишите администратору.")
        return
    kind, pack_id, uid = parsed
    if user.id != uid:
        await msg.reply_text("Ошибка: пользователь не совпадает с заказом.")
        return
    pack = find_package(pack_id)
    if not pack:
        await msg.reply_text("Пакет не найден.")
        return

    pay_amount = pack.stars if kind == "stars" else pack.rub_kopecks
    charge_id = pay.telegram_payment_charge_id
    balance, is_new = service.history.add_aura_points_purchase(
        user.id,
        pack.points,
        charge_id,
        pack.id,
        pay_amount,
        payment_kind=kind,
    )
    if kind == "stars":
        paid_line = f"⭐ Оплачено: {pack.stars} Stars"
    else:
        paid_line = f"💳 Оплачено: {pack.rub} ₽ (карта)"

    if is_new:
        await msg.reply_text(
            f"✅ Зачислено {pack.points} {POINTS_LABEL}!\n\n"
            f"{paid_line}\n"
            f"💫 На счету: {balance} {POINTS_LABEL}\n\n"
            "Можно делать расчёты в главном меню."
        )
        service._log(f"Pay {kind}: user {user.id} +{pack.points} ({pack.id})")
    else:
        await msg.reply_text(
            f"Оплата уже учтена.\n💫 На счету: {balance} {POINTS_LABEL}."
        )
