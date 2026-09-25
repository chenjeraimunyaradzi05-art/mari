"""
CareerCompass trainer.

This script is the only thing in the repository that can produce the artefact
``/api/v1/career-compass/predict`` serves, so what it is allowed to produce
quietly matters more than how well it fits.

``prepare_dataset`` used to fall back to ``generate_synthetic_data`` whenever the
CSV was absent — which it always is, because no dataset is committed here — and
then went on to print "CareerCompass trained. RMSE=0.9 R2=0.98" and write
``model.joblib`` exactly as a real run would. The scores were high because the
target was a fixed weight vector over the features plus a little Gaussian noise,
so the model was recovering arithmetic, not learning anything about careers. An
engineer who ran the command got an artefact, a green metrics file and no way at
all to tell it apart from one trained on real career histories. Load it, and
every woman asking Career Compass where her career goes next is answered by a
dot product somebody typed in 2024.

So synthetic data is now something the operator has to ask for by name
(``--allow-synthetic-data``), and every artefact carries a ``model_card.json``
recording what it was trained on. The loader reads that card and refuses to
serve a synthetically trained model, which is what makes the flag safe to have:
it stays useful for testing the pipeline end to end, and it cannot become a
forecast shown to a member.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
import yaml
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

DEFAULT_FEATURES = [
    "years_experience",
    "current_salary",
    "education_level",
    "industry_growth",
    "skills_score",
    "leadership_score",
    "certifications",
    "location_index",
    "company_size",
]
DEFAULT_TARGET = "career_growth_score"


def load_config(config_path: Path | None) -> Dict:
    if config_path and config_path.exists():
        with config_path.open("r", encoding="utf-8") as file:
            return yaml.safe_load(file)
    return {}


def generate_synthetic_data(n_rows: int, feature_columns: List[str], target: str) -> pd.DataFrame:
    """
    A dataset shaped like the real one, with a target that is a weighted sum of
    its own features. Useful for checking that the pipeline runs; worthless as
    career data, because the only relationship in it is the one written on the
    line below. Nothing fitted to this may be served — see the module docstring.
    """
    rng = np.random.default_rng(42)
    data = {
        "years_experience": rng.integers(0, 20, size=n_rows),
        "current_salary": rng.normal(85000, 15000, size=n_rows).clip(35000, 200000),
        "education_level": rng.integers(1, 5, size=n_rows),
        "industry_growth": rng.normal(0.04, 0.02, size=n_rows).clip(-0.02, 0.15),
        "skills_score": rng.normal(70, 15, size=n_rows).clip(0, 100),
        "leadership_score": rng.normal(60, 18, size=n_rows).clip(0, 100),
        "certifications": rng.integers(0, 8, size=n_rows),
        "location_index": rng.normal(1.0, 0.2, size=n_rows).clip(0.5, 1.6),
        "company_size": rng.integers(20, 5000, size=n_rows),
    }
    frame = pd.DataFrame(data)
    weights = np.array([0.3, 0.25, 0.1, 0.15, 0.2, 0.15, 0.05, 0.1, 0.08])
    score = (frame[feature_columns].values @ weights) / 10.0
    noise = rng.normal(0, 2.5, size=n_rows)
    frame[target] = (score + noise).clip(0, None)
    return frame


def prepare_dataset(
    data_path: Path, feature_columns: List[str], target: str, allow_synthetic: bool
) -> Tuple[pd.DataFrame, pd.Series, str]:
    """
    Load the dataset, and say which one it is.

    The third return value is the whole point: it travels into the model card so
    that "this was fitted to numbers a random generator produced" survives out
    of this process and into the service that would otherwise serve it.
    """
    if data_path.exists():
        frame = pd.read_csv(data_path)
        source = f"file:{data_path}"
    elif allow_synthetic:
        frame = generate_synthetic_data(5000, feature_columns, target)
        source = "synthetic"
    else:
        raise SystemExit(
            f"No dataset at {data_path}.\n"
            "CareerCompass has no committed dataset, so there is nothing here to train on. Point "
            "--data at real career data, or pass --allow-synthetic-data to fit the generated set "
            "for a pipeline check — an artefact produced that way is stamped synthetic in its "
            "model_card.json and the API refuses to serve it."
        )
    frame = frame.dropna(subset=feature_columns + [target])
    return frame[feature_columns], frame[target], source


def train_model(args: argparse.Namespace) -> None:
    config = load_config(Path(args.config) if args.config else None)
    feature_columns = config.get("schema", {}).get("feature_columns", DEFAULT_FEATURES)
    target = config.get("schema", {}).get("target", DEFAULT_TARGET)

    params = config.get("model", {}).get("params", {})
    training = config.get("training", {})

    x, y, data_source = prepare_dataset(
        Path(args.data), feature_columns, target, args.allow_synthetic_data
    )
    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=training.get("test_size", 0.2),
        random_state=training.get("random_state", 42),
    )

    model = XGBRegressor(**params)
    model.fit(x_train, y_train)

    preds = model.predict(x_test)
    rmse = mean_squared_error(y_test, preds, squared=False)
    r2 = r2_score(y_test, preds)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_dir / "model.joblib")

    with (output_dir / "feature_columns.json").open("w", encoding="utf-8") as file:
        json.dump(feature_columns, file, indent=2)

    metrics = {"rmse": float(rmse), "r2": float(r2)}
    with (output_dir / "metrics.json").open("w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)

    # The card is what the loader reads before deciding whether this artefact
    # may answer a member. `trained_on` is the field that decides it; the rest is
    # there so that whoever finds a rejected artefact in six months can see why
    # without re-deriving it.
    synthetic = data_source == "synthetic"
    model_card = {
        "model": "career_compass",
        "trained_on": "synthetic" if synthetic else "dataset",
        "data_source": data_source,
        "rows": int(len(x)),
        "feature_columns": feature_columns,
        "target": target,
        "metrics": metrics,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "servable": not synthetic,
        "note": (
            "Fitted to generate_synthetic_data: the target is a fixed weighted sum of the "
            "features plus Gaussian noise, so the metrics above measure arithmetic recovery and "
            "say nothing about real careers. The API refuses to serve this artefact."
            if synthetic
            else f"Fitted to {data_source}."
        ),
    }
    with (output_dir / "model_card.json").open("w", encoding="utf-8") as file:
        json.dump(model_card, file, indent=2)

    if synthetic:
        print("⚠ Trained on SYNTHETIC data. RMSE and R2 below describe a weighted sum, not careers.")
        print("⚠ model_card.json marks this artefact unservable; the API will refuse to load it.")
    print(f"CareerCompass trained on {data_source}. RMSE={rmse:.3f} R2={r2:.3f}")
    print(f"Artifacts saved to: {output_dir}")
    if synthetic:
        # A non-zero status so a CI step that runs the trainer cannot mistake a
        # pipeline check for a delivered model.
        sys.exit(3)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train CareerCompass XGBoost model")
    parser.add_argument("--data", default="ml/data/career_compass.csv", help="CSV dataset path")
    parser.add_argument("--config", default="ml/config/career_compass.yaml", help="Config YAML path")
    parser.add_argument("--output-dir", default="ml/artifacts/career_compass", help="Artifact output directory")
    parser.add_argument(
        "--allow-synthetic-data",
        action="store_true",
        help=(
            "Fit the generated dataset when --data does not exist. For checking the pipeline "
            "only: the artefact is stamped synthetic and the API refuses to serve it."
        ),
    )
    return parser


if __name__ == "__main__":
    train_model(build_parser().parse_args())
