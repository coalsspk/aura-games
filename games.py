"""Мистические мини-игры для вовлечения в Telegram-боте Aura."""

from __future__ import annotations

import hashlib
from datetime import date, datetime

from app.numerology.calculator import NumerologyCalculator, _reduce
from app.numerology.extras import to_arcana
from app.numerology.interpretations import cycle_text
from app.storage.game_progress import (
    BALL_AURA,
    CardDrawOutcome,
    GameProgress,
    LUCK_AURA,
    RUNE_DAILY_LIMIT,
    WHEEL_AURA,
    aura_level,
    streak_progress_bar,
)
from app.runtime_settings import get_economy
from app.numerology.interpretations import pick_fresh
from app.storage.request_points import format_balance_line

# Короткие мистические послания по аркану 1–22
_ARCANA_ORACLE: dict[int, tuple[str, str]] = {
    1: ("🜂 Маг", "Сегодня сила в ваших руках. Начните одно дело — Вселенная поддержит первый шаг."),
    2: ("🌙 Жрица", "День тишины и знаков. Прислушайтесь к сну и случайным словам — там подсказка."),
    3: ("✨ Императрица", "Творчество и забота. Что-то красивое рождётся — не мешайте процессу."),
    4: ("🏛 Император", "Порядок и структура. Составьте план — хаос отступит."),
    5: ("📜 Жрец", "День мудрости старших. Спросите совета у того, кому доверяете."),
    6: ("💞 Влюблённые", "Выбор сердца. Будьте честны с собой — половинчатость не сработает."),
    7: ("⚔ Колесница", "Движение вперёд. Действуйте решительно, но смотрите по сторонам."),
    8: ("🦁 Сила", "Внутренняя мощь. Сдержанность сильнее крика."),
    9: ("🕯 Отшельник", "Уединение принесёт ответ. Отложите шумные компании."),
    10: ("☸ Колесо", "Поворот судьбы близко. Примите перемену как дверь, не как удар."),
    11: ("⚡ Сила (мастер)", "Дублирующая энергия — либо прорыв, либо перегруз. Берегите нервы."),
    12: ("🔄 Повешенный", "Пауза полезна. Не тяните время — наблюдайте."),
    13: ("🦋 Смерть", "Конец старого — не страшно. Освободите место для нового."),
    14: ("⚗ Умеренность", "Золотая середина. Избегайте крайностей в еде, словах, тратах."),
    15: ("🌑 Дьявол", "Искушение или привязка. Спросите: «это моё желание или страх?»"),
    16: ("🗼 Башня", "Внезапное озарение. То, что рушится, больше не держало вас."),
    17: ("⭐ Звезда", "Надежда жива. Мечтайте вслух — одна мечта получит знак."),
    18: ("🌕 Луна", "Иллюзии возможны. Не верьте первому впечатлению — проверьте факты."),
    19: ("☀ Солнце", "Светлый день. Радость и успех рядом, если вы их впустите."),
    20: ("📯 Суд", "Пробуждение. Старое «я» зовёт завершить незакрытое."),
    21: ("🌍 Мир", "Гармония. Дело, начатое сегодня, может выйти на новый уровень."),
    22: ("🃏 Шут", "Лёгкость и риск. Смейтесь, пробуйте — но не бросайте ответственность."),
}

_BALL_ANSWERS: list[tuple[str, str]] = [
    ("✅", "Числа говорят «да» — действуйте, но без спешки."),
    ("🌙", "Пока «нет». Подождите три дня — энергия сменится."),
    ("✨", "Да, если вы честны с собой. Иначе знак развернётся."),
    ("🔄", "Ситуация в движении. Не принимайте решение сегодня."),
    ("🜂", "Судьба на вашей стороне. Сделайте первый шаг."),
    ("⚠", "Осторожно. Есть скрытый риск — перепроверьте."),
    ("💫", "Знак неясен. Задайте вопрос иначе, одним предложением."),
    ("🍀", "Удача рядом. Мелкий шаг сегодня откроет большое завтра."),
    ("🕯", "Ответ внутри вас. Помолчите пять минут — услышите."),
]

_RUNES: list[tuple[str, str]] = [
    ("ᚠ Феху", "Поток энергии открыт — смело берите то, что «звенит»."),
    ("ᚢ Уруз", "Сила тела и воли. День для действия, не для сомнений."),
    ("ᚦ Турисаз", "Порог. Что-то мешает — это страж, не враг. Спросите: чему учит?"),
    ("ᚨ Ансуз", "Слово — ключ. Запишите мысль, скажите вслух намерение."),
    ("ᚱ Райдо", "Путь. Движение важнее идеального плана."),
    ("ᚲ Кеназ", "Огонь творчества. Зажгите маленький проект."),
    ("ᚷ Гебо", "Дар. Отдайте — получите ответ Вселенной."),
    ("ᚹ Вуньо", "Радость близко. Позвольте себе лёгкость."),
    ("ᚺ Хагалаз", "Ломка старого. Не цепляйтесь за привычное."),
    ("ᚾ Наутиз", "Терпение. Сейчас не время форсировать."),
    ("ᛁ Иса", "Пауза. Наблюдайте — знак придёт сам."),
    ("ᛃ Йера", "Урожай. То, что сеяли, дозревает."),
    ("ᛇ Эйваз", "Переход. Смелый шаг через страх."),
    ("ᛈ Перт", "Тайна. Сон или символ сегодня важнее логики."),
    ("ᛉ Альгиз", "Защита. Вы под покровом — действуйте спокойно."),
    ("ᛊ Соулу", "Свет. День для честности с собой."),
    ("ᛏ Тейваз", "Справедливость. Решайте из принципов, не из обиды."),
    ("ᛒ Беркана", "Рост. Забота о себе — не эгоизм."),
    ("ᛖ Эваз", "Союз. Диалог может всё перевернуть."),
    ("ᛗ Манназ", "Личность. Вы — главный герой сегодняшнего дня."),
    ("ᛚ Лагуз", "Интуиция. Доверяйте первому тихому импульсу."),
    ("ᛞ Дагаз", "Рассвет. Конец ночи — начало цикла."),
    ("ᛟ Отал", "Корни. Вспомните, откуда ваша сила."),
    ("ᛝ Ингуз", "Завершение этапа. Закройте одно «хвостовое» дело."),
]

_MOOD_READINGS: dict[str, tuple[str, str]] = {
    "🕯 Спокойствие": ("Лунный покой", "Дышите медленно. Ответ придёт через тишину, не через спор."),
    "🔥 Драйв": ("Пламя Марса", "Сделайте одно смелое действие до полудня — энергия уйдёт в дело."),
    "💫 Любовь": ("Венера", "Откройте сердце: комплимент или искреннее «спасибо» — ваш ритуал."),
    "🌊 Грусть": ("Воды Океана", "Грусть — навигатор. Спросите: «что я давно не отпускаю?»"),
    "⚡ Тревога": ("Щит Меркурия", "Заземление: 5 вещей, которые видите вокруг. Тревога рассеется."),
}

_JOURNEY_7: list[str] = [
    "День 1 — Зерно. Запишите одно желание на неделю.",
    "День 2 — Корень. Вспомните, кто вас поддерживал в детстве.",
    "День 3 — Стебель. Сделайте шаг к цели, даже микроскопический.",
    "День 4 — Лист. Поблагодарите кого-то вслух.",
    "День 5 — Бутон. Откажитесь от одной вредной привычки сегодня.",
    "День 6 — Лепесток. Подарите себе 15 минут без телефона.",
    "День 7 — Плод. Прочитайте вслух своё желание с Дня 1 — цикл замкнулся.",
]

_DAILY_QUESTS: list[str] = [
    "Задание: назовите вслух число, которое сегодня преследует, и улыбнитесь.",
    "Задание: отправьте одному человеку тёплое сообщение без повода.",
    "Задание: запишите 3 вещи, за которые благодарны, до вечера.",
    "Задание: пройдите 77 шагов осознанно — как мини-ритуал.",
    "Задание: выберите цвет дня и наденьте или поставьте его рядом.",
    "Задание: загадайте желание на закате (или в 18:00).",
    "Задание: прочитайте вслух своё полное имя — почувствуйте вибрацию.",
]

_CARD_HEADERS = (
    "🃏 КАРТА ДНЯ",
    "🃏 ЗНАК СУТОК",
    "🃏 ПОСЛАНИЕ ДНЯ",
)

_CARD_CLOSINGS = (
    "💡 Загляните завтра за новой картой.",
    "💡 Завтра аркан сменится — вернитесь за картой.",
    "💡 Новый знак ждёт вас на рассвете следующего дня.",
)

_CARD_CTA = (
    "Полный разбор — «Рассчитать судьбу» в «📚 Ещё расчёты».",
    "Глубже в матрицу — «Рассчитать судьбу».",
    "Квадрат Пифагора — в разделе «📚 Ещё расчёты».",
)

_RUNE_CLOSINGS = (
    "Осталось попыток сегодня — смотрите в «📊 Мой путь».",
    "Счёт рун — в «📊 Мой путь».",
    "Лимит рун обновится завтра — профиль подскажет.",
)

_ENERGY_RITUALS = (
    "Мини-ритуал: закройте глаза, представьте число силы, вдохните на его счёт.",
    "Ритуал: три спокойных вдоха, на выдохе — шёпотом ваше число силы.",
    "Практика: ладонь на сердце, считайте до числа силы — отпустите напряжение.",
)

_BALL_INTROS = (
    "Туман рассеивается…",
    "Шар замирает в свете…",
    "В глубине стекла проступает знак…",
    "Эхо вопроса касается сферы…",
)

_BALL_CLOSINGS = (
    "Ещё вопрос? Снова «🔮 Шар судьбы».",
    "Новый вопрос — снова шар, когда созреете.",
    "Уточните иначе — шар ответит иначе.",
)

_LUCK_CLOSINGS = (
    "Полная карта личности — «Рассчитать судьбу» в «📚 Ещё расчёты».",
    "Матрица судьбы — в дополнительных расчётах.",
    "Квадрат Пифагора ждёт в «📚 Ещё расчёты».",
)

_WHEEL_FRAMES_POOL: tuple[tuple[str, str, str], ...] = (
    ("🎡 Колесо судьбы вращается…", "✨ Цифры сходятся в луч…", "🔮 Выпало число!"),
    ("🎡 Круг судьбы движется…", "🌙 Числа выстраиваются…", "✨ Готово!"),
    ("🎡 Спицы судьбы крутятся…", "💫 Вспышка на циферблате…", "🎯 Число выбрано!"),
)

_WHEEL_CLOSINGS = (
    "Крутите завтра снова или откройте «Карту дня».",
    "Новый спин — завтра. Сегодня ещё «🃏 Карта дня».",
    "Завтра колесо снова покажет число — или карта дня.",
)

_ORACLE_INTROS = (
    "🎮 ИГРЫ AURA\n\n"
    "Очки ауры: серия дней, звания, подарки цикла.\n"
    "Выберите игру 👇\n\n"
    "🃏 Карта дня — раз в сутки, качает 🔥 серию\n"
    "ᚠ Руна — до 3 раз · ⚡ Заряд — по настроению\n"
    "📊 Мой путь — баланс и лимиты\n"
    "🔮 Шар · 🍀 Удача · 🎡 Колесо\n"
    "🎮 Игры за очки — казино, солитер, дурак, змейка, кристалики",
    "🎮 ИГРЫ AURA\n\n"
    "Здесь вы зарабатываете очки и открываете ритуалы.\n"
    "Каждая кнопка — свой знак.\n\n"
    "🃏 Карта · ᚠ Руна · ⚡ Заряд · 📊 Путь\n"
    "🔮 Шар · 🍀 Число удачи · 🎡 Колесо\n"
    "🎮 Игры за очки — казино, солитер, дурак, змейка, кристалики",
    "🎮 РАЗДЕЛ ИГР\n\n"
    "Мистические мини-игры + прогресс ауры.\n"
    "Нажмите кнопку — ответ будет живым и разным.\n\n"
    "🃏 Карта дня · ᚠ Руна · ⚡ Заряд\n"
    "📊 Мой путь · 🔮 · 🍀 · 🎡",
)

_WHEEL_FATES: dict[int, str] = {
    1: "Число 1 — день лидера. Заявите о себе!",
    2: "Число 2 — день диалога. Не спорьте, договаривайтесь.",
    3: "Число 3 — творчество. Смейтесь, пишите, творите.",
    4: "Число 4 — труд. Порядок принесёт спокойствие.",
    5: "Число 5 — перемена. Будьте гибки.",
    6: "Число 6 — дом и семья. Забота о близких — ключ.",
    7: "Число 7 — тайна. Доверяйте интуиции.",
    8: "Число 8 — власть и деньги. Решения взвешенно.",
    9: "Число 9 — завершение. Отпустите лишнее.",
}


def _seed(*parts: str | int) -> int:
    blob = "|".join(str(p) for p in parts)
    return int(hashlib.sha256(blob.encode()).hexdigest()[:12], 16)


def journey_chapter(streak: int) -> str:
    day_idx = (max(1, streak) - 1) % 7
    return _JOURNEY_7[day_idx]


def daily_quest(user_id: int) -> str:
    seed = _seed("quest", user_id, date.today().isoformat())
    return _DAILY_QUESTS[seed % len(_DAILY_QUESTS)]


def _streak_bar(streak: int) -> str:
    pos = streak % 7
    if pos == 0 and streak > 0:
        pos = 7
    return streak_progress_bar(pos)


def format_card_engagement(outcome: CardDrawOutcome, user_id: int) -> str:
    lines = [
        "",
        f"🔥 Серия карт: {outcome.streak} дн.  {_streak_bar(outcome.streak)}",
        f"📖 Путь 7 дней: {journey_chapter(outcome.streak)}",
        f"✨ +{outcome.aura_gained} к ауры (всего {outcome.points_total}) · {outcome.level_title}",
    ]
    if outcome.seven_day_bonus:
        lines.append("🎁 Бонус 7 дней подряд! Сокровище цикла открыто.")
    lines.append("")
    lines.append(daily_quest(user_id))
    return "\n".join(lines)


def format_already_card_hint(prog: GameProgress, user_id: int) -> str:
    today = date.today().isoformat()
    rune_left = RUNE_DAILY_LIMIT
    if prog.rune_day == today:
        rune_left = max(0, RUNE_DAILY_LIMIT - prog.rune_count)
    energy_ok = prog.last_energy_date != today
    wheel_ok = prog.last_wheel_date != today
    ball_ok = prog.last_ball_date != today
    luck_ok = prog.last_luck_date != today
    _, title, to_next = aura_level(prog.aura_points)
    opener = pick_fresh(
        user_id,
        "card_done",
        [
            "🃏 Карта дня уже открыта.",
            "🃏 Сегодняшний аркан вы уже приняли.",
            "🃏 Карта легла — повтор будет завтра.",
        ],
    )
    return (
        f"{opener}\n\n"
        f"🔥 Серия: {prog.card_streak} дн.  {_streak_bar(prog.card_streak)}\n"
        f"✨ Аура: {prog.aura_points} · {title}"
        + (f" · до след. звания {to_next}" if to_next else "")
        + "\n\n"
        f"Сегодня ещё можно:\n"
        f"· ᚠ Руна — {rune_left} из {RUNE_DAILY_LIMIT}\n"
        f"· ⚡ Заряд ауры — {'да' if energy_ok else 'завтра'}\n"
        f"· 🎡 Колесо — {'да' if wheel_ok else 'завтра'}\n"
        f"· 🔮 Шар — {'да' if ball_ok else 'завтра'}\n"
        f"· 🍀 Удача — {'да' if luck_ok else 'завтра'}\n\n"
        f"{daily_quest(user_id)}"
    )


def draw_daily_card(
    user_id: int,
    birth: date | None = None,
    outcome: CardDrawOutcome | None = None,
) -> str:
    """Карта дня — один раз в сутки, персонально."""
    today = date.today()
    seed = _seed("card", user_id, today.isoformat(), birth.isoformat() if birth else "")
    arcana_num = to_arcana((seed % 22) + 1)
    title, msg = _ARCANA_ORACLE.get(arcana_num, ("🔮 Аркан", "День открыт для знаков."))

    lines = [
        pick_fresh(user_id, "card_hdr", list(_CARD_HEADERS)),
        f"Дата: {today.strftime('%d.%m.%Y')}",
        "",
        f"{title}",
        msg,
        "",
    ]
    if birth:
        pd = NumerologyCalculator.personal_day_number(birth, today)
        lines.append(f"Ваш личный день (нумерология): {pd}")
        lines.append(f"  {cycle_text('day', pd, birth, 1)}")
        lines.append("")
    lines.extend(
        [
            "─" * 28,
            pick_fresh(user_id, "card_close", list(_CARD_CLOSINGS)),
            pick_fresh(user_id, "card_cta", list(_CARD_CTA)),
        ]
    )
    text = "\n".join(lines)
    if outcome and outcome.ok:
        text += format_card_engagement(outcome, user_id)
    return text


def draw_rune(user_id: int, draw_index: int) -> str:
    seed = _seed("rune", user_id, date.today().isoformat(), draw_index)
    title, msg = _RUNES[seed % len(_RUNES)]
    return (
        f"ᚠ РУНА МОМЕНТА ({draw_index}/{RUNE_DAILY_LIMIT})\n\n"
        f"{title}\n{msg}\n\n"
        f"✨ +4 очков ауры\n"
        f"{'─' * 28}\n"
        f"{pick_fresh(user_id, 'rune_close', list(_RUNE_CLOSINGS))}"
    )


def energy_reading(mood: str, user_id: int) -> str:
    title, msg = _MOOD_READINGS.get(mood, ("Поток", "Примите своё состояние — оно ведёт к балансу."))
    seed = _seed("energy", user_id, mood, date.today().isoformat())
    power = (seed % 9) + 1
    ritual = pick_fresh(user_id, "energy_rit", list(_ENERGY_RITUALS))
    tail = pick_fresh(
        user_id,
        "energy_tail",
        [
            "Завтра выберите другое настроение.",
            "Новый заряд — завтра, другим настроением.",
            "Поток сменится с новым днём — вернитесь.",
        ],
    )
    return (
        "⚡ ЗАРЯД АУРЫ\n\n"
        f"Настроение: {mood}\n"
        f"Канал: {title}\n"
        f"Сила дня: {power}/9\n\n"
        f"{msg}\n\n"
        f"{ritual} ({power}).\n\n"
        f"✨ +12 очков ауры (раз в сутки)\n"
        f"{'─' * 28}\n"
        f"{tail}"
    )


def format_oracle_profile(prog: GameProgress) -> str:
    rank, title, to_next = aura_level(prog.aura_points)
    today = date.today().isoformat()
    card_ok = prog.last_card_date != today
    rune_left = RUNE_DAILY_LIMIT
    if prog.rune_day == today:
        rune_left = max(0, RUNE_DAILY_LIMIT - prog.rune_count)
    energy_ok = prog.last_energy_date != today
    wheel_ok = prog.last_wheel_date != today
    ball_ok = prog.last_ball_date != today
    luck_ok = prog.last_luck_date != today
    days_to_bonus = 0
    if prog.card_streak > 0:
        days_to_bonus = 7 - (prog.card_streak % 7)
        if days_to_bonus == 7:
            days_to_bonus = 0
    econ = get_economy()
    free_left = max(0, econ.free_calculations - prog.calc_requests_used)
    header = pick_fresh(
        prog.user_id,
        "profile_hdr",
        [
            "📊 МОЙ ПУТЬ В AURA",
            "📊 КАРТА ПУТИ AURA",
            "📊 ВАШ ПРОГРЕСС",
        ],
    )
    footer = pick_fresh(
        prog.user_id,
        "profile_ftr",
        [
            "Игры дают очки → расчёты. Серия карт — каждый день.",
            "Очки ауры — в играх; расчёты — в меню.",
            "Серия карт растит бонусы — не прерывайте цепочку.",
        ],
    )
    lines = [
        header,
        "",
        format_balance_line(prog.calc_requests_used, prog.aura_points),
        f"Звание: {title} (уровень {rank})",
    ]
    if to_next:
        lines.append(f"До следующего звания: {to_next} очков")
    lines.extend([
        "",
        f"🔥 Серия карт: {prog.card_streak} дн.  {_streak_bar(prog.card_streak)}",
    ])
    if days_to_bonus and prog.card_streak:
        lines.append(f"🎁 До бонуса 7 дней: {days_to_bonus}")
    lines.extend([
        "",
        f"🎮 Всего игр: {prog.total_plays}",
        "",
        "Сегодня доступно:",
        f"· 🃏 Карта дня — {'открыть' if card_ok else '✓ готово'}",
        f"· ᚠ Руна — {rune_left}/{RUNE_DAILY_LIMIT}",
        f"· ⚡ Заряд ауры — {'да' if energy_ok else 'использован'}",
        f"· 🎡 Колесо чисел — {'да' if wheel_ok else 'использовано'}",
        f"· 🔮 Шар судьбы — {'да' if ball_ok else 'использован'}",
        f"· 🍀 Число удачи — {'да' if luck_ok else 'использовано'}",
        "",
        "Нумерологические расчёты:",
        (
            f"· 🎁 Бесплатных: {free_left} из {econ.free_calculations}"
            if free_left
            else (
                f"· 💫 Цена: {econ.cost_main} (основ.) / {econ.cost_extra} (доп.) очков ауры"
            )
        ),
        (
            "· Купить: /buy (Stars или карта)"
            if econ.any_payment_enabled
            else ""
        ),
        "",
        f"📜 {journey_chapter(prog.card_streak or 1)}",
        "",
        "─" * 28,
        footer,
    ])
    return "\n".join(lines)


def magic_ball_answer(question: str, user_id: int, points_total: int | None = None) -> str:
    """Шар судьбы — ответ на вопрос."""
    q = question.strip()
    if len(q) < 3:
        return "🔮 Шёпот слишком тихий… Задайте вопрос одним предложением (от 3 символов)."
    seed = _seed("ball", user_id, q.lower()[:200])
    idx = seed % len(_BALL_ANSWERS)
    emoji, text = _BALL_ANSWERS[idx]
    number = (seed % 9) + 1
    reward_line = f"\n✨ +{BALL_AURA} очков ауры"
    if points_total is not None:
        reward_line += f" · всего {points_total}"
    return (
        "🔮 ШАР СУДЬБЫ\n\n"
        f"Вопрос: «{q[:300]}»\n\n"
        f"{pick_fresh(user_id, 'ball_intro', list(_BALL_INTROS))}\n\n"
        f"{emoji} Число ответа: {number}\n\n"
        f"{text}\n\n"
        f"{reward_line}\n"
        f"{'─' * 28}\n"
        f"{pick_fresh(user_id, 'ball_close', list(_BALL_CLOSINGS))}\n"
        f"{pick_fresh(user_id, 'ball_deep', ['Глубже — «Нумерологический прогноз».', 'Разворот темы — прогноз в меню.', 'Полный цикл — нумерологический прогноз.'])}"
    )


def lucky_number_ritual(birth: date, user_id: int, points_total: int | None = None) -> str:
    """Число удачи + мини-ритуал."""
    today = date.today()
    base = birth.day + birth.month + today.day + today.month + (user_id % 1000)
    luck = _reduce(base, keep_master=False)
    symbols = "★☆✦✧♦♥♠♣●○◆◇"
    pattern = "".join(symbols[_seed("sym", luck, user_id, i) % len(symbols)] for i in range(7))

    reward_line = f"✨ +{LUCK_AURA} очков ауры"
    if points_total is not None:
        reward_line += f" · всего {points_total}"
    return (
        "🍀 ЧИСЛО УДАЧИ\n\n"
        f"Дата рождения: {birth.strftime('%d.%m.%Y')}\n"
        f"Сегодня: {today.strftime('%d.%m.%Y')}\n\n"
        f"✨ Ваше число удачи на сегодня: {luck}\n"
        f"  {cycle_text('day', luck, birth, 9)}\n\n"
        f"Магический узор: {pattern}\n\n"
        f"{pick_fresh(user_id, 'luck_rit', ['Простой ритуал:', 'Мини-ритуал удачи:', 'Три шага:'])}\n"
        f"1. Прошепчите число {luck} три раза.\n"
        f"2. {pick_fresh(user_id, 'luck2', ['Коснитесь ладонью сердца.', 'Взгляд в небо — один вдох.', 'Запишите число на бумаге.'])}\n"
        f"3. {pick_fresh(user_id, 'luck3', ['Сделайте одно доброе дело до вечера.', 'Подарите себе 5 минут тишины.', 'Поделитесь теплом с одним человеком.'])}\n\n"
        f"{reward_line}\n"
        f"{'─' * 28}\n"
        f"{pick_fresh(user_id, 'luck_close', list(_LUCK_CLOSINGS))}"
    )


def wheel_of_fate(user_id: int, points_total: int | None = None) -> tuple[str, list[str]]:
    """Колесо — промежуточные фразы для «анимации» и финал."""
    today = date.today()
    seed = _seed("wheel", user_id, today.isoformat())
    number = (seed % 9) + 1
    anim_seed = _seed("wanim", user_id, today.isoformat(), datetime.now().minute)
    frames = list(_WHEEL_FRAMES_POOL[anim_seed % len(_WHEEL_FRAMES_POOL)])
    reward_line = f"✨ +{WHEEL_AURA} очков ауры"
    if points_total is not None:
        reward_line += f" · всего {points_total}"
    result = (
        f"🎡 КОЛЕСО ЧИСЕЛ\n\n"
        f"Сегодня {today.strftime('%d.%m.%Y')}\n\n"
        f"🎯 Выпало: {number}\n\n"
        f"{_WHEEL_FATES[number]}\n\n"
        f"{reward_line}\n"
        f"{'─' * 28}\n"
        f"{pick_fresh(user_id, 'wheel_close', list(_WHEEL_CLOSINGS))}"
    )
    return result, frames


def oracle_intro(user_id: int = 0) -> str:
    base = pick_fresh(user_id, "oracle_intro", list(_ORACLE_INTROS))
    tail = pick_fresh(
        user_id,
        "oracle_tail",
        [
            "\n\n◀️ Главное меню — назад к расчётам",
            "\n\n◀️ В главное меню — полные разборы",
            "\n\n◀️ Назад — кнопка «Главное меню»",
        ],
    )
    return base + tail
