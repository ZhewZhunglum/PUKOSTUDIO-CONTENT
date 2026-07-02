"""
Handler registry — lives in its own module so that both main.py (run as __main__)
and handler files (imported as app.workers.handlers.*) share the SAME dict.

Python's "double-import" problem: when main.py is run with `python -m app.workers.main`
it becomes __main__, but handler files do `from app.workers.main import register_handler`
which causes Python to load app.workers.main *again* as a separate module object, giving
a second, empty _HANDLERS dict. Moving the registry here breaks that cycle.
"""
from collections.abc import Callable, Coroutine
from typing import Any

# Shared handler registry: task_type → async callable
_HANDLERS: dict[str, Callable[[dict[str, Any]], Coroutine[Any, Any, dict[str, Any]]]] = {}


def register_handler(task_type: str) -> Callable:
    """Decorator that registers an async function as the handler for task_type."""
    def decorator(fn: Callable) -> Callable:
        _HANDLERS[task_type] = fn
        return fn
    return decorator
