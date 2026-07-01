"""Test bootstrap: make backend.py importable without the Modal SDK.

backend.py only uses the modal module at import time to declare the app image,
secrets, and endpoint decorators; none of that behavior is under test here. A
minimal stub lets the extraction, validation, and prompt-building logic import
cleanly in a plain venv (fastapi + pillow + pydantic only).
"""

import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class _ImageStub:
    def pip_install(self, *args, **kwargs):
        return self

    def apt_install(self, *args, **kwargs):
        return self


class _AppStub:
    def __init__(self, *args, **kwargs):
        pass

    def function(self, *args, **kwargs):
        def decorator(f):
            return f

        return decorator


def _fastapi_endpoint(*args, **kwargs):
    def decorator(f):
        return f

    return decorator


modal_stub = types.ModuleType("modal")
modal_stub.Image = types.SimpleNamespace(debian_slim=lambda *a, **k: _ImageStub())
modal_stub.App = _AppStub
modal_stub.Secret = types.SimpleNamespace(from_name=lambda name: name)
modal_stub.fastapi_endpoint = _fastapi_endpoint

sys.modules.setdefault("modal", modal_stub)
