"""Structured logging for the scraper — stdout JSON lines.

Keeps things legible when the container is piped into docker logs / a log
aggregator, and doesn't bury useful fields (source, horse count, elapsed) in
free-form strings.
"""
from __future__ import annotations

import logging
import sys

from pythonjsonlogger import jsonlogger


def get_logger(name: str = "scraper") -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # already configured
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    fmt = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "ts", "levelname": "level"},
    )
    handler.setFormatter(fmt)
    logger.addHandler(handler)
    logger.propagate = False
    return logger
