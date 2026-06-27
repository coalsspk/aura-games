"""Надёжная отправка сообщений в Telegram (повторы при таймауте)."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from telegram import InputFile, ReplyKeyboardMarkup, Update
from telegram.error import NetworkError, RetryAfter, TimedOut

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
MAX_FILE_RETRIES = 7


def _retry_delay(attempt: int, err: str) -> float:
    wait = 3.0 * (attempt + 1)
    if "readerror" in err or "connecterror" in err:
        wait = max(wait, 6.0)
    return wait


async def _send_with_retries(send_coro_factory, label: str) -> bool:
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            await send_coro_factory()
            return True
        except RetryAfter as e:
            wait = float(e.retry_after) + 1
            logger.warning("Telegram flood control (%s), ждём %s с", label, wait)
            await asyncio.sleep(wait)
            last_error = e
        except (TimedOut, NetworkError) as e:
            last_error = e
            wait = _retry_delay(attempt, str(e).lower())
            logger.warning(
                "Telegram %s retry %s/%s: %s", label, attempt + 1, MAX_RETRIES, e
            )
            await asyncio.sleep(wait)
        except Exception:
            logger.exception("Telegram %s failed", label)
            raise
    logger.error(
        "Не удалось выполнить %s после %s попыток: %s", label, MAX_RETRIES, last_error
    )
    return False


async def safe_reply(
    update: Update,
    text: str,
    reply_markup: Optional[ReplyKeyboardMarkup] = None,
) -> bool:
    """
    Отправить ответ с повторами. Возвращает True при успехе.
    reply_markup передавайте только когда нужно показать/обновить меню.
    """
    if not update.message:
        return False

    chat_id = update.effective_chat.id
    bot = update.get_bot()

    return await _send_with_retries(
        lambda: bot.send_message(
            chat_id=chat_id, text=text, reply_markup=reply_markup
        ),
        "send_message",
    )


async def safe_send_document(
    update: Update,
    document: InputFile,
    *,
    caption: str | None = None,
) -> bool:
    """Отправить файл с повторами (нестабильный SOCKS часто рвёт upload)."""
    if not update.message:
        return False

    last_error: Exception | None = None
    for attempt in range(MAX_FILE_RETRIES):
        try:
            await update.message.reply_document(
                document=document, caption=caption
            )
            return True
        except RetryAfter as e:
            wait = float(e.retry_after) + 1
            logger.warning("Telegram flood control (document), ждём %s с", wait)
            await asyncio.sleep(wait)
            last_error = e
        except (TimedOut, NetworkError) as e:
            last_error = e
            wait = _retry_delay(attempt, str(e).lower())
            logger.warning(
                "Telegram document retry %s/%s: %s",
                attempt + 1,
                MAX_FILE_RETRIES,
                e,
            )
            await asyncio.sleep(wait)
        except Exception:
            logger.exception("Telegram document send failed")
            raise

    logger.error(
        "Не удалось отправить файл после %s попыток: %s",
        MAX_FILE_RETRIES,
        last_error,
    )
    return False
