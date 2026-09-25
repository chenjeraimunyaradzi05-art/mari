"""
Model Loader Service
====================
Loads the trained artefacts this API's model-backed endpoints need, and is
explicit about the ones that are not there.

Exactly one endpoint family in this service reads a model at all: Career Compass
(``/api/v1/career-compass/*``) calls ``get_model("career_compass")``. The other
five routers — mentor match, safety score, income stream, ranker and feed —
compute their answers from the request itself and have no artefact to be
missing. That distinction is the whole point of this file, because it used to be
absent: the loader demanded an artefact for all six names and raised on the
first one it could not find. No artefact of any kind exists in this tree, so the
raise fired on every production boot and took the five endpoints that need
nothing at all down with the one that does — including the feed ranker, which is
the only consumer the Node API actually has. Meanwhile the Node side listed
``ML_SERVICE_URL`` as a required production launch check, so the platform could
not report itself ready without pointing at a service that could not start.

So a missing artefact no longer stops the service from starting, unless an
operator asks for that with ``ATHENA_REQUIRE_MODEL_ARTIFACTS=true`` — the right
setting once real artefacts exist and their disappearance should be an outage
rather than a quiet downgrade. Without it the service starts, ``/health``
reports ``degraded`` and names every model that is missing, ``/ready`` refuses,
and each endpoint that needs an absent model answers 503 carrying the same text.
``docs/runbooks/ML-SERVICE.md`` records what producing a real artefact would
actually take.

There are no synthetic stand-ins any more. This module used to fit a
``RandomForestRegressor`` on ``np.random.rand(100, 9)`` outside production and
serve its output as a career growth score. A number drawn from noise and
labelled a forecast is worse than no number, because a developer reading the
response had no way to tell the two apart — and the switch that was supposed to
keep it out of production was an environment-variable default. A 503 that says
"there is no trained model" is the honest answer, and it is now the only one.

Deleting the stand-in from this file did not by itself close the hole, because
the trainer could still produce one. ``career_compass``'s trainer fits XGBoost to
a generated dataset whose target is a weighted sum of its own features, and what
it writes to disk is an ordinary loadable ``model.joblib``. So every artefact now
carries a ``model_card.json`` saying what it was fitted to, and this loader
refuses any card that says ``synthetic``. See ``_unservable_reason``.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib


#: Model name -> artefact path, relative to whichever model directory is in use.
MODEL_ARTIFACTS: Dict[str, str] = {
    "career_compass": "career_compass/model.joblib",
    "mentor_match": "mentor_match/model.joblib",
    "safety_score": "safety_score/model.joblib",
    "income_stream": "income_stream/model.joblib",
    "light_ranker": "light_ranker/model.joblib",
    "heavy_ranker": "heavy_ranker/model.joblib",
}

#: Model name -> what stops working while it is missing. A name absent from this
#: map is declared above but read by nothing, so its absence costs the platform
#: nothing and must never be reported as though it did.
MODEL_CONSUMERS: Dict[str, str] = {
    "career_compass": (
        "POST /api/v1/career-compass/predict, POST /api/v1/career-compass/batch-predict "
        "and GET /api/v1/career-compass/feature-importance"
    ),
}

#: Model name -> the command that would produce its artefact, for the three that
#: have a training script at all. ``mentor_match``, ``safety_score`` and
#: ``income_stream`` have none: ``src/algorithms/`` holds an empty directory for
#: each, which is why they are named here by their absence rather than a command.
TRAINING_COMMANDS: Dict[str, str] = {
    "career_compass": "python -m src.algorithms.career_compass.train --output-dir artifacts/career_compass",
    "light_ranker": "python -m src.algorithms.light_ranker.train --output-dir artifacts/light_ranker",
    "heavy_ranker": "python -m src.algorithms.heavy_ranker.train --output-dir artifacts/heavy_ranker",
}


class MissingModelArtifacts(RuntimeError):
    """
    Raised at startup when a model some endpoint reads has no artefact and the
    operator has asked for strict startup.

    Carries the machine-readable list as well as the message, so a caller that
    wants to report rather than crash does not have to parse prose back out of
    an exception string.
    """

    def __init__(self, message: str, missing: List[str]) -> None:
        super().__init__(message)
        self.missing = list(missing)


def _model_directories() -> List[Path]:
    """
    Every directory an artefact might be in, in the order they are searched.

    ``MODEL_PATH`` is what docker-compose sets and is therefore authoritative
    when present. ``artifacts/`` is where all three training scripts write by
    default, and it was never searched — so an engineer could run a trainer,
    watch it report success, and still be told the model was missing. Searching
    both is cheaper than explaining that to the next person.
    """
    directories: List[Path] = []
    configured = os.getenv("MODEL_PATH")
    if configured:
        directories.append(Path(configured))
    else:
        directories.append(Path("models"))

    for fallback in (Path("artifacts"), Path("ml/artifacts")):
        if fallback not in directories:
            directories.append(fallback)

    return directories


#: The file a trainer writes beside its artefact to say what it was fitted to.
MODEL_CARD_FILENAME = "model_card.json"


def _unservable_reason(artifact: Path) -> Optional[str]:
    """
    Why this artefact must not answer a member, or ``None`` when nothing is wrong
    with it.

    An artefact on disk used to be proof enough. It is not: ``career_compass``'s
    trainer will happily fit XGBoost to ``generate_synthetic_data`` — a target
    that is a fixed weighted sum of the features — and write a ``model.joblib``
    that is byte-for-byte as loadable as a real one. Loading that and serving its
    output as a career growth score is the same fabrication the noise-fitted
    ``RandomForestRegressor`` in this file used to commit, only laundered through
    a file. So the trainer stamps every artefact with a model card, and a card
    that says ``synthetic`` (or that says ``servable: false`` for any other
    reason a future trainer decides on) keeps the model out of service.

    A missing card is not a rejection. Nothing has ever written one before this,
    and refusing an artefact somebody trained last year over a file that did not
    exist then would be a different kind of wrong answer.
    """
    card_path = artifact.parent / MODEL_CARD_FILENAME
    if not card_path.exists():
        return None

    try:
        with card_path.open("r", encoding="utf-8") as handle:
            card = json.load(handle)
    except (OSError, ValueError) as error:
        return f"{card_path} could not be read ({type(error).__name__}: {error})"

    if not isinstance(card, dict):
        return f"{card_path} does not contain an object"

    if card.get("trained_on") == "synthetic":
        note = card.get("note") or "the artefact was fitted to generated data, not real data"
        return f"trained on synthetic data — {note}"

    if card.get("servable") is False:
        note = card.get("note") or "the trainer marked it unservable"
        return f"marked unservable in {MODEL_CARD_FILENAME} — {note}"

    return None


def _require_artifacts() -> bool:
    """
    Whether a missing artefact should stop the service from starting.

    Off by default, in every environment. A service that refuses to boot is only
    useful when somebody is watching for it; refusing to boot over artefacts
    that have never existed in this repository just meant nobody could run the
    five endpoints that need no artefact at all.
    """
    return (os.getenv("ATHENA_REQUIRE_MODEL_ARTIFACTS") or "").lower() in {"1", "true", "yes", "on"}


def _environment_name() -> str:
    return (
        os.getenv("ATHENA_ENV")
        or os.getenv("ENVIRONMENT")
        or os.getenv("APP_ENV")
        or os.getenv("NODE_ENV")
        or "development"
    ).lower()


class ModelLoader:
    """Singleton model loader for ML models."""

    _instance: Optional["ModelLoader"] = None
    _models: Dict[str, Any] = {}
    _status: Dict[str, bool] = {}
    _searched: List[str] = []
    _load_errors: Dict[str, str] = {}

    def __new__(cls) -> "ModelLoader":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def load_all_models(self) -> None:
        """
        Load every artefact that is present, and account for every one that is
        not.

        Never raises for a model nothing reads, whatever the environment. Raises
        ``MissingModelArtifacts`` only when a model an endpoint reads is absent
        *and* ``ATHENA_REQUIRE_MODEL_ARTIFACTS`` is on, and then with a message
        that names the model, every path that was searched for it, what stops
        working without it, and the command that would produce it.
        """
        directories = _model_directories()
        self._searched = [str(directory.resolve()) for directory in directories]
        self._load_errors = {}

        for name, relative_path in MODEL_ARTIFACTS.items():
            artifact = self._find_artifact(relative_path, directories)

            if artifact is None:
                self._status[name] = False
                if name in MODEL_CONSUMERS:
                    print(f"  ✗ No artefact for {name}: {MODEL_CONSUMERS[name]} will answer 503")
                else:
                    print(f"  – No artefact for {name}; nothing in this service reads it, so nothing is affected")
                continue

            unservable = _unservable_reason(artifact)
            if unservable is not None:
                self._status[name] = False
                self._load_errors[name] = f"refused {artifact}: {unservable}"
                print(f"  ✗ Refused {artifact} for {name}: {unservable}")
                continue

            try:
                self._models[name] = joblib.load(artifact)
                self._status[name] = True
                print(f"  ✓ Loaded {name} from {artifact}")
            except Exception as error:  # noqa: BLE001 - the reason has to reach /health intact
                self._status[name] = False
                self._load_errors[name] = f"{type(error).__name__}: {error}"
                print(f"  ✗ Found {artifact} for {name} but could not load it: {error}")

        missing = self.missing_consumed_models()
        if missing:
            message = self.describe_missing(missing)
            if _require_artifacts():
                raise MissingModelArtifacts(message, missing)
            print(message)

    def _find_artifact(self, relative_path: str, directories: List[Path]) -> Optional[Path]:
        for directory in directories:
            candidate = directory / relative_path
            if candidate.exists():
                return candidate
        return None

    def missing_consumed_models(self) -> List[str]:
        """The models some endpoint reads and that are not loaded, in declaration order."""
        return [name for name in MODEL_ARTIFACTS if name in MODEL_CONSUMERS and not self._status.get(name, False)]

    def describe_missing(self, missing: Optional[List[str]] = None) -> str:
        """
        The full, actionable account of what is missing.

        Used verbatim in three places — the startup log, the startup exception
        and the 503 body of every endpoint that needs an absent model — so that
        an operator who sees one of them has already seen all of it. The message
        this replaced was the single line "Missing ML model artifacts in
        production mode:" followed by six paths, which told a reader that
        something was wrong and nothing about what to do next.
        """
        names = self.missing_consumed_models() if missing is None else missing
        if not names:
            return "Every model an endpoint reads is loaded."

        lines = [
            f"No trained model artefact is available for: {', '.join(names)}.",
            f"Searched, in order: {', '.join(self._searched) or 'nothing (models have not been loaded yet)'}.",
            "",
        ]

        for name in names:
            lines.append(f"{name}:")
            lines.append(f"  needed by   {MODEL_CONSUMERS.get(name, 'nothing in this service')}")
            lines.append(f"  expected at <model directory>/{MODEL_ARTIFACTS[name]}")
            if name in self._load_errors:
                lines.append(f"  present but not usable: {self._load_errors[name]}")
            command = TRAINING_COMMANDS.get(name)
            if command:
                lines.append(f"  produced by {command} (run from the ml/ directory)")
            else:
                lines.append("  produced by nothing in this repository: src/algorithms/ has no trainer for it")
            lines.append("")

        lines.append(
            "ATHENA_REQUIRE_MODEL_ARTIFACTS is on, so this stops the service from starting."
            if _require_artifacts()
            else "Those endpoints answer 503 until an artefact exists; the rest of the service is unaffected."
        )
        lines.append(
            "Point MODEL_PATH at a directory that holds the artefact, or read "
            "docs/runbooks/ML-SERVICE.md, which records what turning this service on would "
            "actually require."
        )
        return "\n".join(lines)

    def get_model(self, name: str) -> Optional[Any]:
        """
        Get a loaded model by name, or ``None`` when it is not loaded.

        Gated on ``_status`` and not only on the dictionary, because this class
        is a singleton whose state survives a second ``load_all_models``. Without
        the gate, a model that loaded once and was refused on the next pass — an
        artefact replaced by a synthetically trained one, say — would still be
        handed to the endpoint that asked for it, while ``/health`` reported it
        missing. The two must never be able to disagree: this is the function
        every router calls to decide whether to answer or to raise 503.
        """
        if not self._status.get(name, False):
            return None
        return self._models.get(name)

    def get_status(self) -> Dict[str, bool]:
        """Get loading status of all models."""
        return self._status.copy()

    def get_report(self) -> Dict[str, Any]:
        """
        What ``/health`` publishes about the models.

        Separates "missing and nothing reads it" from "missing and an endpoint
        needs it", because reporting six missing artefacts with equal weight is
        how the real one — career_compass — stayed invisible among five that do
        not matter.
        """
        missing = self.missing_consumed_models()
        return {
            "loaded": self.get_status(),
            "searched": list(self._searched),
            "missing_consumed": missing,
            "unread_declared": [
                name for name in MODEL_ARTIFACTS if name not in MODEL_CONSUMERS and not self._status.get(name, False)
            ],
            "environment": _environment_name(),
            "strict_startup": _require_artifacts(),
            "detail": self.describe_missing(missing) if missing else None,
        }

    def is_ready(self) -> bool:
        """
        Whether every endpoint in this service can answer.

        False while a model some endpoint reads is absent, even though the other
        five routers are perfectly able to serve — ``/ready`` is a promise about
        the whole surface, and the endpoints that still work are reported one by
        one in ``/health``.
        """
        return not self.missing_consumed_models()

    async def cleanup(self) -> None:
        """Cleanup resources on shutdown."""
        self._models.clear()
        self._status.clear()
        self._searched = []
        self._load_errors = {}
