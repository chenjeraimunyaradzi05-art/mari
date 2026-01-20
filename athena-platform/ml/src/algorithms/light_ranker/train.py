from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List, Tuple

import joblib
import numpy as np
import pandas as pd
import yaml
from sklearn.linear_model import SGDRegressor
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

DEFAULT_FEATURES = [
    "engagement_rate",
    "recency_hours",
    "content_quality",
    "creator_reputation",
    "user_interest_score",
    "diversity_boost",
    "completion_rate",
    "sharing_rate",
]
DEFAULT_TARGET = "rank_score"


def load_config(config_path: Path | None) -> dict:
    if config_path and config_path.exists():
        with config_path.open("r", encoding="utf-8") as file:
            return yaml.safe_load(file)
    return {}


def generate_synthetic_data(n_rows: int, feature_columns: List[str], target: str) -> pd.DataFrame:
    rng = np.random.default_rng(24)
    data = {
        "engagement_rate": rng.uniform(0, 1, size=n_rows),
        "recency_hours": rng.exponential(24, size=n_rows).clip(0, 168),
        "content_quality": rng.normal(0.6, 0.15, size=n_rows).clip(0, 1),
        "creator_reputation": rng.normal(0.5, 0.2, size=n_rows).clip(0, 1),
        "user_interest_score": rng.uniform(0, 1, size=n_rows),
        "diversity_boost": rng.uniform(0, 0.2, size=n_rows),
        "completion_rate": rng.uniform(0.2, 1.0, size=n_rows),
        "sharing_rate": rng.uniform(0, 0.4, size=n_rows),
    }
    frame = pd.DataFrame(data)
    weights = np.array([0.35, -0.12, 0.2, 0.15, 0.25, 0.1, 0.18, 0.15])
    score = frame[feature_columns].values @ weights
    noise = rng.normal(0, 0.05, size=n_rows)
    frame[target] = (score + noise).clip(0, 1)
    return frame


def prepare_dataset(data_path: Path, feature_columns: List[str], target: str) -> Tuple[pd.DataFrame, pd.Series]:
    if data_path.exists():
        frame = pd.read_csv(data_path)
    else:
        frame = generate_synthetic_data(10000, feature_columns, target)
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

    model = SGDRegressor(**params)
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

    print(f"Light Ranker trained. RMSE={rmse:.3f} R2={r2:.3f}")
    print(f"Artifacts saved to: {output_dir}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train Light Ranker model")
    parser.add_argument("--data", default="ml/data/light_ranker.csv", help="CSV dataset path")
    parser.add_argument("--config", default="ml/config/light_ranker.yaml", help="Config YAML path")
    parser.add_argument("--output-dir", default="ml/artifacts/light_ranker", help="Artifact output directory")
    return parser


if __name__ == "__main__":
    train_model(build_parser().parse_args())
