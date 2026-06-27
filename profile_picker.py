"""Клавиатура выбора сохранённого имени / даты."""

from __future__ import annotations

from typing import Any

from telegram import KeyboardButton, ReplyKeyboardMarkup

from app.numerology import NumerologyCalculator
from app.storage.user_profiles import (
    BIRTH_KEYS,
    NAME_KEYS,
    ProfilePick,
    SavedProfile,
    can_pick_full_profile,
    partner_name_key,
    profiles_for_step,
)
from app.telegram.flows import FLOW_STEPS
from app.telegram.keyboards import BTN_PROFILE_NEW

MAX_BUTTONS = 6


def _birth_key_for_name(name_key: str) -> str:
    if name_key == "name":
        return "birth"
    return name_key.replace("name", "birth")


def _step_after_birth(steps: list[tuple[str, str]], name_step: int) -> int:
    if name_step + 1 < len(steps) and steps[name_step + 1][0] in BIRTH_KEYS:
        return name_step + 2
    return name_step + 1


def build_profile_keyboard(
    all_profiles: list[SavedProfile],
    answer_key: str,
    answers: dict[str, Any],
    flow: str,
    step: int,
) -> tuple[ReplyKeyboardMarkup | None, dict[str, ProfilePick]]:
    steps = FLOW_STEPS.get(flow, [])
    shown = profiles_for_step(all_profiles, answer_key, answers, flow, step, steps)
    if not shown:
        return None, {}

    pick_map: dict[str, ProfilePick] = {}
    labels: list[str] = []
    full_pick = can_pick_full_profile(answer_key, steps, step)

    for p in shown[:MAX_BUTTONS]:
        label = p.button_label()
        if label in pick_map:
            continue
        birth = NumerologyCalculator.parse_birth_date(p.birth)
        if not birth:
            continue

        if answer_key in NAME_KEYS:
            if not p.name.strip():
                continue
            if full_pick:
                pick_map[label] = ProfilePick(
                    target_key=answer_key,
                    name=p.name.strip(),
                    birth=birth,
                    skip_to_step=_step_after_birth(steps, step),
                )
            else:
                pick_map[label] = ProfilePick(
                    target_key=answer_key,
                    name=p.name.strip(),
                )
            labels.append(label)
        elif answer_key in BIRTH_KEYS:
            pick = ProfilePick(target_key=answer_key, birth=birth)
            pname = partner_name_key(answer_key)
            if pname and not answers.get(pname) and p.name.strip():
                pick.name = p.name.strip()
            pick_map[label] = pick
            labels.append(label)

    if not labels:
        return None, {}

    rows: list[list[KeyboardButton]] = []
    row: list[KeyboardButton] = []
    for label in labels:
        row.append(KeyboardButton(label))
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([KeyboardButton(BTN_PROFILE_NEW)])

    return (
        ReplyKeyboardMarkup(rows, resize_keyboard=True, one_time_keyboard=True),
        pick_map,
    )


def apply_profile_pick(pick: ProfilePick, answers: dict[str, Any]) -> None:
    key = pick.target_key
    if key in NAME_KEYS and pick.name:
        answers[key] = pick.name
    if key in BIRTH_KEYS and pick.birth:
        answers[key] = pick.birth
    if key in NAME_KEYS and pick.birth:
        bk = _birth_key_for_name(key)
        answers[bk] = pick.birth
    pname = partner_name_key(key) if key in BIRTH_KEYS else None
    if pname and pick.name and key in BIRTH_KEYS:
        answers[pname] = pick.name
