"""
Helpers the tests share: a stand-in model, and a way to put an artefact where
the loader will look for one.

The stand-in lives in a module of its own rather than in a test file because
the loader reads artefacts with joblib, which unpickles a class by importing the
module it was defined in. A class defined inside a test module would be written
under a name nothing can import back.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import joblib


class StubCareerModel:
    """
    Answers the two things the career compass router asks of a model: a
    ``predict`` over rows of nine features and a ``feature_importances_`` with
    one entry per feature.

    It returns the same score for every row on purpose. What these tests check
    is the plumbing around a model — found, refused, served, reported — and a
    constant makes every number in the response traceable to the request.
    """

    def __init__(self, score: float = 62.5, importances: Optional[Sequence[float]] = None) -> None:
        self.score = score
        self.feature_importances_ = list(
            importances if importances is not None else [0.05, 0.3, 0.1, 0.02, 0.25, 0.1, 0.08, 0.05, 0.05]
        )
        self.rows_seen: List[List[float]] = []

    def predict(self, rows: Any) -> List[float]:
        # Kept so a test can check the order the router lays the features out
        # in, which is the order the trainer fitted them in.
        self.rows_seen.extend([float(value) for value in row] for row in rows)
        return [self.score for _ in rows]


def write_artifact(
    model_dir: Path,
    name: str,
    model: Any,
    card: Optional[Dict[str, Any]] = None,
) -> Path:
    """Write ``model`` where the loader expects ``name``'s artefact, with an optional model card."""
    target = model_dir / name / "model.joblib"
    target.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, target)
    if card is not None:
        (target.parent / "model_card.json").write_text(json.dumps(card), encoding="utf-8")
    return target


def career_profile(**overrides: Any) -> Dict[str, Any]:
    """A valid career compass request body."""
    profile: Dict[str, Any] = {
        "user_id": "member-1",
        "years_experience": 6,
        "current_salary": 85000,
        "education_level": 3,
        "skills_score": 64,
        "leadership_score": 48,
        "certifications": 1,
    }
    profile.update(overrides)
    return profile
