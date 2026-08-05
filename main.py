"""AtmosMIDI entry point."""

from __future__ import annotations

import argparse
import logging
import sys
from logging.handlers import RotatingFileHandler

import uvicorn

from config import DATA_DIR, DEFAULT_HOST, DEFAULT_PORT, LOG_DIR, LOG_PATH


def setup_logging(verbose: bool = False) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    level = logging.DEBUG if verbose else logging.INFO
    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    root.addHandler(console)

    file_handler = RotatingFileHandler(
        LOG_PATH, maxBytes=2_000_000, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="AtmosMIDI — Weather → MIDI for Ableton")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--reload", action="store_true")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    setup_logging(args.verbose)
    logging.getLogger(__name__).info(
        "Starting AtmosMIDI on http://%s:%s", args.host, args.port
    )

    uvicorn.run(
        "api.main:create_app",
        factory=True,
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="debug" if args.verbose else "info",
    )


if __name__ == "__main__":
    main()
