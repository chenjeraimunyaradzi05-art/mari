from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List, Tuple

import numpy as np
import pandas as pd
import torch
import yaml
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from ml.src.algorithms.heavy_ranker.model import HeavyRankerNet

DEFAULT_FEATURES = [
    "engagement_rate",
    "recency_hours",
    "content_quality",
    "creator_reputation",
    "user_interest_score",
    "diversity_boost",
    "completion_rate",
    "sharing_rate",
    "watch_time",
    "comment_rate",
    "profile_match",
    "session_depth",
]
DEFAULT_TARGET = "relevance_score"


def load_config(config_path: Path | None) -> dict:
    if config_path and config_path.exists():
        with config_path.open("r", encoding="utf-8") as file:
            return yaml.safe_load(file)
    return {}


def generate_synthetic_data(n_rows: int, feature_columns: List[str], target: str) -> pd.DataFrame:
    rng = np.random.default_rng(99)
    data = {
        "engagement_rate": rng.uniform(0, 1, size=n_rows),
        "recency_hours": rng.exponential(12, size=n_rows).clip(0, 168),
        "content_quality": rng.normal(0.7, 0.1, size=n_rows).clip(0, 1),
        "creator_reputation": rng.normal(0.6, 0.2, size=n_rows).clip(0, 1),
        "user_interest_score": rng.uniform(0, 1, size=n_rows),
        "diversity_boost": rng.uniform(0, 0.3, size=n_rows),
        "completion_rate": rng.uniform(0.2, 1.0, size=n_rows),
        "sharing_rate": rng.uniform(0, 0.5, size=n_rows),
        "watch_time": rng.normal(45, 15, size=n_rows).clip(5, 120),
        "comment_rate": rng.uniform(0, 0.2, size=n_rows),
        "profile_match": rng.uniform(0, 1, size=n_rows),
        "session_depth": rng.integers(1, 25, size=n_rows),
    }
    frame = pd.DataFrame(data)
    weights = np.array([0.4, -0.2, 0.35, 0.3, 0.25, 0.12, 0.2, 0.2, 0.28, 0.15, 0.22, 0.18])
    score = frame[feature_columns].values @ weights
    noise = rng.normal(0, 0.1, size=n_rows)
    frame[target] = (score + noise).clip(0, None)
    return frame


def prepare_dataset(data_path: Path, feature_columns: List[str], target: str) -> Tuple[np.ndarray, np.ndarray]:
    if data_path.exists():
        frame = pd.read_csv(data_path)
    else:
        frame = generate_synthetic_data(20000, feature_columns, target)
    frame = frame.dropna(subset=feature_columns + [target])
    x = frame[feature_columns].values.astype(np.float32)
    y = frame[target].values.astype(np.float32)
    return x, y


def standardize(x_train: np.ndarray, x_test: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    mean = x_train.mean(axis=0)
    std = x_train.std(axis=0) + 1e-6
    return (x_train - mean) / std, (x_test - mean) / std, mean, std


def train_model(args: argparse.Namespace) -> None:
    config = load_config(Path(args.config) if args.config else None)
    feature_columns = config.get("schema", {}).get("feature_columns", DEFAULT_FEATURES)
    target = config.get("schema", {}).get("target", DEFAULT_TARGET)

    model_cfg = config.get("model", {})
    training = config.get("training", {})

    x, y = prepare_dataset(Path(args.data), feature_columns, target)
    x_train, x_val, y_train, y_val = train_test_split(
        x,
        y,
        test_size=training.get("test_split", 0.2),
        random_state=42,
    )
    x_train, x_val, mean, std = standardize(x_train, x_val)

    train_dataset = TensorDataset(torch.tensor(x_train), torch.tensor(y_train))
    val_dataset = TensorDataset(torch.tensor(x_val), torch.tensor(y_val))

    batch_size = training.get("batch_size", 256)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    input_dim = model_cfg.get("input_dim", len(feature_columns))
    hidden_dims = model_cfg.get("hidden_dims", [256, 128, 64])
    dropout = model_cfg.get("dropout", 0.2)

    model = HeavyRankerNet(input_dim=input_dim, hidden_dims=hidden_dims, dropout=dropout)
    optimizer = torch.optim.Adam(model.parameters(), lr=training.get("learning_rate", 1e-3))
    loss_fn = nn.MSELoss()

    epochs = training.get("epochs", 20)
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            preds = model(batch_x)
            loss = loss_fn(preds, batch_y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * batch_x.size(0)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                preds = model(batch_x)
                loss = loss_fn(preds, batch_y)
                val_loss += loss.item() * batch_x.size(0)

        train_loss /= len(train_dataset)
        val_loss /= len(val_dataset)
        print(f"Epoch {epoch}/{epochs} - Train Loss: {train_loss:.4f} - Val Loss: {val_loss:.4f}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    torch.save(
        {
            "model_state": model.state_dict(),
            "input_dim": input_dim,
            "hidden_dims": hidden_dims,
            "dropout": dropout,
            "feature_columns": feature_columns,
            "mean": mean.tolist(),
            "std": std.tolist(),
        },
        output_dir / "model.pt",
    )

    with (output_dir / "metrics.json").open("w", encoding="utf-8") as file:
        json.dump({"val_loss": float(val_loss)}, file, indent=2)

    print("Heavy Ranker trained.")
    print(f"Artifacts saved to: {output_dir}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train Heavy Ranker model")
    parser.add_argument("--data", default="ml/data/heavy_ranker.csv", help="CSV dataset path")
    parser.add_argument("--config", default="ml/config/heavy_ranker.yaml", help="Config YAML path")
    parser.add_argument("--output-dir", default="ml/artifacts/heavy_ranker", help="Artifact output directory")
    return parser


if __name__ == "__main__":
    train_model(build_parser().parse_args())
