"""ASGI entry point for local development: `uvicorn backend.app.main:app --reload`."""

from .app.main import app  # noqa: F401
