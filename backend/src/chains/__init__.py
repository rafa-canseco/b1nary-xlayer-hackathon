"""Chain abstraction layer — XLayer only."""

from enum import Enum


class Chain(str, Enum):
    XLAYER = "xlayer"
