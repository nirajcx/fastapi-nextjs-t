from typing import Optional

from main import app


def create_app(settings: Optional[object] = None):
    """
    Application factory returning the configured FastAPI application instance.
    """
    return app
