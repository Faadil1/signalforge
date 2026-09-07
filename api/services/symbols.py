from __future__ import annotations

import re

SYMBOL_PATTERN = re.compile(r"^[A-Z0-9]{2,10}$")


def normalize_token(token: str) -> str:
    return token.strip().upper()


def is_valid_token(token: str) -> bool:
    return bool(SYMBOL_PATTERN.match(token))
