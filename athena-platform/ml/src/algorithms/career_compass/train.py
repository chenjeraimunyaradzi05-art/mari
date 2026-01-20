from __future__ import annotations

import argparse
import json
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


def prepare_dataset(data_path: Path, feature_columns: List[str], target: str) -> Tuple[pd.DataFrame, pd.Series]:
    if data_path.exists():
        frame = pd.read_csv(data_path)
    else:
        frame = generate_synthetic_data(5000, feature_columns, target)
    frame = frame.dropna(subset=feature_columns + [target])
    return frame[feature_columns], frame[target]


def train_model(args: argparse.Namespace) -> None:
    config = load_config(Path(args.config) if args.config else None)
    feature_columns = config.get("schema", {}).get("feature_columns", DEFAULT_FEATURES)
    target = config.get("schema", {}).get("target", DEFAULT_TARGET)

    params = config.get("model", {}).get("params", {})
    training = config.get("training", {})

    x, y = prepare_dataset(Path(args.data), feature_columns, target)
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

    print(f"CareerCompass trained. RMSE={rmse:.3f} R2={r2:.3f}")
    print(f"Artifacts saved to: {output_dir}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train CareerCompass XGBoost model")
    parser.add_argument("--data", default="ml/data/career_compass.csv", help="CSV dataset path")
    parser.add_argument("--config", default="ml/config/career_compass.yaml", help="Config YAML path")
    parser.add_argument("--output-dir", default="ml/artifacts/career_compass", help="Artifact output directory")
    return parser


if __name__ == "__main__":
    train_model(build_parser().parse_args())
