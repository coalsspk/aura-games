"""Настройки аркады: лимиты и награды."""



from __future__ import annotations



DAILY_PLAYS_PER_GAME = 7



GAME_IDS = (

    "casino",

    "solitaire",

    "durak",

    "snake",

    "crystals",

    "mario",

    "poker",

    "tanks",

    "reading",

    "community",

    "hole",

    "shop",

    "dash",

    "ludus",

    "war",

    "bolt",

    "indycat",

    "blocks",

    "royal",

    "zodiac_tapper",

)



MARIO_COINS_PER_AURA = 100



WIN_REWARD: dict[str, int] = {

    "casino": 12,

    "casino_jackpot": 22,

    "solitaire": 14,

    "durak": 16,

    "snake": 12,

    "crystals": 14,

    "poker": 10,

    "poker_pair": 6,

    "poker_strong": 14,

    "poker_full": 18,

    "poker_royal": 22,

    "tanks": 14,

    "tanks_bonus": 18,

    "reading": 10,

    "community": 8,

    "hole": 12,

    "shop": 14,

    "dash": 12,

    "ludus": 10,

    "war": 14,

    "bolt": 10,

    "indycat": 12,

    "blocks": 14,

    "royal": 16,

    "zodiac_tapper": 1,

}



PARTIAL_REWARD: dict[str, int] = {

    "casino": 5,
    "casino_partial": 5,

}



CASINO_MAX_SPINS = 6

SOLITAIRE_MAX_MOVES = 20

DURAK_MAX_ROUNDS = 3

SNAKE_WIN_SCORE = 6

SNAKE_MAX_STEPS = 42

CRYSTALS_WIN_SCORE = 20

CRYSTALS_MAX_SWAPS = 12

CRYSTALS_MAX_ACTIONS = 28

