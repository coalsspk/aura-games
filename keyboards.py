"""Клавиатуры Telegram-бота."""

from telegram import KeyboardButton, ReplyKeyboardMarkup, WebAppInfo

from app.telegram.arcade.games import BTN_ARCADE_MENU

BTN_DESTINY = "Рассчитать судьбу"
BTN_COMPAT = "Совместимость"
BTN_COMPAT_FULL = "💑 Полная пара"
BTN_COMPAT_ZODIAC = "♈ По знакам зодиака"
BTN_COMPAT_YEAR = "📅 По году рождения"
BTN_COMPAT_NAMES_BTN = "💬 По именам"
BTN_PARTNER_MATCH = "💞 Подбор партнёра"
BTN_FORECAST = "Нумерологический прогноз"
BTN_NAME = "Расшифровать имя"
BTN_NO_AI = "⚡ Быстрый расчёт"
BTN_REPEAT = "Повторить последний"
BTN_MORE = "📚 Ещё расчёты"
BTN_GAME = "🎮 Игры"
BTN_ZODIAC_TAPPER = "♈ Зодиак таппер"
BTN_MAGISTER = "🧙‍♂️ Магистр"
BTN_BUY_AURA = "💫 Купить очки ауры"
BTN_DAILY_ADVICE = "📖 Совет дня"
BTN_MY_BALANCE = "💰 Мой баланс"
BTN_QUIZ = "🧩 Тесты"
BTN_BACK = "◀️ Главное меню"

# Игры / мини-игры
BTN_GAME_CARD = "🃏 Карта дня"
BTN_GAME_BALL = "🔮 Шар судьбы"
BTN_GAME_LUCK = "🍀 Число удачи"
BTN_GAME_WHEEL = "🎡 Колесо чисел"
BTN_GAME_RUNE = "ᚠ Руна момента"
BTN_GAME_ENERGY = "⚡ Заряд ауры"
BTN_GAME_PROFILE = "📊 Мой путь"
BTN_ORACLE_BACK = "◀️ К играм"
BTN_PROFILE_NEW = "✏️ Ввести новые данные"

BTN_MOOD_CALM = "🕯 Спокойствие"
BTN_MOOD_FIRE = "🔥 Драйв"
BTN_MOOD_LOVE = "💫 Любовь"
BTN_MOOD_SAD = "🌊 Грусть"
BTN_MOOD_ANXIETY = "⚡ Тревога"

MOOD_BUTTONS = (
    BTN_MOOD_CALM,
    BTN_MOOD_FIRE,
    BTN_MOOD_LOVE,
    BTN_MOOD_SAD,
    BTN_MOOD_ANXIETY,
)

# Дополнительные сценарии
BTN_DAY = "Личный день"
BTN_CYCLE9 = "9-летний цикл"
BTN_PINNACLES = "Пики жизни"
BTN_KARMIC = "Кармические числа"
BTN_LINES = "Линии матрицы"
BTN_D_MATRIX = "Матрица судьбы"
BTN_ARCANA = "Аркан года"
BTN_MONTH = "Прогноз на месяц"
BTN_QUARTER = "Прогноз на квартал"
BTN_2YEARS = "Сравнение двух лет"
BTN_COMPAT_NAME = "Совместимость имён"
BTN_EVENT = "Дата события"
BTN_PHONE = "Номер телефона"
BTN_ADDRESS = "Номер дома"
BTN_PARTNER = "Партнёрский год"
BTN_BUSINESS = "Название бизнеса"
BTN_CHILD = "Детская карта"
BTN_NOTAL_MAP = "🗺 Нотальная карта"
BTN_TEAM = "Команда (2–3)"

MENU_BUTTONS = (
    BTN_COMPAT,
    BTN_FORECAST,
    BTN_NOTAL_MAP,
    BTN_REPEAT,
    BTN_MORE,
    BTN_GAME,
    BTN_ZODIAC_TAPPER,
    BTN_MAGISTER,
    BTN_BUY_AURA,
    BTN_DAILY_ADVICE,
    BTN_MY_BALANCE,
    BTN_QUIZ,
    BTN_BACK,
)

GAME_MENU_BUTTONS = (
    BTN_GAME_CARD,
    BTN_GAME_BALL,
    BTN_GAME_LUCK,
    BTN_GAME_WHEEL,
    BTN_GAME_RUNE,
    BTN_GAME_ENERGY,
    BTN_GAME_PROFILE,
    BTN_ORACLE_BACK,
    BTN_ARCADE_MENU,
    BTN_BACK,
)

EXTRA_MENU_BUTTONS = (
    BTN_DESTINY,
    BTN_NAME,
    BTN_NO_AI,
    BTN_DAY,
    BTN_CYCLE9,
    BTN_PINNACLES,
    BTN_KARMIC,
    BTN_LINES,
    BTN_D_MATRIX,
    BTN_ARCANA,
    BTN_MONTH,
    BTN_QUARTER,
    BTN_2YEARS,
    BTN_COMPAT_NAME,
    BTN_EVENT,
    BTN_PHONE,
    BTN_ADDRESS,
    BTN_PARTNER,
    BTN_BUSINESS,
    BTN_CHILD,
    BTN_TEAM,
    BTN_BACK,
)

MENU_COMMANDS = {
    BTN_DESTINY: "sudba",
    BTN_COMPAT: "sovmestimost",
    BTN_FORECAST: "prognoz",
    BTN_NAME: "imya",
}


def compat_menu_keyboard() -> ReplyKeyboardMarkup:
    """Подменю совместимости."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(BTN_COMPAT_FULL)],
            [KeyboardButton(BTN_PARTNER_MATCH)],
            [KeyboardButton(BTN_COMPAT_ZODIAC), KeyboardButton(BTN_COMPAT_YEAR)],
            [KeyboardButton(BTN_COMPAT_NAMES_BTN)],
            [KeyboardButton(BTN_BACK)],
        ],
        resize_keyboard=True,
        is_persistent=True,
    )


def _with_query(url: str, query: str) -> str:
    if "?" in url:
        sep = "&" if not url.endswith(("&", "?")) else ""
        return f"{url}{sep}{query}"
    return f"{url.rstrip('/')}/?{query}"


def main_menu_keyboard(webapp_url: str = "") -> ReplyKeyboardMarkup:
    """Главное меню: день → расчёты → мистика → очки → каталог."""
    rows = [
        [KeyboardButton(BTN_DAILY_ADVICE), KeyboardButton(BTN_MY_BALANCE)],
        [KeyboardButton(BTN_COMPAT), KeyboardButton(BTN_FORECAST)],
        [KeyboardButton(BTN_NOTAL_MAP)],
        [KeyboardButton(BTN_MAGISTER)],
    ]
    url = (webapp_url or "").strip()
    if url.startswith("https://"):
        rows.append(
            [
                KeyboardButton(
                    BTN_ZODIAC_TAPPER,
                    web_app=WebAppInfo(url=_with_query(url, "game=zodiac_tapper")),
                )
            ]
        )
    rows.extend(
        [
            [KeyboardButton(BTN_GAME), KeyboardButton(BTN_QUIZ)],
            [KeyboardButton(BTN_BUY_AURA), KeyboardButton(BTN_REPEAT)],
            [KeyboardButton(BTN_MORE)],
        ]
    )
    return ReplyKeyboardMarkup(
        rows,
        resize_keyboard=True,
        is_persistent=True,
    )


def game_menu_keyboard() -> ReplyKeyboardMarkup:
    """Игры: день и путь → руны и энергия → знаки → колесо."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(BTN_GAME_CARD), KeyboardButton(BTN_GAME_PROFILE)],
            [KeyboardButton(BTN_GAME_RUNE), KeyboardButton(BTN_GAME_ENERGY)],
            [KeyboardButton(BTN_GAME_BALL), KeyboardButton(BTN_GAME_LUCK)],
            [KeyboardButton(BTN_GAME_WHEEL)],
            [KeyboardButton(BTN_ARCADE_MENU)],
            [KeyboardButton(BTN_BACK)],
        ],
        resize_keyboard=True,
        is_persistent=True,
    )


def mood_keyboard() -> ReplyKeyboardMarkup:
    """Настроение для заряда ауры — парами по тону."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(BTN_MOOD_CALM), KeyboardButton(BTN_MOOD_LOVE)],
            [KeyboardButton(BTN_MOOD_FIRE), KeyboardButton(BTN_MOOD_SAD)],
            [KeyboardButton(BTN_MOOD_ANXIETY)],
            [KeyboardButton(BTN_ORACLE_BACK)],
        ],
        resize_keyboard=True,
        is_persistent=True,
    )


def extra_menu_keyboard() -> ReplyKeyboardMarkup:
    """Ещё расчёты: база → время → матрица → люди → числа вещей."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(BTN_DESTINY), KeyboardButton(BTN_NAME)],
            [KeyboardButton(BTN_DAY), KeyboardButton(BTN_MONTH)],
            [KeyboardButton(BTN_QUARTER), KeyboardButton(BTN_CYCLE9)],
            [KeyboardButton(BTN_PINNACLES), KeyboardButton(BTN_2YEARS)],
            [KeyboardButton(BTN_ARCANA), KeyboardButton(BTN_PARTNER)],
            [KeyboardButton(BTN_KARMIC), KeyboardButton(BTN_LINES)],
            [KeyboardButton(BTN_D_MATRIX), KeyboardButton(BTN_CHILD)],
            [KeyboardButton(BTN_TEAM), KeyboardButton(BTN_COMPAT_NAME)],
            [KeyboardButton(BTN_EVENT), KeyboardButton(BTN_PHONE)],
            [KeyboardButton(BTN_ADDRESS), KeyboardButton(BTN_BUSINESS)],
            [KeyboardButton(BTN_NO_AI), KeyboardButton(BTN_BACK)],
        ],
        resize_keyboard=True,
        is_persistent=True,
    )
