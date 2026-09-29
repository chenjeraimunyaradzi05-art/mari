"""
Fixtures shared by every ML service test.

Two things about this service make isolation deliberate rather than automatic.

``src.api.main`` reads its deployment posture — the shared key, DEBUG, the
environment name — once, at import. A test that needs a different posture
therefore imports the module afresh under that posture (``load_main``), rather
than patching attributes afterwards: patching would test the patch, not the
startup code a real deployment runs.

``ModelLoader`` is a process-wide singleton whose model and status maps live on
the class, and it searches ``./artifacts`` and ``./ml/artifacts`` relative to
the working directory as well as ``MODEL_PATH``. Every test gets an empty
loader, a ``MODEL_PATH`` of its own and a working directory of its own, so an
artefact a developer trained locally can never make a test pass or fail.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType
from typing import Callable, Iterator, Optional

import pytest
from fastapi.testclient import TestClient

from src.api.services.model_loader import ModelLoader

#: Every environment variable the service reads to decide how it is deployed.
POSTURE_VARIABLES = (
    "ML_SERVICE_KEY",
    "DEBUG",
    "ATHENA_ENV",
    "ENVIRONMENT",
    "APP_ENV",
    "NODE_ENV",
    "MODEL_PATH",
    "ATHENA_REQUIRE_MODEL_ARTIFACTS",
    "NODE_SERVICE_URL",
)


def reset_model_loader() -> None:
    loader = ModelLoader()
    loader._models.clear()
    loader._status.clear()
    loader._searched = []
    loader._load_errors = {}


@pytest.fixture(autouse=True)
def model_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[Path]:
    """An empty model directory as MODEL_PATH, a clean environment and a clean loader."""
    for name in POSTURE_VARIABLES:
        monkeypatch.delenv(name, raising=False)

    models = tmp_path / "models"
    models.mkdir()
    monkeypatch.setenv("MODEL_PATH", str(models))

    workdir = tmp_path / "work"
    workdir.mkdir()
    monkeypatch.chdir(workdir)

    reset_model_loader()
    yield models
    reset_model_loader()


@pytest.fixture
def load_main(monkeypatch: pytest.MonkeyPatch) -> Iterator[Callable[..., ModuleType]]:
    """
    Import ``src.api.main`` afresh with the given environment.

    ``load_main(ML_SERVICE_KEY="k", ATHENA_ENV="production")`` sets those
    variables and imports; a value of ``None`` unsets one. The module is dropped
    from ``sys.modules`` first, so an import that raised in an earlier test
    leaves nothing half-built behind for the next.
    """

    def _load(**env: Optional[str]) -> ModuleType:
        for key, value in env.items():
            if value is None:
                monkeypatch.delenv(key, raising=False)
            else:
                monkeypatch.setenv(key, value)
        sys.modules.pop("src.api.main", None)
        return importlib.import_module("src.api.main")

    yield _load
    sys.modules.pop("src.api.main", None)


@pytest.fixture
def client(load_main: Callable[..., ModuleType]) -> Iterator[TestClient]:
    """The service as a developer runs it: no key, not production, startup and shutdown run."""
    main = load_main()
    with TestClient(main.app) as test_client:
        yield test_client
