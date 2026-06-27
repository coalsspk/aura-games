"""Сценарии диалога бота: вопросы по шагам."""

from __future__ import annotations

from app.telegram.keyboards import (
    BTN_2YEARS,
    BTN_GAME,
    BTN_GAME_BALL,
    BTN_GAME_CARD,
    BTN_GAME_LUCK,
    BTN_GAME_WHEEL,
    GAME_MENU_BUTTONS,
    BTN_ADDRESS,
    BTN_ARCANA,
    BTN_BACK,
    BTN_BUSINESS,
    BTN_CHILD,
    BTN_NOTAL_MAP,
    BTN_COMPAT,
    BTN_COMPAT_FULL,
    BTN_COMPAT_ZODIAC,
    BTN_COMPAT_YEAR,
    BTN_COMPAT_NAMES_BTN,
    BTN_PARTNER_MATCH,
    BTN_COMPAT_NAME,
    BTN_CYCLE9,
    BTN_DAY,
    BTN_DESTINY,
    BTN_D_MATRIX,
    BTN_EVENT,
    BTN_FORECAST,
    BTN_KARMIC,
    BTN_LINES,
    BTN_MONTH,
    BTN_MORE,
    BTN_NAME,
    BTN_NO_AI,
    BTN_PARTNER,
    BTN_PHONE,
    BTN_PINNACLES,
    BTN_QUARTER,
    BTN_REPEAT,
    BTN_TEAM,
    EXTRA_MENU_BUTTONS,
    MENU_BUTTONS,
)
from app.telegram.quiz_ui import QUIZ_MENU_BUTTONS
from app.telegram.arcade.games import ARCADE_MENU_BUTTONS
from app.telegram.magister_ui import MAGISTER_BUTTONS

COMPAT_MENU_BUTTONS = frozenset(
    {
        BTN_COMPAT_FULL,
        BTN_COMPAT_ZODIAC,
        BTN_COMPAT_YEAR,
        BTN_COMPAT_NAMES_BTN,
        BTN_PARTNER_MATCH,
        BTN_BACK,
    }
)

FLOW_DESTINY = "destiny"
FLOW_COMPAT = "compat"
FLOW_COMPAT_ZODIAC = "compat_zodiac"
FLOW_COMPAT_YEAR = "compat_year"
FLOW_FORECAST = "forecast"
FLOW_NAME = "name"

FLOW_PERSONAL_DAY = "personal_day"
FLOW_NINE_YEAR = "nine_year"
FLOW_PINNACLES = "pinnacles"
FLOW_KARMIC = "karmic"
FLOW_MATRIX_LINES = "matrix_lines"
FLOW_DESTINY_MATRIX = "destiny_matrix"
FLOW_ARCANA_YEAR = "arcana_year"
FLOW_MONTH_FORECAST = "month_forecast"
FLOW_QUARTER_FORECAST = "quarter_forecast"
FLOW_TWO_YEARS = "two_years"
FLOW_COMPAT_NAMES = "compat_names"
FLOW_EVENT_DATE = "event_date"
FLOW_PHONE = "phone"
FLOW_ADDRESS = "address"
FLOW_PARTNER_FORECAST = "partner_forecast"
FLOW_BUSINESS = "business"
FLOW_CHILD = "child"
FLOW_NOTAL_MAP = "notal_map"
FLOW_TEAM = "team"
FLOW_GAME_BALL = "game_ball"
FLOW_GAME_LUCK = "game_luck"
FLOW_DAILY_ADVICE = "daily_advice"

EXTRA_FLOWS = {
    FLOW_PERSONAL_DAY,
    FLOW_NINE_YEAR,
    FLOW_PINNACLES,
    FLOW_KARMIC,
    FLOW_MATRIX_LINES,
    FLOW_DESTINY_MATRIX,
    FLOW_ARCANA_YEAR,
    FLOW_MONTH_FORECAST,
    FLOW_QUARTER_FORECAST,
    FLOW_TWO_YEARS,
    FLOW_EVENT_DATE,
    FLOW_PHONE,
    FLOW_ADDRESS,
    FLOW_PARTNER_FORECAST,
    FLOW_BUSINESS,
    FLOW_CHILD,
    FLOW_NOTAL_MAP,
    FLOW_TEAM,
}

BUTTON_TO_FLOW = {
    BTN_DESTINY: FLOW_DESTINY,
    BTN_COMPAT_FULL: FLOW_COMPAT,
    BTN_COMPAT_ZODIAC: FLOW_COMPAT_ZODIAC,
    BTN_COMPAT_YEAR: FLOW_COMPAT_YEAR,
    BTN_COMPAT_NAMES_BTN: FLOW_COMPAT_NAMES,
    BTN_FORECAST: FLOW_FORECAST,
    BTN_NAME: FLOW_NAME,
    BTN_DAY: FLOW_PERSONAL_DAY,
    BTN_CYCLE9: FLOW_NINE_YEAR,
    BTN_PINNACLES: FLOW_PINNACLES,
    BTN_KARMIC: FLOW_KARMIC,
    BTN_LINES: FLOW_MATRIX_LINES,
    BTN_D_MATRIX: FLOW_DESTINY_MATRIX,
    BTN_ARCANA: FLOW_ARCANA_YEAR,
    BTN_MONTH: FLOW_MONTH_FORECAST,
    BTN_QUARTER: FLOW_QUARTER_FORECAST,
    BTN_2YEARS: FLOW_TWO_YEARS,
    BTN_COMPAT_NAME: FLOW_COMPAT_NAMES,
    BTN_EVENT: FLOW_EVENT_DATE,
    BTN_PHONE: FLOW_PHONE,
    BTN_ADDRESS: FLOW_ADDRESS,
    BTN_PARTNER: FLOW_PARTNER_FORECAST,
    BTN_BUSINESS: FLOW_BUSINESS,
    BTN_CHILD: FLOW_CHILD,
    BTN_NOTAL_MAP: FLOW_NOTAL_MAP,
    BTN_TEAM: FLOW_TEAM,
}

FLOW_STEPS: dict[str, list[tuple[str, str]]] = {
    FLOW_DESTINY: [
        ("name", "Введите ваше полное имя:"),
        ("birth", "Введите дату рождения (ДД.ММ.ГГГГ):"),
    ],
    FLOW_FORECAST: [
        ("name", "Введите ваше полное имя:"),
        ("birth", "Введите дату рождения (ДД.ММ.ГГГГ):"),
        ("forecast_year", "На какой год нужен прогноз? (например 2026):"),
    ],
    FLOW_NAME: [
        ("name", "Введите полное имя для расшифровки:"),
    ],
    FLOW_COMPAT: [
        ("name1", "Введите имя первого человека:"),
        ("birth1", "Дата рождения первого человека (ДД.ММ.ГГГГ):"),
        ("name2", "Введите имя второго человека:"),
        ("birth2", "Дата рождения второго человека (ДД.ММ.ГГГГ):"),
    ],
    FLOW_COMPAT_ZODIAC: [
        ("sign1", "Выберите знак зодиака первого человека 👇"),
        ("sign2", "Выберите знак зодиака второго человека 👇"),
    ],
    FLOW_COMPAT_YEAR: [
        ("name1", "Имя первого человека:"),
        ("birth1", "Дата рождения первого (ДД.ММ.ГГГГ):"),
        ("name2", "Имя второго человека:"),
        ("birth2", "Дата рождения второго (ДД.ММ.ГГГГ):"),
    ],
    FLOW_PERSONAL_DAY: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
        ("on_date", "На какую дату расчёт? (ДД.ММ.ГГГГ или «сегодня»):"),
    ],
    FLOW_NINE_YEAR: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
    ],
    FLOW_PINNACLES: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
    ],
    FLOW_KARMIC: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
    ],
    FLOW_MATRIX_LINES: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
    ],
    FLOW_DESTINY_MATRIX: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
    ],
    FLOW_ARCANA_YEAR: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
        ("forecast_year", "Год для аркана (например 2026):"),
    ],
    FLOW_MONTH_FORECAST: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
        ("forecast_year", "Год (например 2026):"),
        ("forecast_month", "Месяц числом 1–12:"),
    ],
    FLOW_QUARTER_FORECAST: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
        ("forecast_year", "Год (например 2026):"),
        ("quarter_start", "Первый месяц квартала (1, 4, 7 или 10):"),
    ],
    FLOW_TWO_YEARS: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
        ("year1", "Первый год для сравнения:"),
        ("year2", "Второй год для сравнения:"),
    ],
    FLOW_COMPAT_NAMES: [
        ("name1", "Имя первого человека:"),
        ("name2", "Имя второго человека:"),
    ],
    FLOW_EVENT_DATE: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
        ("event_label", "Что за событие? (свадьба, переезд, запуск…):"),
        ("event_date", "Дата события (ДД.ММ.ГГГГ):"),
    ],
    FLOW_PHONE: [
        ("number", "Введите номер телефона или цифры (без пробелов можно):"),
        ("birth_optional", "Дата рождения для сравнения (ДД.ММ.ГГГГ) или «-» чтобы пропустить:"),
    ],
    FLOW_ADDRESS: [
        ("number", "Номер квартиры / дома / цифры адреса:"),
        ("birth_optional", "Дата рождения для сравнения (ДД.ММ.ГГГГ) или «-»:"),
    ],
    FLOW_PARTNER_FORECAST: [
        ("name1", "Имя первого партнёра:"),
        ("birth1", "Дата рождения первого (ДД.ММ.ГГГГ):"),
        ("name2", "Имя второго партнёра:"),
        ("birth2", "Дата рождения второго (ДД.ММ.ГГГГ):"),
        ("forecast_year", "Год прогноза (например 2026):"),
    ],
    FLOW_BUSINESS: [
        ("company", "Название компании или проекта:"),
        ("name", "Имя основателя:"),
        ("birth", "Дата рождения основателя (ДД.ММ.ГГГГ):"),
    ],
    FLOW_CHILD: [
        ("name", "Имя ребёнка:"),
        ("birth", "Дата рождения ребёнка (ДД.ММ.ГГГГ):"),
    ],
    FLOW_NOTAL_MAP: [
        ("name", "Ваше имя:"),
        ("birth", "Дата рождения (ДД.ММ.ГГГГ):"),
    ],
    FLOW_TEAM: [
        ("name1", "Имя участника 1:"),
        ("birth1", "Дата рождения 1 (ДД.ММ.ГГГГ):"),
        ("name2", "Имя участника 2:"),
        ("birth2", "Дата рождения 2 (ДД.ММ.ГГГГ):"),
        ("name3", "Имя участника 3 (или «-» чтобы пропустить):"),
        ("birth3", "Дата рождения 3 (ДД.ММ.ГГГГ) или «-»:"),
    ],
    FLOW_GAME_BALL: [
        ("question", "🔮 Загадайте вопрос шару судьбы (одним сообщением):"),
    ],
    FLOW_GAME_LUCK: [
        ("birth", "🍀 Введите дату рождения (ДД.ММ.ГГГГ):"),
    ],
    FLOW_DAILY_ADVICE: [
        ("birth", "📖 Введите дату рождения для совета дня (ДД.ММ.ГГГГ):"),
    ],
}

FLOW_TITLES = {
    FLOW_DESTINY: "Расчёт судьбы",
    FLOW_COMPAT: "Полная совместимость",
    FLOW_COMPAT_ZODIAC: "Прогноз по знакам зодиака",
    FLOW_COMPAT_YEAR: "Совместимость по году",
    FLOW_FORECAST: "Нумерологический прогноз",
    FLOW_NAME: "Расшифровка имени",
    FLOW_PERSONAL_DAY: "Личный день и неделя",
    FLOW_NINE_YEAR: "9-летний цикл",
    FLOW_PINNACLES: "Пики жизни",
    FLOW_KARMIC: "Кармические числа",
    FLOW_MATRIX_LINES: "Линии матрицы",
    FLOW_DESTINY_MATRIX: "Матрица судьбы",
    FLOW_ARCANA_YEAR: "Аркан года",
    FLOW_MONTH_FORECAST: "Прогноз на месяц",
    FLOW_QUARTER_FORECAST: "Прогноз на квартал",
    FLOW_TWO_YEARS: "Сравнение двух лет",
    FLOW_COMPAT_NAMES: "Совместимость имён",
    FLOW_EVENT_DATE: "Дата события",
    FLOW_PHONE: "Номер телефона",
    FLOW_ADDRESS: "Номер дома",
    FLOW_PARTNER_FORECAST: "Партнёрский прогноз",
    FLOW_BUSINESS: "Нумерология бизнеса",
    FLOW_CHILD: "Детская карта",
    FLOW_NOTAL_MAP: "Нотальная карта",
    FLOW_TEAM: "Команда",
    FLOW_GAME_BALL: "Шар судьбы",
    FLOW_GAME_LUCK: "Число удачи",
    FLOW_DAILY_ADVICE: "Совет дня",
}


def is_menu_button(text: str) -> bool:
    t = text.strip()
    return (
        t in MENU_BUTTONS
        or t in EXTRA_MENU_BUTTONS
        or t in GAME_MENU_BUTTONS
        or t in QUIZ_MENU_BUTTONS
        or t in MAGISTER_BUTTONS
        or t in COMPAT_MENU_BUTTONS
        or t in ARCADE_MENU_BUTTONS
    )


def get_flow_from_button(text: str) -> str | None:
    return BUTTON_TO_FLOW.get(text.strip())


def get_question(flow: str, step: int) -> str | None:
    steps = FLOW_STEPS.get(flow, [])
    if step < len(steps):
        return steps[step][1]
    return None


def get_answer_key(flow: str, step: int) -> str | None:
    steps = FLOW_STEPS.get(flow, [])
    if step < len(steps):
        return steps[step][0]
    return None


def total_steps(flow: str) -> int:
    return len(FLOW_STEPS.get(flow, []))
