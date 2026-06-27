"""Обработка аркады в диалоге бота."""



from __future__ import annotations



import io

import re



from telegram import InputFile, Update

from telegram.ext import ContextTypes



from app.storage.history import ClientHistory

from app.telegram.arcade.config import DAILY_PLAYS_PER_GAME, GAME_IDS

from app.telegram.arcade.games import (

    ARCADE_MENU_BUTTONS,

    BTN_ARCADE_BACK,

    BTN_ARCADE_EXIT,

    BTN_ARCADE_MENU,

    GAME_BY_BUTTON,

    intro_text,

    new_state,

    process_turn,

)

from app.telegram.arcade.keyboards import arcade_menu_keyboard, arcade_play_keyboard

from app.telegram.arcade.render import render_game_image

from app.telegram.keyboards import game_menu_keyboard



_COORD_RE = re.compile(r"^[ABCD][1-4]$", re.I)





class ArcadeHandler:

    def __init__(self, history: ClientHistory, *, webapp_url: str = "") -> None:

        self.history = history

        self.webapp_url = (webapp_url or "").strip()



    def menu_intro(self, user_id: int) -> str:

        counts = self.history.get_arcade_counts(user_id)

        lines = [

            "🎮 ИГРЫ ЗА ОЧКИ АУРЫ",

            "",

            "Победа — очки на баланс. Каждая игра — до "

            f"{DAILY_PLAYS_PER_GAME} партий в сутки.",

            "",

            "🎰 Казино — слоты",

            "🃏 Солитер — пары карт",

            "🎴 Дурак — 3 раунда",

            "🐍 Змейка — счёт 6+ за лимит шагов",

            "💎 Кристалики — очки за 12 обменов",

            "",

            "Выберите игру 👇",

        ]

        if self.webapp_url.startswith("https://"):

            lines.insert(

                2,

                "🕹 «Визуальные игры» — полноэкранное мини-приложение Telegram.",

            )

        lines.insert(3, "Картинки поля — под каждым ходом в чате.")

        labels = {

            "casino": "🎰 Казино",

            "solitaire": "🃏 Солитер",

            "durak": "🎴 Дурак",

            "snake": "🐍 Змейка",

            "crystals": "💎 Кристалики",

            "mario": "🍄 Марино",

            "poker": "🃏 Покер",

            "tanks": "🎮 Танчики",

            "reading": "📗 Я читаю",

            "community": "👩 Community",

            "hole": "🕳️ Hole Express",

            "shop": "🏪 City Shop",

            "dash": "⬛ Dash",

            "ludus": "⚔️ Лудус",

            "war": "🛡️ Война судьбы",

            "bolt": "🔩 Мастер Болт",

            "indycat": "🐱 Инди кот",

            "blocks": "🧱 Блоки",

            "royal": "👑 Royal Kingdom",

            "zodiac_tapper": "♈ Зодиак таппер",

        }

        from app.storage.arcade_plays import plays_left



        for gid in GAME_IDS:

            left = plays_left(counts, gid)

            lines.append(f"· {labels.get(gid, gid)}: {left} партий")

        return "\n".join(lines)



    async def _send_play(

        self,

        update: Update,

        text: str,

        reply_markup,

        state: dict | None = None,

    ) -> None:

        if not update.message:

            return

        caption = text[:1024]

        if state:

            try:

                img = render_game_image(state)

                if img:

                    await update.message.reply_photo(

                        photo=InputFile(io.BytesIO(img), filename="aura_game.png"),

                        caption=caption,

                        reply_markup=reply_markup,

                    )

                    return

            except Exception:

                pass

        await update.message.reply_text(text, reply_markup=reply_markup)



    async def handle(

        self,

        update: Update,

        context: ContextTypes.DEFAULT_TYPE,

        text: str,

        reply_fn,

        *,

        state_arcade: int,

        state_menu: int,

    ) -> int:

        """Обрабатывает сообщение в режиме аркады. Возвращает состояние ConversationHandler."""

        user = update.effective_user

        if not user or not update.message:

            return state_menu



        uid = user.id

        t = text.strip()

        menu_kb = arcade_menu_keyboard(self.webapp_url)



        if t == BTN_ARCADE_EXIT or t == BTN_ARCADE_BACK:

            context.user_data.pop("arcade_state", None)

            if t == BTN_ARCADE_BACK and context.user_data.get("game_menu"):

                await update.message.reply_text(

                    "🎮 Игры:",

                    reply_markup=game_menu_keyboard(),

                )

                return state_menu

            await reply_fn(update, "Главное меню:", show_menu=True)

            return state_menu



        if t == BTN_ARCADE_MENU:

            context.user_data["arcade_state"] = None

            context.user_data["game_menu"] = True

            await update.message.reply_text(

                self.menu_intro(uid),

                reply_markup=menu_kb,

            )

            return state_arcade



        if t in GAME_BY_BUTTON:

            game_id = GAME_BY_BUTTON[t]

            ok, left, err = self.history.try_arcade_start(uid, game_id)

            if not ok:

                await update.message.reply_text(err, reply_markup=menu_kb)

                return state_arcade

            state = new_state(game_id, uid)

            context.user_data["arcade_state"] = state

            kind = "casino" if game_id == "casino" else "play"

            if game_id == "snake":

                kind = "snake"

            elif game_id == "crystals":

                kind = "crystals"

            elif game_id == "durak":

                kind = "durak"

            await self._send_play(

                update,

                intro_text(game_id, left) + "\n\n👇",

                arcade_play_keyboard(kind),

                state,

            )

            return state_arcade



        state = context.user_data.get("arcade_state")

        if not state:

            if t in ARCADE_MENU_BUTTONS or _COORD_RE.match(t):

                await update.message.reply_text(

                    "Выберите игру из меню 🎮",

                    reply_markup=menu_kb,

                )

                return state_arcade

            return state_menu



        if _COORD_RE.match(t):

            action = t.upper()

        else:

            action = t



        result = process_turn(state, uid, action)

        if result.won and result.reward_points > 0:

            total = self.history.award_arcade_win(

                uid, result.reward_kind or state.get("id", "arcade"),

                result.reward_points,

            )

            result.text += f"\n\n💫 На счету: {total} очков ауры."



        if result.finished:

            context.user_data.pop("arcade_state", None)

            await self._send_play(update, result.text, menu_kb, state)

            return state_arcade



        kb = arcade_play_keyboard(result.keyboard)

        await self._send_play(update, result.text, kb, state)

        return state_arcade


