"""Telegram-бот Aura с меню и сценариями."""

from __future__ import annotations

import asyncio
import io
import logging
import socket
import sys
import threading
from datetime import date as date_type, timedelta
from typing import Callable, Optional, Set
from urllib.parse import urlparse

from telegram import InputFile, Update
from telegram.error import InvalidToken, NetworkError, TimedOut
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    PreCheckoutQueryHandler,
    filters,
)
from telegram.request import HTTPXRequest

from app.ai.deepseek import DeepSeekClient
from app.ai.conversation_training import anonymize_inputs, build_training_text
from app.ai.trainer import ScreenshotTrainer
from app.numerology import NumerologyCalculator
from app.numerology.daily_advice import build_daily_advice
from app.numerology.reports import build_report
from app.telegram.flows import (
    FLOW_COMPAT,
    FLOW_COMPAT_ZODIAC,
    FLOW_COMPAT_YEAR,
    FLOW_COMPAT_NAMES,
    FLOW_DESTINY,
    FLOW_FORECAST,
    FLOW_DAILY_ADVICE,
    FLOW_GAME_BALL,
    FLOW_GAME_LUCK,
    FLOW_NAME,
    FLOW_NOTAL_MAP,
    FLOW_TITLES,
    get_answer_key,
    get_flow_from_button,
    get_question,
    is_menu_button,
    total_steps,
)
from app.ai.response_cache import bump_bot_session
from app.config import AppConfig
from app.flow_ids import ZODIAC_ONLY_FLOWS
from app.runtime_settings import POINTS_LABEL, reload_economy
from app.storage.history import get_history
from app.storage.request_points import (
    format_begin_hint_for_quote,
    format_charge_footer,
    is_calc_flow,
)
from app.telegram.notifications import format_manual_gift_message
from app.telegram.payments import (
    on_buy_callback,
    on_pre_checkout,
    on_successful_payment,
    send_shop_menu,
)
from app.telegram.games import (
    draw_daily_card,
    draw_rune,
    energy_reading,
    format_already_card_hint,
    format_oracle_profile,
    lucky_number_ritual,
    magic_ball_answer,
    oracle_intro,
    wheel_of_fate,
)
from app.storage.user_profiles import ProfilePick
from app.telegram.profile_picker import (
    apply_profile_pick,
    build_profile_keyboard,
)
from app.telegram.keyboards import (
    BTN_PROFILE_NEW,
    BTN_BACK,
    BTN_BUY_AURA,
    BTN_DAILY_ADVICE,
    BTN_MY_BALANCE,
    BTN_GAME,
    BTN_MAGISTER,
    BTN_GAME_BALL,
    BTN_GAME_CARD,
    BTN_GAME_ENERGY,
    BTN_GAME_LUCK,
    BTN_GAME_PROFILE,
    BTN_GAME_RUNE,
    BTN_GAME_WHEEL,
    BTN_COMPAT,
    BTN_PARTNER_MATCH,
    BTN_MORE,
    BTN_QUIZ,
    BTN_NO_AI,
    BTN_ORACLE_BACK,
    BTN_REPEAT,
    MOOD_BUTTONS,
    compat_menu_keyboard,
    extra_menu_keyboard,
    game_menu_keyboard,
    main_menu_keyboard,
    mood_keyboard,
)
from app.telegram.magister_ui import (
    BTN_MAGISTER_CHANGE_TOPIC,
    MAGISTER_TOPICS,
    magister_chat_keyboard,
    magister_intro,
    magister_topic_prompt,
    magister_topics_keyboard,
)
from app.telegram.messaging import safe_reply, safe_send_document
from app.telegram.phrases import (
    advice_after_send,
    advice_already_today,
    extra_menu_intro,
    menu_fallback,
    mood_prompt,
    oracle_return,
    preparing,
    quick_calc_hint_main,
    quick_calc_on,
    quiz_done_footer,
)
from app.telegram.arcade.handlers import ArcadeHandler
from app.telegram.arcade.webapp import handle_web_app_data
from app.telegram.arcade.games import ARCADE_MENU_BUTTONS, BTN_ARCADE_MENU, GAME_BY_BUTTON
from app.telegram.quiz_ui import (
    ANSWER_BUTTONS,
    BTN_QUIZ_STOP,
    QUIZ_BUTTON_TO_ID,
    build_result,
    clear_quiz_state,
    quiz_list_keyboard,
    record_answer,
    send_current_question,
    send_quiz_intro,
    start_quiz,
)
from app.telegram.notal_map_ui import (
    ANSWER_WITH_SKIP,
    BTN_NOTAL_MAP,
    BTN_NOTAL_NEXT,
    BTN_NOTAL_SKIP,
    BTN_NOTAL_SUMMARY,
    NOTAL_NAV_KEYBOARD,
    NOTAL_NAV_BUTTONS,
    clear_notal_state,
    load_notal_session,
    save_notal_session,
    start_notal_session,
)
from app.numerology.notal_map.builder import build_final_summary, build_section_message
from app.numerology.notal_map.engine import (
    advance_section,
    record_answer as notal_record_answer,
    skip_questions,
)
from app.version import APP_VERSION

logger = logging.getLogger(__name__)


def parse_admin_ids(text: str) -> Set[int]:
    ids: set[int] = set()
    for part in (text or "").replace(";", ",").split(","):
        part = part.strip()
        if part.isdigit():
            ids.add(int(part))
    return ids

MENU, COLLECTING, QUIZ, ARCADE, NOTAL, MAGISTER = range(6)

def _proxy_scheme(proxy_url: str) -> str:
    if "://" not in proxy_url:
        return ""
    return proxy_url.split("://", 1)[0].lower()


def _normalize_proxy_url(proxy_url: str) -> str:
    """httpx не понимает socks4; на том же порту VPN обычно отдаёт SOCKS5."""
    proxy = (proxy_url or "").strip()
    if not proxy or "://" not in proxy:
        return proxy
    scheme, _, rest = proxy.partition("://")
    if scheme.lower() in ("socks4", "socks4a"):
        return f"socks5://{rest}"
    return proxy


def _proxy_setup_error(proxy_url: str, exc: BaseException) -> str:
    scheme = _proxy_scheme((proxy_url or "").strip())
    msg = str(exc)
    if "Unknown scheme for proxy" in msg:
        return (
            "Обнаружен прокси socks4:// (часто из VPN в системе).\n"
            "В поле «Прокси» укажите socks5://… и снимите галочку «Подключаться без прокси».\n"
            "Либо отключите системный прокси в настройках VPN."
        )
    if scheme in ("socks4", "socks4a"):
        return (
            "Прокси socks4:// не поддерживается напрямую.\n"
            "Укажите socks5://… (тот же хост и порт) или выполните:\n"
            'pip install "python-telegram-bot[socks]"'
        )
    if "socksio" in msg.lower() or "socks" in msg.lower():
        return (
            "Для SOCKS-прокси нужна зависимость:\n"
            'pip install "python-telegram-bot[socks]"'
        )
    return f"Ошибка настройки прокси: {exc}"


def _httpx_client_kwargs(extra: dict | None = None) -> dict:
    """Не использовать ALL_PROXY/HTTP_PROXY из окружения (VPN часто ставит socks4://127.0.0.1:…)."""
    base = {"trust_env": False}
    if extra:
        base.update(extra)
    return base


def _proxy_hostname(proxy_url: str) -> str:
    try:
        return (urlparse(proxy_url).hostname or "").lower()
    except ValueError:
        return ""


def _make_proxy_transport(proxy_url: str):
    """SOCKS-транспорт: без keep-alive (прокси рвёт соединения), DNS через прокси для удалённых хостов."""
    from httpx import Limits
    from httpx_socks import AsyncProxyTransport

    host = _proxy_hostname(proxy_url)
    rdns = host not in ("127.0.0.1", "localhost", "::1")
    limits = Limits(max_keepalive_connections=0, max_connections=24, keepalive_expiry=5.0)
    return AsyncProxyTransport.from_url(proxy_url, rdns=rdns, limits=limits)


class ResilientHTTPXRequest(HTTPXRequest):
    """Пересоздаёт HTTP-клиент при обрыве соединения через нестабильный прокси."""

    _MAX_RESETS = 5

    async def _reset_client(self) -> None:
        if not self._client.is_closed:
            await self._client.aclose()
        self._client = self._build_client()

    async def do_request(self, *args, **kwargs):
        last_err: NetworkError | None = None
        for attempt in range(self._MAX_RESETS + 1):
            try:
                return await super().do_request(*args, **kwargs)
            except NetworkError as e:
                last_err = e
                err = str(e).lower()
                if attempt >= self._MAX_RESETS or not any(
                    x in err for x in ("readerror", "connecterror", "disconnect", "broken")
                ):
                    raise
                logger.warning(
                    "Telegram: обрыв соединения (%s), переподключение %s/%s",
                    e,
                    attempt + 1,
                    self._MAX_RESETS,
                )
                await self._reset_client()
                await asyncio.sleep(2.0 * (attempt + 1))
        if last_err:
            raise last_err


def _make_request(
    proxy_url: str = "",
    read_timeout: float = 60.0,
    connect_timeout: float = 60.0,
    *,
    media_write_timeout: float = 180.0,
) -> ResilientHTTPXRequest:
    kwargs = {
        "connect_timeout": connect_timeout,
        "read_timeout": read_timeout,
        "write_timeout": max(read_timeout, 90.0),
        "pool_timeout": 30.0,
        "connection_pool_size": 8,
        "media_write_timeout": media_write_timeout,
    }
    raw = _normalize_proxy_url((proxy_url or "").strip())
    if not raw:
        return ResilientHTTPXRequest(**kwargs, httpx_kwargs=_httpx_client_kwargs())

    scheme = _proxy_scheme(raw)
    if scheme in ("socks4", "socks4a", "socks5", "socks5h"):
        try:
            import socksio  # noqa: F401

            kwargs["proxy"] = raw
            return ResilientHTTPXRequest(**kwargs, httpx_kwargs=_httpx_client_kwargs())
        except ImportError:
            pass
        try:
            return ResilientHTTPXRequest(
                **kwargs,
                httpx_kwargs=_httpx_client_kwargs(
                    {"transport": _make_proxy_transport(raw)}
                ),
            )
        except ImportError:
            kwargs["proxy"] = raw
            return ResilientHTTPXRequest(**kwargs, httpx_kwargs=_httpx_client_kwargs())

    kwargs["proxy"] = raw
    return ResilientHTTPXRequest(**kwargs, httpx_kwargs=_httpx_client_kwargs())


def _make_bot_requests(
    proxy_url: str = "",
    *,
    connect_timeout: float = 60.0,
    read_timeout: float = 60.0,
) -> tuple[ResilientHTTPXRequest, ResilientHTTPXRequest]:
    """Bot использует два HTTP-клиента; оба должны игнорировать ALL_PROXY из VPN."""
    return (
        _make_request(
            proxy_url,
            read_timeout=read_timeout,
            connect_timeout=connect_timeout,
        ),
        _make_request(
            proxy_url,
            read_timeout=max(read_timeout, 90.0),
            connect_timeout=connect_timeout,
        ),
    )


DEEPSEEK_HINTS = {
    FLOW_DESTINY: "Расчёт судьбы — квадрат Пифагора и полная консультация.",
    FLOW_COMPAT: "Совместимость двух людей по нумерологии.",
    FLOW_FORECAST: "Нумерологический прогноз — квадрат Пифагора и прогноз на год/месяц.",
    FLOW_NAME: "Расшифровка имени по нумерологии Пифагора.",
    "personal_day": "Личный день и неделя — краткая рекомендация.",
    "nine_year": "Девятилетний цикл и личные годы.",
    "pinnacles": "Пики жизни по дате рождения.",
    "karmic": "Кармические числа 13, 14, 16, 19.",
    "matrix_lines": "Линии квадрата Пифагора.",
    "destiny_matrix": "Матрица судьбы, арканы 1–22.",
    "arcana_year": "Аркан личного года.",
    "month_forecast": "Прогноз на выбранный месяц.",
    "quarter_forecast": "Прогноз на квартал.",
    "two_years": "Сравнение двух личных годов.",
    "compat_names": "Совместимость по именам.",
    FLOW_COMPAT_ZODIAC: (
        "Прогноз совместимости только по солнечным знакам зодиака. "
        "Без нумерологии, матрицы и чисел пути."
    ),
    FLOW_COMPAT_YEAR: "Совместимость по году рождения и числам.",
    FLOW_COMPAT_NAMES: "Совместимость по именам (нумерология).",
    "event_date": "Благоприятность даты события.",
    "phone": "Нумерология номера телефона.",
    "address": "Нумерология номера дома.",
    "partner_forecast": "Партнёрский прогноз на год.",
    "business": "Нумерология названия бизнеса.",
    "child": "Детская нумерологическая карта.",
    "notal_map": "Нотальная карта — пошаговый разбор с вопросами по подразделам.",
    "team": "Совместимость команды.",
}


def _event_loop_policy() -> None:
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


_COMMON_PROXY_PORTS = (
    (10808, ("socks5",)),
    (1080, ("socks5",)),
    (7890, ("http", "socks5")),
    (7891, ("http", "socks5")),
    (8080, ("http", "socks5")),
)


def _local_port_open(host: str, port: int, timeout: float = 0.4) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((host, port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def _user_report_error(exc: BaseException) -> str:
    msg = str(exc)
    if "Missing dependencies for SOCKS" in msg:
        return (
            "сбой запроса к Aura из‑за VPN-прокси в системе. "
            "Перезапустите Aura — исправление уже в программе; "
            "если повторится, отключите системный прокси на время расчёта."
        )
    if len(msg) > 300:
        return msg[:300] + "…"
    return msg


def _format_telegram_network_error(proxy_url: str, exc: BaseException) -> str:
    raw = (proxy_url or "").strip()
    text = str(exc).lower()
    if "proxyconnectionerror" in text or "could not connect to proxy" in text:
        return (
            f"Не удалось подключиться к прокси {raw}.\n"
            "Запустите VPN (V2Ray, Clash и т.п.) и проверьте порт в его настройках."
        )
    if "405" in text and "proxy" in text:
        return (
            f"Прокси {raw} отвечает, но не принимает HTTPS-туннель.\n"
            "Проверьте тип прокси в VPN (нужен SOCKS5 или HTTP CONNECT, не веб-сервер)."
        )
    if "connecterror" in text or "connection attempts failed" in text:
        if raw:
            return (
                f"Через прокси {raw} Telegram недоступен.\n"
                "Проверьте, что VPN включён и адрес прокси верный."
            )
        return (
            "Нет связи с api.telegram.org без прокси.\n"
            "В РФ Telegram часто заблокирован: включите VPN, укажите socks5://127.0.0.1:ПОРТ "
            "и снимите галочку «Подключаться без прокси»."
        )
    return f"Сеть: {exc}"


async def diagnose_telegram_connection(
    token: str,
    proxy_url: str = "",
    *,
    quick: bool = True,
) -> str:
    """Пошаговая диагностика: DNS, прямое подключение, прокси, локальные порты."""
    lines: list[str] = ["Диагностика Telegram", ""]

    if not token.strip():
        return "Токен не указан."

    try:
        ip = socket.gethostbyname("api.telegram.org")
        lines.append(f"DNS api.telegram.org -> {ip}")
    except OSError as e:
        lines.append(f"DNS: ошибка ({e})")
        lines.append("Проверьте интернет и DNS.")
        return "\n".join(lines)

    timeout = (8.0, 12.0) if quick else (60.0, 60.0)

    async def _try(label: str, proxy: str) -> tuple[bool, str]:
        ok, msg = await verify_telegram_token(
            token,
            proxy,
            connect_timeout=timeout[0],
            read_timeout=timeout[1],
        )
        lines.append(f"{label}: {'OK — ' + msg if ok else 'ошибка — ' + msg}")
        return ok, msg

    proxy = (proxy_url or "").strip()
    if proxy:
        ok, _ = await _try(f"Прокси из настроек ({proxy})", proxy)
        if ok:
            lines.append("")
            lines.append("Подключение работает с указанным прокси.")
            return "\n".join(lines)
    else:
        lines.append("Прокси в настройках: не указан")

    ok_direct, direct_msg = await _try("Без прокси", "")
    if ok_direct:
        lines.append("")
        lines.append("Достаточно подключения без прокси — VPN не обязателен.")
        return "\n".join(lines)

    direct_fail = direct_msg.lower()
    if not proxy and (
        "connecterror" in direct_fail
        or "connection attempts failed" in direct_fail
        or "таймаут" in direct_fail
        or "timed out" in direct_fail
    ):
        lines.append("")
        lines.append("Похоже на блокировку Telegram. Ищем локальный VPN…")

        open_ports = [p for p, _ in _COMMON_PROXY_PORTS if _local_port_open("127.0.0.1", p)]
        if open_ports:
            lines.append(f"Открыты порты на 127.0.0.1: {', '.join(map(str, open_ports))}")
        else:
            lines.append("Локальный прокси не найден (10808, 7890, 8080… закрыты).")
            lines.append("Запустите VPN и повторите проверку.")

        for port, schemes in _COMMON_PROXY_PORTS:
            if port not in open_ports:
                continue
            for scheme in schemes:
                url = f"{scheme}://127.0.0.1:{port}"
                ok, _ = await _try(f"Проба {url}", url)
                if ok:
                    lines.append("")
                    lines.append(f"Работает: укажите в поле «Прокси»: {url}")
                    lines.append("Снимите галочку «Подключаться без прокси».")
                    return "\n".join(lines)

    lines.append("")
    lines.append(
        "Что сделать:\n"
        "1. Запустите VPN (V2Ray / Clash / и т.д.)\n"
        "2. Скопируйте SOCKS5-адрес из настроек VPN (часто socks5://127.0.0.1:10808)\n"
        "3. Вставьте в «Прокси», отключите «Подключаться без прокси»\n"
        "4. Нажмите «Проверить токен»"
    )
    return "\n".join(lines)


def run_diagnose_telegram_connection(
    token: str,
    proxy_url: str = "",
    *,
    quick: bool = True,
) -> str:
    """Синхронная обёртка для GUI (отдельный поток, без asyncio в tk)."""
    import asyncio

    return asyncio.run(
        diagnose_telegram_connection(token, proxy_url, quick=quick)
    )


async def verify_telegram_token(
    token: str,
    proxy_url: str = "",
    *,
    connect_timeout: float = 60.0,
    read_timeout: float = 60.0,
) -> tuple[bool, str]:
    from telegram import Bot

    if not token.strip():
        return False, "Токен не указан"

    try:
        request, get_updates_request = _make_bot_requests(
            proxy_url,
            read_timeout=read_timeout,
            connect_timeout=connect_timeout,
        )
    except (ValueError, RuntimeError, ImportError) as e:
        return False, _proxy_setup_error(proxy_url, e)

    bot = Bot(
        token=token.strip(),
        request=request,
        get_updates_request=get_updates_request,
    )
    try:
        me = await bot.get_me()
        return True, f"Подключено: @{me.username} ({me.first_name})"
    except InvalidToken:
        return False, "Неверный токен. Проверьте токен у @BotFather"
    except TimedOut:
        hint = ""
        if proxy_url.strip():
            hint = (
                f"\n\nПрокси не отвечает: {proxy_url.strip()}\n"
                "Запустите VPN/прокси или очистите поле «Прокси» в программе."
            )
        return False, "Таймаут соединения с Telegram." + hint
    except NetworkError as e:
        return False, _format_telegram_network_error(proxy_url, e.__cause__ or e)
    except ValueError as e:
        msg = str(e)
        if "Unknown scheme for proxy" in msg or "proxy" in msg.lower():
            scheme = _proxy_scheme(proxy_url.strip())
            if scheme == "socks4":
                return False, (
                    "Прокси socks4:// не поддерживается httpx напрямую.\n"
                    "Варианты:\n"
                    "• pip install httpx-socks (и перезапустите программу)\n"
                    "• замените на socks5://127.0.0.1:10808 — у V2Ray/Clash обычно SOCKS5"
                )
            return False, f"Некорректный прокси: {msg}"
        return False, msg
    except RuntimeError as e:
        if "socks" in str(e).lower():
            return False, (
                "Для SOCKS5 установите зависимость:\n"
                'pip install "python-telegram-bot[socks]"'
            )
        return False, str(e)
    except Exception as e:
        return False, str(e)


class TelegramBotService:
    def __init__(
        self,
        token: str,
        use_deepseek: bool = False,
        deepseek_client: Optional[DeepSeekClient] = None,
        trainer: Optional[ScreenshotTrainer] = None,
        on_log: Optional[Callable[[str], None]] = None,
        proxy_url: str = "",
        admin_ids: Optional[Set[int]] = None,
        economy_config: AppConfig | None = None,
    ):
        reload_economy(economy_config or AppConfig.load())
        self.token = token.strip()
        self.proxy_url = proxy_url.strip()
        self.use_deepseek = use_deepseek
        self.deepseek = deepseek_client
        self.trainer = trainer or ScreenshotTrainer()
        self.on_log = on_log or (lambda msg: logger.info(msg))
        self.history = get_history()
        cfg = economy_config or AppConfig.load()
        self.arcade_web_url = getattr(cfg, "arcade_web_url", "") or ""
        self.conversation_training_enabled = bool(
            getattr(cfg, "conversation_training_enabled", True)
        )
        self.arcade = ArcadeHandler(self.history, webapp_url=self.arcade_web_url)
        self.admin_ids = admin_ids or set()

        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._app: Optional[Application] = None
        self._running = False
        self._stop_event: Optional[asyncio.Event] = None

    @property
    def is_running(self) -> bool:
        return self._running

    def send_manual_gift_notification(
        self, user_id: int, points: int, new_balance: int
    ) -> tuple[bool, str]:
        """
        Отправляет пользователю сообщение о подарке очков (из GUI).
        Возвращает (успех, текст для лога).
        """
        if not self._running or not self._loop or not self._app:
            return False, "Бот не запущен — уведомление в Telegram не отправлено."

        text = format_manual_gift_message(points, new_balance, user_id=user_id)

        async def _send() -> None:
            await self._app.bot.send_message(chat_id=user_id, text=text)

        try:
            fut = asyncio.run_coroutine_threadsafe(_send(), self._loop)
            fut.result(timeout=20)
            return True, f"Уведомление отправлено в Telegram (user {user_id})."
        except Exception as e:
            err = str(e).strip() or type(e).__name__
            return (
                False,
                f"Очки начислены, но Telegram не доставил сообщение: {err}",
            )

    def _log(self, msg: str) -> None:
        self.on_log(msg)

    def _touch_user(self, update: Update) -> None:
        user = update.effective_user
        if user:
            self.history.remember_telegram_user(
                user.id, user.username, user.first_name
            )

    async def _reply(
        self,
        update: Update,
        text: str,
        *,
        show_menu: bool = False,
    ) -> bool:
        markup = main_menu_keyboard(self.arcade_web_url) if show_menu else None
        ok = await safe_reply(update, text, reply_markup=markup)
        if not ok:
            self._log("Не удалось отправить сообщение (таймаут Telegram)")
        return ok

    async def _send_long_message(
        self, update: Update, text: str, chunk_size: int = 4000
    ) -> None:
        """Длинный отчёт: сначала текст в чате, затем файл (если прокси позволит)."""
        if len(text) <= chunk_size:
            await self._reply(update, "📝 Полный разбор:\n\n" + text, show_menu=True)
        else:
            parts: list[str] = []
            rest = text
            while rest:
                parts.append(rest[:chunk_size])
                rest = rest[chunk_size:]

            for i, part in enumerate(parts):
                chunk_prefix = f"({i + 1}/{len(parts)})\n\n" if len(parts) > 1 else ""
                if i == 0:
                    intro = (
                        f"📝 Текст разбора ({len(parts)} частей):\n\n"
                        if len(parts) > 1
                        else "📝 Полный разбор:\n\n"
                    )
                    chunk_prefix = intro + chunk_prefix
                is_last = i == len(parts) - 1
                await self._reply(update, chunk_prefix + part, show_menu=is_last)

        if len(text) > 2500 and update.message:
            buf = io.BytesIO(text.encode("utf-8"))
            buf.name = "aura_razbor.txt"
            ok = await safe_send_document(
                update,
                InputFile(buf, filename=buf.name),
                caption="📄 Файл разбора (можно сохранить)",
            )
            if not ok:
                self._log(
                    "Файл разбора не отправлен (прокси оборвал соединение) — "
                    "текст выше в чате полный."
                )

    def _reset_session(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        context.user_data.pop("flow", None)
        context.user_data.pop("step", None)
        context.user_data.pop("answers", None)
        context.user_data.pop("game_menu", None)
        context.user_data.pop("await_mood", None)
        context.user_data.pop("profile_pick_map", None)
        context.user_data.pop("profile_skip_keyboard", None)
        context.user_data.pop("quiz_menu", None)
        context.user_data.pop("arcade_state", None)
        context.user_data.pop("magister_topic", None)
        context.user_data.pop("magister_history", None)
        clear_quiz_state(context)
        clear_notal_state(context)

    async def _prompt_step(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE,
        flow: str,
        step: int,
        *,
        payment_hint: str = "",
    ) -> None:
        user = update.effective_user
        question = get_question(flow, step) or ""
        key = get_answer_key(flow, step) or ""
        answers = context.user_data.get("answers", {})

        pick_map: dict = {}
        keyboard = None
        if flow == FLOW_COMPAT_ZODIAC and key in ("sign1", "sign2"):
            from app.telegram.zodiac_ui import zodiac_sign_keyboard

            keyboard = zodiac_sign_keyboard()
            context.user_data.pop("profile_pick_map", None)
        elif user and key:
            profiles = self.history.list_saved_profiles(user.id)
            keyboard, pick_map = build_profile_keyboard(
                profiles, key, answers, flow, step
            )
        context.user_data["profile_pick_map"] = pick_map

        suffix = ""
        if pick_map:
            suffix = "\n\n📌 Или выберите сохранённые данные:"
        if step == 0:
            title = FLOW_TITLES.get(flow, "")
            intro = ""
            if flow == FLOW_COMPAT_ZODIAC:
                intro = (
                    "♈ Только знаки зодиака — выберите кнопкой.\n"
                    "Без даты рождения, нумерологии и матрицы.\n\n"
                )
            text = f"📋 {title}\n\n{intro}{question}{payment_hint}{suffix}"
        else:
            text = f"{question}{suffix}"

        if keyboard and not context.user_data.get("profile_skip_keyboard"):
            await update.message.reply_text(text, reply_markup=keyboard)
        else:
            context.user_data.pop("profile_skip_keyboard", None)
            await self._reply(update, text, show_menu=False)

    async def _advance_step(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE, flow: str, step: int
    ) -> int:
        context.user_data["step"] = step
        if step >= total_steps(flow):
            return await self._finish_flow(update, context)
        await self._prompt_step(update, context, flow, step)
        return COLLECTING

    async def _start_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        self._reset_session(context)
        self._touch_user(update)
        user = update.effective_user
        balance = ""
        if user:
            balance = self.history.format_balance_hint(user.id) + "\n\n"
        await self._reply(
            update,
            f"🔮 Добро пожаловать в Aura! (v{APP_VERSION})\n\n"
            f"{balance}"
            "Выберите действие кнопкой ниже:\n\n"
            "• Совместимость — полная, по зодиаку, году или именам\n"
            "• Нумерологический прогноз — год и месяц\n"
            "• 🗺 Нотальная карта — пошаговый разбор с вопросами\n"
            "• 🧙‍♂️ Магистр — свободное общение с Aura по темам\n"
            "• 📚 Ещё расчёты — судьба, имя, быстрый расчёт и другие темы\n"
            "• 📖 Совет дня · 💰 Мой баланс\n"
            "• 🎮 Игры — заработать очки ауры\n"
            "• ♈ Зодиак таппер — бесконечная тапалка, 1000 очков = 1 ₽ к выводу\n"
            "• 🎮 Игры за очки — казино, солитер, дурак, змейка, кристалики\n"
            "• 🧩 Тесты — три мягких опроса без даты рождения\n"
            "• Повторить последний расчёт\n\n"
            f"Расчёты — за {POINTS_LABEL} (бесплатно / игры / ⭐ Stars / 💳 карта).\n"
            "Имя и дату можно выбрать из сохранённых.\n"
            "Команды: /sovety /buy /balance /oracle /magister /tests /sudba\n"
            "Обучение AI: /ai_training_status /ai_training_on /ai_training_off\n"
            "Отмена: /cancel",
            show_menu=True,
        )
        return MENU

    async def _balance_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        user = update.effective_user
        if not user:
            return MENU
        await self._reply(
            update,
            self.history.format_balance_hint(user.id),
            show_menu=True,
        )
        return MENU

    async def _ai_training_on_cmd(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        user = update.effective_user
        if not user:
            return MENU
        if not self.conversation_training_enabled:
            await self._reply(
                update,
                "Обучение на диалогах сейчас отключено администратором.",
                show_menu=True,
            )
            return MENU
        self.history.set_training_consent(user.id, True)
        await self._reply(
            update,
            "Обучение AI включено.\n\n"
            "После расчётов бот будет локально сохранять обезличенные примеры: "
            "без Telegram ID, username, имён и дат рождения. "
            "Отключить: /ai_training_off",
            show_menu=True,
        )
        return MENU

    async def _ai_training_off_cmd(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        user = update.effective_user
        if not user:
            return MENU
        removed = self.history.delete_training_data_for_user(user.id)
        self.history.set_training_consent(user.id, False)
        await self._reply(
            update,
            "Обучение AI выключено.\n"
            f"Локальные обучающие записи пользователя удалены: {removed}.",
            show_menu=True,
        )
        return MENU

    async def _ai_training_status_cmd(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        user = update.effective_user
        if not user:
            return MENU
        enabled = self.history.has_training_consent(user.id)
        text = (
            "Обучение AI включено для ваших расчётов.\n"
            "Отключить и удалить записи: /ai_training_off"
            if enabled
            else "Обучение AI выключено.\nВключить: /ai_training_on"
        )
        await self._reply(update, text, show_menu=True)
        return MENU

    async def _buy_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        await send_shop_menu(update, context)
        return MENU

    async def _sovety_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        return await self._daily_advice_handler(update, context)

    async def _daily_advice_handler(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        user = update.effective_user
        if not user:
            return MENU
        uid = user.id
        today = date_type.today().isoformat()
        if self.history.get_last_advice_date(uid) == today:
            await self._reply(
                update,
                advice_already_today(uid),
                show_menu=True,
            )
            return MENU
        birth = self._oracle_birth(context, uid)
        if birth:
            return await self._send_daily_advice(update, context, birth)
        context.user_data.pop("game_menu", None)
        return await self._begin_flow(update, context, FLOW_DAILY_ADVICE)

    async def _send_daily_advice(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE,
        birth: date_type,
    ) -> int:
        user = update.effective_user
        if not user:
            return MENU
        name = None
        last = self.history.get_last_session(user.id)
        if last and last.answers.get("name"):
            name = str(last.answers["name"])
        text = build_daily_advice(birth, user.id, name)
        self.history.record_advice_view(user.id)
        self.history.save_oracle_birth(user.id, birth.strftime("%d.%m.%Y"))
        context.user_data["oracle_birth"] = birth
        await self._send_long_message(update, text)
        await self._reply(
            update,
            advice_after_send(user.id),
            show_menu=True,
        )
        self._reset_session(context)
        return MENU

    def _ensure_calc_access(
        self, user_id: int, flow: str, flow_title: str
    ) -> tuple[bool, str]:
        if not is_calc_flow(flow):
            return True, ""
        quote = self.history.quote_calc_request(user_id, flow, flow_title)
        if quote.allowed:
            return True, format_begin_hint_for_quote(quote, user_id)
        return False, self.history.deny_message_for(user_id, flow)

    async def _begin_flow(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE, flow: str
    ) -> int:
        user = update.effective_user
        title = FLOW_TITLES.get(flow, "")
        if user and is_calc_flow(flow):
            ok, extra = self._ensure_calc_access(user.id, flow, title)
            if not ok:
                await self._reply(update, extra, show_menu=True)
                return MENU
        else:
            extra = ""

        context.user_data["flow"] = flow
        context.user_data["step"] = 0
        context.user_data["answers"] = {}
        await self._prompt_step(update, context, flow, 0, payment_hint=extra)
        return COLLECTING

    async def _arcade_handler(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        text = (update.message.text or "").strip()
        return await self.arcade.handle(
            update,
            context,
            text,
            self._reply,
            state_arcade=ARCADE,
            state_menu=MENU,
        )

    async def _menu_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        self._touch_user(update)
        text = (update.message.text or "").strip()

        if text == BTN_BACK:
            context.user_data.pop("extra_menu", None)
            context.user_data.pop("game_menu", None)
            context.user_data.pop("quiz_menu", None)
            context.user_data.pop("compat_menu", None)
            context.user_data.pop("arcade_state", None)
            context.user_data.pop("await_mood", None)
            context.user_data.pop("magister_topic", None)
            context.user_data.pop("magister_history", None)
            clear_quiz_state(context)
            clear_notal_state(context)
            await self._reply(
                update,
                "Главное меню:",
                show_menu=True,
            )
            return MENU

        if (
            context.user_data.get("arcade_state") is not None
            or text == BTN_ARCADE_MENU
            or text in GAME_BY_BUTTON
            or text in ARCADE_MENU_BUTTONS
        ):
            return await self._arcade_handler(update, context)

        if text == BTN_MORE:
            context.user_data["extra_menu"] = True
            uid = update.effective_user.id if update.effective_user else 0
            await update.message.reply_text(
                extra_menu_intro(uid),
                reply_markup=extra_menu_keyboard(),
            )
            return MENU

        if text == BTN_QUIZ:
            context.user_data.pop("extra_menu", None)
            context.user_data.pop("game_menu", None)
            context.user_data["quiz_menu"] = True
            await update.message.reply_text(
                "🧩 Мистические тесты\n\n"
                "Три пути к себе — без даты рождения, только ваши ответы.\n"
                "Выберите тест 👇",
                reply_markup=quiz_list_keyboard(),
            )
            return MENU

        if context.user_data.get("quiz_menu"):
            if text == BTN_QUIZ_STOP:
                context.user_data.pop("quiz_menu", None)
                await self._reply(update, "Главное меню:", show_menu=True)
                return MENU
            quiz_id = QUIZ_BUTTON_TO_ID.get(text)
            if quiz_id:
                context.user_data.pop("quiz_menu", None)
                start_quiz(context, quiz_id)
                await send_quiz_intro(update, quiz_id)
                await send_current_question(update, context)
                return QUIZ

        if text == BTN_MAGISTER:
            if not (self.use_deepseek and self.deepseek and self.deepseek.available):
                await self._reply(
                    update,
                    "🧙‍♂️ Магистр работает через Aura.\n"
                    "Включите Aura и укажите API-ключ в админке.",
                    show_menu=True,
                )
                return MENU
            context.user_data.pop("extra_menu", None)
            context.user_data.pop("game_menu", None)
            context.user_data.pop("quiz_menu", None)
            context.user_data["magister_history"] = []
            await update.message.reply_text(
                magister_intro(),
                reply_markup=magister_topics_keyboard(),
            )
            return MAGISTER

        if text == BTN_GAME:
            context.user_data.pop("extra_menu", None)
            context.user_data["game_menu"] = True
            uid = update.effective_user.id if update.effective_user else 0
            await update.message.reply_text(
                oracle_intro(uid),
                reply_markup=game_menu_keyboard(),
            )
            return MENU

        if context.user_data.get("game_menu"):
            handled = await self._handle_oracle_game(update, context, text)
            if handled:
                return MENU

        if text == BTN_NO_AI:
            context.user_data["force_no_ai"] = True
            uid = update.effective_user.id if update.effective_user else 0
            if context.user_data.get("extra_menu") and update.message:
                await update.message.reply_text(
                    quick_calc_on(uid),
                    reply_markup=extra_menu_keyboard(),
                )
            else:
                await self._reply(
                    update,
                    quick_calc_hint_main(uid),
                    show_menu=True,
                )
            return MENU
        if text == BTN_REPEAT:
            return await self._repeat_last(update, context)

        if text == BTN_BUY_AURA:
            await send_shop_menu(update, context)
            return MENU

        if text == BTN_DAILY_ADVICE:
            return await self._daily_advice_handler(update, context)

        if text == BTN_MY_BALANCE:
            return await self._balance_cmd(update, context)

        if text == BTN_COMPAT:
            context.user_data.pop("extra_menu", None)
            context.user_data.pop("game_menu", None)
            context.user_data["compat_menu"] = True
            await update.message.reply_text(
                "💑 Совместимость\n\n"
                "· 💞 Подбор партнёра — опрос, какой тип вам подходит\n"
                "· Полная — матрица + зодиак + год + имена\n"
                "· ♈ По знакам — выбор знака кнопкой, без даты рождения\n"
                "· По году — пути, год рождения, личный год\n"
                "· По именам — числа выражения и души\n\n"
                "Выберите 👇",
                reply_markup=compat_menu_keyboard(),
            )
            return MENU

        if context.user_data.get("compat_menu"):
            if text == BTN_PARTNER_MATCH:
                context.user_data.pop("compat_menu", None)
                start_quiz(context, "partner_match")
                await send_quiz_intro(update, "partner_match")
                await send_current_question(update, context)
                return QUIZ
            flow = get_flow_from_button(text)
            if flow:
                context.user_data.pop("compat_menu", None)
                context.user_data.pop("game_menu", None)
                context.user_data.pop("await_mood", None)
                return await self._begin_flow(update, context, flow)

        flow = get_flow_from_button(text)
        if flow:
            context.user_data.pop("extra_menu", None)
            context.user_data.pop("game_menu", None)
            context.user_data.pop("compat_menu", None)
            context.user_data.pop("await_mood", None)
            return await self._begin_flow(update, context, flow)
        uid = update.effective_user.id if update.effective_user else 0
        await self._reply(
            update,
            menu_fallback(uid, bool(context.user_data.get("extra_menu"))),
            show_menu=not context.user_data.get("extra_menu"),
        )
        if context.user_data.get("extra_menu") and update.message:
            await update.message.reply_text(
                "Меню доп. расчётов:",
                reply_markup=extra_menu_keyboard(),
            )
        if context.user_data.get("game_menu") and update.message:
            await update.message.reply_text(
                "🎮 Игры:",
                reply_markup=game_menu_keyboard(),
            )
        return MENU

    async def _quiz_handler(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        self._touch_user(update)
        text = (update.message.text or "").strip()

        if text == BTN_QUIZ_STOP or text == BTN_BACK:
            clear_quiz_state(context)
            context.user_data.pop("quiz_menu", None)
            await self._reply(update, "Тест завершён. Главное меню:", show_menu=True)
            return MENU

        if is_menu_button(text):
            clear_quiz_state(context)
            context.user_data.pop("arcade_state", None)
            return await self._menu_handler(update, context)

        letter = text.upper()[:1]
        if letter not in ANSWER_BUTTONS:
            await self._reply(
                update,
                "Ответьте кнопкой A, B, C или D — или «⏹ Выйти из теста».",
                show_menu=False,
            )
            await send_current_question(update, context)
            return QUIZ

        done = record_answer(context, letter)
        if done:
            user = update.effective_user
            uid = user.id if user else 0
            result = build_result(context, uid)
            quiz_id = context.user_data.get("quiz_id", "")
            if user and quiz_id:
                self.history.bump_stat(f"quiz:{quiz_id}")
            clear_quiz_state(context)
            await self._send_long_message(update, result)
            await self._reply(
                update,
                quiz_done_footer(uid),
                show_menu=True,
            )
            return MENU

        await send_current_question(update, context)
        return QUIZ

    async def _cmd_tests(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        self._reset_session(context)
        context.user_data["quiz_menu"] = True
        await update.message.reply_text(
            "🧩 Мистические тесты — выберите:",
            reply_markup=quiz_list_keyboard(),
        )
        return MENU

    def _oracle_birth(
        self, context: ContextTypes.DEFAULT_TYPE, user_id: int
    ) -> date_type | None:
        birth = context.user_data.get("oracle_birth")
        if birth:
            return birth
        prog = self.history.get_game_progress(user_id)
        if prog.birth_date:
            parsed = NumerologyCalculator.parse_birth_date(prog.birth_date)
            if parsed:
                context.user_data["oracle_birth"] = parsed
                return parsed
        return None

    async def _handle_oracle_game(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE, text: str
    ) -> bool:
        """Мини-игры раздела «Игры». True если обработано."""
        user = update.effective_user
        if not user or not update.message:
            return False

        uid = user.id

        if text == BTN_ORACLE_BACK:
            context.user_data.pop("await_mood", None)
            await update.message.reply_text(
                oracle_intro(uid),
                reply_markup=game_menu_keyboard(),
            )
            return True

        if context.user_data.get("await_mood"):
            if text in MOOD_BUTTONS:
                ok, _pts = self.history.try_energy_charge(uid)
                if not ok:
                    prog = self.history.get_game_progress(uid)
                    await self._reply(
                        update,
                        "⚡ Заряд ауры уже получен сегодня.\n"
                        f"Сейчас на счету: {prog.aura_points} очков.",
                        show_menu=False,
                    )
                else:
                    await self._send_long_message(
                        update, energy_reading(text, uid)
                    )
                    self.history.bump_stat("game:energy")
                context.user_data.pop("await_mood", None)
                await update.message.reply_text(
                    "🎮 Игры:",
                    reply_markup=game_menu_keyboard(),
                )
                return True
            await update.message.reply_text(
                mood_prompt(uid),
                reply_markup=mood_keyboard(),
            )
            return True

        birth_saved = self._oracle_birth(context, uid)

        if text == BTN_GAME_PROFILE:
            prog = self.history.get_game_progress(uid)
            await self._send_long_message(update, format_oracle_profile(prog))
            await update.message.reply_text(
                "🎮 Игры:",
                reply_markup=game_menu_keyboard(),
            )
            return True

        if text == BTN_GAME_CARD:
            outcome = self.history.draw_daily_card_commit(uid)
            if not outcome.ok:
                prog = self.history.get_game_progress(uid)
                await self._reply(
                    update,
                    format_already_card_hint(prog, uid),
                    show_menu=False,
                )
            else:
                text_out = draw_daily_card(uid, birth_saved, outcome)
                self.history.bump_stat("game:card")
                await self._send_long_message(update, text_out)
            await update.message.reply_text(
                "🎮 Игры:",
                reply_markup=game_menu_keyboard(),
            )
            return True

        if text == BTN_GAME_RUNE:
            ok, left, _pts = self.history.try_draw_rune(uid)
            if not ok:
                prog = self.history.get_game_progress(uid)
                await self._reply(
                    update,
                    "ᚠ Руны на сегодня исчерпаны (3 раза).\n"
                    f"🔥 Серия карт: {prog.card_streak} дн.\n"
                    "Завтра — новые руны.",
                    show_menu=False,
                )
            else:
                await self._send_long_message(
                    update, draw_rune(uid, 3 - left)
                )
                self.history.bump_stat("game:rune")
            await update.message.reply_text(
                "🎮 Игры:",
                reply_markup=game_menu_keyboard(),
            )
            return True

        if text == BTN_GAME_ENERGY:
            prog = self.history.get_game_progress(uid)
            if prog.last_energy_date == date_type.today().isoformat():
                await self._reply(
                    update,
                    "⚡ Заряд уже принят сегодня. Завтра — новый канал.",
                    show_menu=False,
                )
                await update.message.reply_text(
                    "🎮 Игры:",
                    reply_markup=game_menu_keyboard(),
                )
                return True
            context.user_data["await_mood"] = True
            await update.message.reply_text(
                "Какое состояние сейчас? Игра подстроит заряд:",
                reply_markup=mood_keyboard(),
            )
            return True

        if text == BTN_GAME_WHEEL:
            ok, pts = self.history.try_wheel_spin(uid)
            if not ok:
                await self._reply(
                    update,
                    "🎡 Колесо чисел уже вращалось сегодня.\n"
                    f"💫 На счету: {pts} очков. Завтра будет новое число.",
                    show_menu=False,
                )
                await update.message.reply_text(
                    "🎮 Игры:",
                    reply_markup=game_menu_keyboard(),
                )
                return True
            result, frames = wheel_of_fate(uid, pts)
            for frame in frames[:-1]:
                await update.message.reply_text(frame)
                await asyncio.sleep(0.7)
            self.history.bump_stat("game:wheel")
            await self._send_long_message(update, result)
            await update.message.reply_text(
                "🎮 Игры:",
                reply_markup=game_menu_keyboard(),
            )
            return True

        if text == BTN_GAME_BALL:
            context.user_data.pop("game_menu", None)
            context.user_data.pop("await_mood", None)
            return await self._begin_flow(update, context, FLOW_GAME_BALL)

        if text == BTN_GAME_LUCK:
            context.user_data.pop("game_menu", None)
            context.user_data.pop("await_mood", None)
            return await self._begin_flow(update, context, FLOW_GAME_LUCK)

        return False

    def _restore_answers(self, raw: dict) -> dict | None:
        out: dict = {}
        date_keys = ("birth", "birth1", "birth2", "birth3", "event_date", "on_date")
        int_keys = (
            "forecast_year",
            "forecast_month",
            "quarter_start",
            "year1",
            "year2",
        )
        for key, value in raw.items():
            if key in date_keys:
                if str(value).lower() in ("сегодня", "today"):
                    from datetime import date as dt

                    out[key] = dt.today()
                    continue
                birth = NumerologyCalculator.parse_birth_date(str(value))
                if not birth:
                    return None
                out[key] = birth
            elif key in int_keys:
                try:
                    out[key] = int(value)
                except (TypeError, ValueError):
                    return None
            elif isinstance(value, (dict, list)):
                out[key] = value
            else:
                out[key] = str(value)
        return out

    async def _repeat_last(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        user = update.effective_user
        if not user:
            return MENU
        last = self.history.get_last_session(user.id)
        if not last:
            await self._reply(
                update,
                "Нет сохранённого расчёта. Сначала сделайте любой разбор.",
                show_menu=True,
            )
            return MENU
        answers = self._restore_answers(last.answers)
        if not answers:
            await self._reply(update, "Не удалось восстановить данные.", show_menu=True)
            return MENU
        ok, msg = self._ensure_calc_access(user.id, last.flow, FLOW_TITLES.get(last.flow, ""))
        if not ok:
            await self._reply(update, msg, show_menu=True)
            return MENU
        context.user_data["flow"] = last.flow
        answers["_repeat"] = True
        context.user_data["answers"] = answers
        if msg:
            await self._reply(update, msg.strip(), show_menu=False)
        return await self._finish_flow(update, context)

    def _validate_answer(self, flow: str, key: str, value: str) -> tuple[bool, str, object]:
        from datetime import date as dt

        v = value.strip()
        if key in ("birth", "birth1", "birth2", "birth3", "event_date"):
            if key == "birth3" and v in ("-", "—", "нет"):
                return True, "", None
            birth = NumerologyCalculator.parse_birth_date(v)
            if not birth:
                return False, "Неверная дата. Введите ДД.ММ.ГГГГ (например 23.03.1984):", None
            return True, "", birth
        if key == "on_date":
            if v.lower() in ("сегодня", "today", "-"):
                return True, "", dt.today()
            birth = NumerologyCalculator.parse_birth_date(v)
            if not birth:
                return False, "Дата ДД.ММ.ГГГГ или «сегодня»:", None
            return True, "", birth
        if key == "birth_optional":
            if v in ("-", "—", "нет", ""):
                return True, "", None
            birth = NumerologyCalculator.parse_birth_date(v)
            if not birth:
                return False, "ДД.ММ.ГГГГ или «-» чтобы пропустить:", None
            return True, "", birth
        if key in ("forecast_year", "year1", "year2"):
            try:
                year = int(v)
            except ValueError:
                return False, "Введите год числом (например 2026):", None
            if year < 1900 or year > 2100:
                return False, "Год от 1900 до 2100:", None
            return True, "", year
        if key == "forecast_month":
            try:
                month = int(v)
            except ValueError:
                return False, "Месяц числом 1–12:", None
            if month < 1 or month > 12:
                return False, "Месяц от 1 до 12:", None
            return True, "", month
        if key == "quarter_start":
            try:
                m = int(v)
            except ValueError:
                return False, "Укажите 1, 4, 7 или 10:", None
            if m not in (1, 4, 7, 10):
                return False, "Первый месяц квартала: 1, 4, 7 или 10:", None
            return True, "", m
        if key == "number":
            if not any(c.isdigit() for c in v):
                return False, "Введите хотя бы одну цифру:", None
            return True, "", v
        if key == "question":
            if len(v) < 3:
                return False, "Вопрос слишком короткий (минимум 3 символа):", None
            return True, "", v
        if key.startswith("name"):
            if key == "name3" and v in ("-", "—", "нет"):
                return True, "", None
            if len(v) < 2:
                return False, "Имя слишком короткое:", None
            return True, "", v
        if key in ("sign1", "sign2"):
            from app.telegram.zodiac_ui import parse_zodiac_sign_input

            sign = parse_zodiac_sign_input(v)
            if not sign:
                return (
                    False,
                    "Выберите знак кнопкой (♈ Овен … ♓ Рыбы) или введите название:",
                    None,
                )
            return True, "", sign
        if key == "company" and len(v) < 2:
            return False, "Укажите название:", None
        return True, "", v

    def _build_final_report(self, flow: str, answers: dict) -> str:
        return build_report(flow, answers)

    def _build_ai_report(self, flow: str, answers: dict) -> str:
        base = build_report(flow, answers)
        hint = DEEPSEEK_HINTS.get(flow, "Нумерологический разбор")
        uid = int(answers.get("_user_id") or 0)
        if uid:
            hint += f" Пользовательский контекст: user_salt={uid % 997}."
        if answers.get("_repeat"):
            hint += " Это повторный расчёт: не повторяй прежние формулировки."
        examples = self.trainer.get_training_context()
        return self.deepseek.generate_from_text(
            base,
            hint,
            training_examples=examples,
            flow=flow,
            variation_key=f"{flow}:{uid}:{len(str(answers))}",
            use_cache=not bool(answers.get("_repeat")),
        )

    def _record_training_example(
        self,
        user_id: int,
        flow: str,
        answers: dict,
        report_text: str,
        *,
        base_report: str = "",
    ) -> None:
        if not self.conversation_training_enabled:
            return
        if not report_text or len(report_text) < 200:
            return
        try:
            safe_text = build_training_text(flow, answers, report_text, base_report)
            row_id = self.history.record_conversation_for_training(
                user_id,
                flow,
                anonymize_inputs(answers),
                report_text,
                base_report=base_report,
            )
            if row_id:
                self.trainer.add_conversation_sample(
                    safe_text, flow=flow, source_id=row_id
                )
        except Exception:
            logger.exception("Не удалось сохранить диалог для обучения")

    def _notal_use_ai(self, context: ContextTypes.DEFAULT_TYPE) -> bool:
        return (
            self.use_deepseek
            and self.deepseek is not None
            and self.deepseek.available
            and not context.user_data.get("force_no_ai", False)
        )

    def _build_notal_section_ai(self, session) -> str:
        from app.numerology.notal_map.content import section_by_index

        base = build_section_message(session, include_question=False)
        section = section_by_index(session.section_index)
        if not section:
            return base
        task = (
            f"Нотальная карта — подраздел «{section.title}». {section.ai_hint} "
            "Сохрани числа и коды. Сделай текст персональным и поддерживающим."
        )
        return self.deepseek.generate_from_text(
            base, task, flow=f"notal_map:{section.id}"
        )

    async def _enrich_notal_section_text(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE,
        session,
    ) -> str:
        base = build_section_message(session, include_question=False)
        if not self._notal_use_ai(context):
            return base
        uid = update.effective_user.id if update.effective_user else 0
        await self._reply(update, preparing("подраздел карты", uid), show_menu=False)
        try:
            return await asyncio.to_thread(self._build_notal_section_ai, session)
        except Exception:
            logger.exception("ИИ: ошибка подраздела нотальной карты")
            return base

    async def _send_notal_section_intro(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE,
        session,
    ) -> None:
        from app.numerology.notal_map.content import section_by_index
        from app.telegram.notal_map_ui import (
            ANSWER_WITH_SKIP,
            NOTAL_NAV_KEYBOARD,
            _format_question,
        )
        from app.numerology.notal_map.engine import show_questions

        section = section_by_index(session.section_index)
        if section and section.questions:
            text = build_section_message(session, include_question=False)
            show_questions(session)
            await update.message.reply_text(text)
            await update.message.reply_text(
                _format_question(session),
                reply_markup=ANSWER_WITH_SKIP,
            )
            return

        session.phase = "nav"
        text = await self._enrich_notal_section_text(update, context, session)
        await update.message.reply_text(text, reply_markup=NOTAL_NAV_KEYBOARD)

    async def _send_notal_section_complete(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE,
        session,
    ) -> None:
        from app.telegram.notal_map_ui import NOTAL_NAV_KEYBOARD

        session.phase = "nav"
        text = await self._enrich_notal_section_text(update, context, session)
        await update.message.reply_text(text, reply_markup=NOTAL_NAV_KEYBOARD)

    async def _finish_flow(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        flow = context.user_data.get("flow", "")
        answers = dict(context.user_data.get("answers", {}))
        title = FLOW_TITLES.get(flow, "Разбор")

        uid = update.effective_user.id if update.effective_user else 0
        await self._reply(update, preparing(title, uid))

        try:
            force_no_ai = context.user_data.pop("force_no_ai", False)
            user = update.effective_user
            if user:
                answers["_user_id"] = user.id

            if flow == FLOW_GAME_BALL and user:
                ok, pts = self.history.try_ball_question(user.id)
                if not ok:
                    text = (
                        "🔮 Шар судьбы уже отвечал сегодня.\n\n"
                        f"💫 На счету: {pts} очков. Новый вопрос — завтра."
                    )
                else:
                    text = magic_ball_answer(
                        str(answers.get("question", "")), user.id, pts
                    )
                    self.history.bump_stat("game:ball")
                await self._send_long_message(update, text)
                await self._reply(
                    update,
                    oracle_return(user.id),
                    show_menu=True,
                )
                self._reset_session(context)
                return MENU

            if flow == FLOW_DAILY_ADVICE and user:
                birth = answers.get("birth")
                if birth:
                    return await self._send_daily_advice(update, context, birth)
                await self._reply(update, "Нужна дата рождения.", show_menu=True)
                self._reset_session(context)
                return MENU

            if flow == FLOW_GAME_LUCK and user:
                birth = answers.get("birth")
                ok, pts = self.history.try_luck_ritual(user.id)
                if not ok:
                    text = (
                        "🍀 Число удачи уже открыто сегодня.\n\n"
                        f"💫 На счету: {pts} очков. Завтра будет новый ритуал."
                    )
                else:
                    text = lucky_number_ritual(birth, user.id, pts)
                    self.history.bump_stat("game:luck")
                context.user_data["oracle_birth"] = birth
                if birth:
                    self.history.save_oracle_birth(
                        user.id, birth.strftime("%d.%m.%Y")
                    )
                await self._send_long_message(update, text)
                await self._reply(
                    update,
                    oracle_return(user.id),
                    show_menu=True,
                )
                self._reset_session(context)
                return MENU

            if flow == FLOW_NOTAL_MAP and user:
                return await self._start_notal_map(update, context, answers, user.id)

            use_ai = (
                self.use_deepseek
                and self.deepseek
                and self.deepseek.available
                and not force_no_ai
                and flow not in ZODIAC_ONLY_FLOWS
            )
            if use_ai:
                text = await asyncio.to_thread(self._build_ai_report, flow, answers)
                base_report_for_training = await asyncio.to_thread(
                    self._build_final_report, flow, answers
                )
            else:
                text = await asyncio.to_thread(self._build_final_report, flow, answers)
                base_report_for_training = text
                prefix = f"🔮 {title}"
                if force_no_ai:
                    prefix += " (быстрый расчёт)"
                text = f"{prefix}\n\n{text}"
            report_text_for_training = text

            footer = ""
            user = update.effective_user
            if user and is_calc_flow(flow):
                charge = self.history.commit_calc_request(user.id, flow)
                if charge:
                    footer = format_charge_footer(charge, user.id)
            if footer:
                text = text + footer

            await self._send_long_message(update, text)
            if user:
                self.history.save_session(user.id, flow, answers)
                self._record_training_example(
                    user.id,
                    flow,
                    answers,
                    report_text_for_training,
                    base_report=base_report_for_training,
                )
                self.history.bump_stat(f"flow:{flow}")
                self.history.bump_stat("reports_total")
            self._log(f"{title}: {answers}")
        except Exception as e:
            logger.exception("Ошибка отчёта")
            await self._reply(
                update,
                f"Ошибка: {_user_report_error(e)}",
                show_menu=True,
            )

        self._reset_session(context)
        return MENU

    async def _start_notal_map(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE,
        answers: dict,
        user_id: int,
    ) -> int:
        charge = self.history.commit_calc_request(user_id, FLOW_NOTAL_MAP)
        footer = format_charge_footer(charge, user_id) if charge else ""

        session = start_notal_session(
            context, answers["name"], answers["birth"], user_id
        )
        save_notal_session(context, session)

        intro = (
            f"🗺 Нотальная карта для {answers['name']}\n\n"
            "10 подразделов: предсказание → вопрос → ИИ-обогащение → следующий блок.\n"
            "Можно пропустить вопросы или перейти к итогу в любой момент."
        )
        if not self._notal_use_ai(context):
            intro = (
                f"🗺 Нотальная карта для {answers['name']}\n\n"
                "10 подразделов: предсказание → вопрос → следующий блок.\n"
                "Можно пропустить вопросы или перейти к итогу в любой момент."
            )
        if footer:
            intro += footer

        await self._reply(update, intro, show_menu=False)
        await self._send_notal_section_intro(update, context, session)
        save_notal_session(context, session)
        self.history.bump_stat(f"flow:{FLOW_NOTAL_MAP}")
        return NOTAL

    async def _finish_notal_map(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE,
        session,
        *,
        use_ai: bool = False,
    ) -> int:
        _ = use_ai
        user = update.effective_user
        uid = user.id if user else 0
        answers = {
            "name": session.name,
            "birth": session.birth,
            "_user_id": uid,
            "notal_answers": session.answers,
        }

        try:
            if self._notal_use_ai(context):
                uid = update.effective_user.id if update.effective_user else 0
                await self._reply(update, preparing("итог карты", uid), show_menu=False)
                text = await asyncio.to_thread(
                    self._build_ai_report, FLOW_NOTAL_MAP, answers
                )
                base_report_for_training = build_final_summary(session)
            else:
                text = build_final_summary(session)
                base_report_for_training = text
                if not session.completed:
                    text = (
                        f"🗺 {FLOW_TITLES.get(FLOW_NOTAL_MAP, 'Нотальная карта')}\n"
                        f"(итог по пройденным подразделам)\n\n{text}"
                    )
                else:
                    text = f"🗺 {FLOW_TITLES.get(FLOW_NOTAL_MAP, 'Нотальная карта')}\n\n{text}"

            await self._send_long_message(update, text)
            if user:
                self.history.save_session(user.id, FLOW_NOTAL_MAP, answers)
                self._record_training_example(
                    user.id,
                    FLOW_NOTAL_MAP,
                    answers,
                    text,
                    base_report=base_report_for_training,
                )
                self.history.bump_stat("reports_total")
        except Exception as e:
            logger.exception("Ошибка итога нотальной карты")
            await self._reply(
                update,
                f"Ошибка: {_user_report_error(e)}",
                show_menu=True,
            )

        clear_notal_state(context)
        return MENU

    async def _notal_handler(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        self._touch_user(update)
        text = (update.message.text or "").strip()

        if text == BTN_BACK:
            clear_notal_state(context)
            await self._reply(update, "Нотальная карта прервана. Главное меню:", show_menu=True)
            return MENU

        session = load_notal_session(context)
        if not session:
            return await self._menu_handler(update, context)

        if session.phase == "question":
            if text == BTN_NOTAL_SKIP:
                skip_questions(session)
                save_notal_session(context, session)
                await self._send_notal_section_complete(update, context, session)
                save_notal_session(context, session)
                return NOTAL

            letter = text.upper()[:1]
            if letter not in ANSWER_BUTTONS:
                await self._reply(
                    update,
                    "Ответьте кнопкой A, B, C или D — или «⏭ Пропустить вопросы».",
                    show_menu=False,
                )
                return NOTAL

            ok = notal_record_answer(session, letter)
            if ok == "invalid":
                await self._reply(update, "Выберите A, B, C или D.", show_menu=False)
                return NOTAL

            save_notal_session(context, session)

            if ok == "more":
                from app.telegram.notal_map_ui import _format_question

                q_text = _format_question(session)
                await update.message.reply_text(
                    q_text, reply_markup=ANSWER_WITH_SKIP
                )
                return NOTAL

            await self._send_notal_section_complete(update, context, session)
            save_notal_session(context, session)
            return NOTAL

        if text == BTN_NOTAL_NEXT:
            done = advance_section(session)
            save_notal_session(context, session)
            if done:
                session.completed = True
                save_notal_session(context, session)
                return await self._finish_notal_map(update, context, session)
            await self._send_notal_section_intro(update, context, session)
            save_notal_session(context, session)
            return NOTAL

        if text == BTN_NOTAL_SUMMARY:
            return await self._finish_notal_map(update, context, session)

        if text in NOTAL_NAV_BUTTONS:
            await update.message.reply_text(
                "Используйте кнопки навигации 👇",
                reply_markup=NOTAL_NAV_KEYBOARD,
            )
            return NOTAL

        await update.message.reply_text(
            "▶ Следующий подраздел · 📋 Итог · ◀️ В меню",
            reply_markup=NOTAL_NAV_KEYBOARD,
        )
        return NOTAL

    def _build_magister_reply(
        self,
        question: str,
        *,
        topic_flow: str,
        topic_title: str,
        history: list[dict[str, str]],
        user_id: int,
    ) -> str:
        examples = self.trainer.get_training_context()
        return self.deepseek.generate_chat_reply(
            question,
            topic_flow=topic_flow,
            topic_title=topic_title,
            training_examples=examples,
            history=history,
            variation_key=f"magister:{topic_flow}:{user_id}:{len(question)}",
        )

    async def _magister_handler(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        self._touch_user(update)
        text = (update.message.text or "").strip()

        if text == BTN_BACK:
            context.user_data.pop("magister_topic", None)
            context.user_data.pop("magister_history", None)
            await self._reply(update, "Главное меню:", show_menu=True)
            return MENU

        if text == BTN_MAGISTER_CHANGE_TOPIC:
            context.user_data.pop("magister_topic", None)
            await update.message.reply_text(
                "Выберите новую тему Магистра:",
                reply_markup=magister_topics_keyboard(),
            )
            return MAGISTER

        if text in MAGISTER_TOPICS:
            flow, title = MAGISTER_TOPICS[text]
            context.user_data["magister_topic"] = {"flow": flow, "title": title}
            context.user_data["magister_history"] = []
            await update.message.reply_text(
                magister_topic_prompt(title),
                reply_markup=magister_chat_keyboard(),
            )
            return MAGISTER

        if is_menu_button(text):
            context.user_data.pop("magister_topic", None)
            context.user_data.pop("magister_history", None)
            return await self._menu_handler(update, context)

        topic = context.user_data.get("magister_topic")
        if not topic:
            await update.message.reply_text(
                "Сначала выберите тему 👇",
                reply_markup=magister_topics_keyboard(),
            )
            return MAGISTER

        if len(text) < 3:
            await update.message.reply_text(
                "Напишите вопрос чуть подробнее.",
                reply_markup=magister_chat_keyboard(),
            )
            return MAGISTER

        if not (self.use_deepseek and self.deepseek and self.deepseek.available):
            await self._reply(
                update,
                "Aura сейчас недоступна. Проверьте настройки в админке.",
                show_menu=True,
            )
            context.user_data.pop("magister_topic", None)
            context.user_data.pop("magister_history", None)
            return MENU

        user = update.effective_user
        uid = user.id if user else 0
        await self._reply(update, preparing("ответ Магистра", uid), show_menu=False)

        history = list(context.user_data.get("magister_history") or [])
        try:
            answer = await asyncio.to_thread(
                self._build_magister_reply,
                text,
                topic_flow=str(topic.get("flow", "extra")),
                topic_title=str(topic.get("title", "тема")),
                history=history,
                user_id=uid,
            )
        except Exception as e:
            logger.exception("Ошибка Магистра")
            await update.message.reply_text(
                f"Магистр не смог ответить: {_user_report_error(e)}",
                reply_markup=magister_chat_keyboard(),
            )
            return MAGISTER

        history.extend(
            [
                {"role": "user", "content": text},
                {"role": "assistant", "content": answer},
            ]
        )
        context.user_data["magister_history"] = history[-8:]
        if len(answer) <= 4000:
            await update.message.reply_text(answer, reply_markup=magister_chat_keyboard())
        else:
            rest = answer
            while rest:
                part, rest = rest[:4000], rest[4000:]
                await update.message.reply_text(
                    part,
                    reply_markup=magister_chat_keyboard() if not rest else None,
                )
        await update.message.reply_text(
            "Можно задать следующий вопрос или сменить тему.",
            reply_markup=magister_chat_keyboard(),
        )
        if user:
            self.history.bump_stat(f"magister:{topic.get('flow', 'extra')}")
        return MAGISTER

    async def _collecting_handler(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        self._touch_user(update)
        text = (update.message.text or "").strip()

        if is_menu_button(text):
            return await self._menu_handler(update, context)

        flow = context.user_data.get("flow")
        if not flow:
            return await self._menu_handler(update, context)

        step = context.user_data.get("step", 0)
        key = get_answer_key(flow, step)
        if not key:
            return await self._finish_flow(update, context)

        pick_map = context.user_data.get("profile_pick_map") or {}
        if text == BTN_PROFILE_NEW:
            context.user_data.pop("profile_pick_map", None)
            context.user_data["profile_skip_keyboard"] = True
            await self._prompt_step(update, context, flow, step)
            return COLLECTING

        if text in pick_map:
            pick: ProfilePick = pick_map[text]
            answers = context.user_data.setdefault("answers", {})
            apply_profile_pick(pick, answers)
            context.user_data.pop("profile_pick_map", None)
            next_step = (
                pick.skip_to_step
                if pick.skip_to_step is not None
                else step + 1
            )
            if flow == "team" and key == "name3":
                return await self._finish_flow(update, context)
            return await self._advance_step(update, context, flow, next_step)

        ok, err, parsed = self._validate_answer(flow, key, text)
        if not ok:
            await self._reply(update, err)
            return COLLECTING

        answers = context.user_data.setdefault("answers", {})
        if key == "birth_optional" and parsed is not None:
            answers["birth"] = parsed
        elif parsed is not None or key not in ("birth3", "name3"):
            answers[key] = parsed

        if flow == "team" and key == "name3" and parsed is None:
            return await self._finish_flow(update, context)

        step += 1
        context.user_data["step"] = step

        if flow == "team" and key == "birth3" and parsed is None:
            return await self._finish_flow(update, context)

        return await self._advance_step(update, context, flow, step)

    async def _stats_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        user = update.effective_user
        if not user or user.id not in self.admin_ids:
            await self._reply(update, "Команда только для администратора.")
            return MENU
        stats = self.history.get_stats()
        if not stats:
            await self._reply(update, "Статистика пока пуста.", show_menu=True)
            return MENU
        lines = ["📊 Статистика Aura:", ""]
        for key, val in sorted(stats.items()):
            lines.append(f"· {key}: {val}")
        await self._reply(update, "\n".join(lines), show_menu=True)
        return MENU

    async def _cancel_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        self._reset_session(context)
        await self._reply(
            update,
            "Диалог отменён. Нажмите /start или выберите кнопку в меню.",
            show_menu=True,
        )
        return MENU

    async def _on_error(self, update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        err = context.error
        logger.exception("Ошибка Telegram", exc_info=err)
        self._log(f"Ошибка: {err}")
        if isinstance(update, Update) and update.message and isinstance(err, TimedOut):
            await self._reply(
                update,
                "Сервер Telegram не ответил вовремя. Попробуйте ещё раз через несколько секунд.",
            )

    def _cmd_begin(self, flow: str):
        async def handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
            return await self._begin_flow(update, context, flow)

        return handler

    async def _cmd_oracle(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        self._reset_session(context)
        self._touch_user(update)
        context.user_data["game_menu"] = True
        uid = update.effective_user.id if update.effective_user else 0
        await update.message.reply_text(
            oracle_intro(uid),
            reply_markup=game_menu_keyboard(),
        )
        return MENU

    async def _cmd_magister(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> int:
        self._reset_session(context)
        self._touch_user(update)
        if not (self.use_deepseek and self.deepseek and self.deepseek.available):
            await self._reply(
                update,
                "🧙‍♂️ Магистр работает через Aura.\n"
                "Включите Aura и укажите API-ключ в админке.",
                show_menu=True,
            )
            return MENU
        context.user_data["magister_history"] = []
        await update.message.reply_text(
            magister_intro(),
            reply_markup=magister_topics_keyboard(),
        )
        return MAGISTER

    def _build_application(self) -> Application:
        req, get_req = _make_bot_requests(self.proxy_url)
        app = (
            Application.builder()
            .token(self.token)
            .request(req)
            .get_updates_request(get_req)
            .build()
        )

        conv = ConversationHandler(
            entry_points=[
                CommandHandler("start", self._start_cmd),
                CommandHandler("sudba", self._cmd_begin(FLOW_DESTINY)),
                CommandHandler("sovmestimost", self._cmd_begin(FLOW_COMPAT)),
                CommandHandler("prognoz", self._cmd_begin(FLOW_FORECAST)),
                CommandHandler("imya", self._cmd_begin(FLOW_NAME)),
                CommandHandler("consult", self._cmd_begin(FLOW_DESTINY)),
                CommandHandler("magister", self._cmd_magister),
                CommandHandler("oracle", self._cmd_oracle),
                CommandHandler("balance", self._balance_cmd),
                CommandHandler("buy", self._buy_cmd),
                CommandHandler("ai_training_on", self._ai_training_on_cmd),
                CommandHandler("ai_training_off", self._ai_training_off_cmd),
                CommandHandler("ai_training_status", self._ai_training_status_cmd),
                CommandHandler("sovety", self._sovety_cmd),
                CommandHandler("advice", self._sovety_cmd),
                CommandHandler("tests", self._cmd_tests),
                CommandHandler("testy", self._cmd_tests),
            ],
            states={
                MENU: [
                    MessageHandler(
                        filters.TEXT & ~filters.COMMAND,
                        self._menu_handler,
                    ),
                ],
                COLLECTING: [
                    MessageHandler(
                        filters.TEXT & ~filters.COMMAND,
                        self._collecting_handler,
                    ),
                ],
                QUIZ: [
                    MessageHandler(
                        filters.TEXT & ~filters.COMMAND,
                        self._quiz_handler,
                    ),
                ],
                ARCADE: [
                    MessageHandler(
                        filters.TEXT & ~filters.COMMAND,
                        self._arcade_handler,
                    ),
                ],
                NOTAL: [
                    MessageHandler(
                        filters.TEXT & ~filters.COMMAND,
                        self._notal_handler,
                    ),
                ],
                MAGISTER: [
                    MessageHandler(
                        filters.TEXT & ~filters.COMMAND,
                        self._magister_handler,
                    ),
                ],
            },
            fallbacks=[
                CommandHandler("cancel", self._cancel_cmd),
                CommandHandler("stats", self._stats_cmd),
            ],
            allow_reentry=True,
        )

        app.add_handler(conv)

        async def _web_app_data(
            update: Update, context: ContextTypes.DEFAULT_TYPE
        ) -> None:
            await handle_web_app_data(
                update,
                context,
                self.history,
                webapp_url=self.arcade_web_url,
            )

        app.add_handler(
            MessageHandler(filters.StatusUpdate.WEB_APP_DATA, _web_app_data)
        )
        app.add_handler(CallbackQueryHandler(on_buy_callback, pattern=r"^buy:"))
        app.add_handler(PreCheckoutQueryHandler(on_pre_checkout))

        async def _paid(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
            await on_successful_payment(update, context, self)

        app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, _paid))
        app.add_error_handler(self._on_error)
        return app

    async def _shutdown_app(self) -> None:
        """Безопасное завершение (updater мог уже остановиться из‑за сети)."""
        app = self._app
        if not app:
            return
        updater = app.updater
        try:
            if getattr(updater, "running", False):
                await updater.stop()
        except RuntimeError as e:
            logger.debug("updater.stop: %s", e)
        except Exception as e:
            logger.warning("updater.stop: %s", e)
        try:
            await app.stop()
        except RuntimeError as e:
            logger.debug("app.stop: %s", e)
        except Exception as e:
            logger.warning("app.stop: %s", e)
        try:
            await app.shutdown()
        except Exception as e:
            logger.warning("app.shutdown: %s", e)

    async def _run_async(self) -> None:
        self._app = self._build_application()
        self._stop_event = asyncio.Event()

        try:
            await self._app.initialize()
            await self._app.start()
            try:
                await self._app.bot.delete_webhook(drop_pending_updates=True)
            except Exception as e:
                logger.warning("delete_webhook: %s", e)
            await self._app.updater.start_polling(
                drop_pending_updates=True,
                allowed_updates=Update.ALL_TYPES,
                poll_interval=1.0,
            )
            self._log(f"Бот слушает сообщения (polling, {__file__})...")
            await self._stop_event.wait()
        finally:
            await self._shutdown_app()

    def _run_loop(self) -> None:
        _event_loop_policy()
        loop = asyncio.new_event_loop()
        self._loop = loop
        asyncio.set_event_loop(loop)
        self._running = True

        try:
            ok, msg = loop.run_until_complete(
                verify_telegram_token(self.token, self.proxy_url)
            )
            if not ok:
                self._log(f"Ошибка: {msg}")
                return
            self._log(msg)
            loop.run_until_complete(self._run_async())
        except TimedOut:
            msg = "Таймаут Telegram. Проверьте интернет."
            if self.proxy_url:
                msg += (
                    f" Прокси {self.proxy_url} не отвечает — "
                    "запустите его или очистите поле «Прокси» во вкладке Telegram."
                )
            self._log(msg)
        except InvalidToken:
            self._log("Неверный токен бота.")
        except NetworkError as e:
            self._log(f"Ошибка сети: {e}")
        except Exception as e:
            self._log(f"Ошибка бота: {e}")
            logger.exception("Telegram bot")
        finally:
            self._running = False
            self._log("Бот остановлен")
            try:
                if loop is not None and not loop.is_closed():
                    pending = asyncio.all_tasks(loop)
                    for task in pending:
                        task.cancel()
                    if pending:
                        loop.run_until_complete(
                            asyncio.gather(*pending, return_exceptions=True)
                        )
                    loop.close()
            except Exception as e:
                logger.debug("Закрытие event loop: %s", e)
            self._loop = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            self._log("Завершение предыдущего экземпляра бота...")
            self.stop()
        if self._thread and self._thread.is_alive():
            self._log("Не удалось остановить бота — подождите и запустите снова")
            return
        bump_bot_session()
        self._thread = threading.Thread(
            target=self._run_loop, daemon=True, name="AuraTelegramBot"
        )
        self._thread.start()

    def stop(self) -> None:
        thread = self._thread
        loop = self._loop
        if not thread or not thread.is_alive():
            self._running = False
            return

        async def _graceful_stop() -> None:
            if self._stop_event and not self._stop_event.is_set():
                self._stop_event.set()

        if loop and loop.is_running():
            try:
                asyncio.run_coroutine_threadsafe(
                    _graceful_stop(), loop
                ).result(timeout=25)
            except Exception as e:
                self._log(f"Остановка: {e}")

        thread.join(timeout=30)
        if thread.is_alive():
            self._log("Предупреждение: поток бота не завершился за 30 с")
        else:
            self._thread = None
            self._loop = None
            self._app = None
            self._stop_event = None
        self._running = False

    def update_settings(
        self,
        use_deepseek: bool,
        deepseek_client: Optional[DeepSeekClient],
        proxy_url: str = "",
        arcade_web_url: str | None = None,
    ) -> None:
        self.use_deepseek = use_deepseek
        self.deepseek = deepseek_client
        if proxy_url is not None:
            self.proxy_url = proxy_url.strip()
        if arcade_web_url is not None:
            self.arcade_web_url = arcade_web_url.strip()
            self.arcade.webapp_url = self.arcade_web_url
