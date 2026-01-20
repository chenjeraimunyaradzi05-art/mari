from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
import torch
from fastapi import FastAPI

from ml.src.algorithms.heavy_ranker.model import HeavyRankerNet
from ml.src.serving.schemas import CareerCompassRequest, RankRequest, RankResponse, ScoreResponse

app = FastAPI(title="Athena ML Serving")

MODEL_DIR = Path(os.getenv("ATHENA_ML_MODEL_DIR", "ml/artifacts"))

CAREER_DIR = MODEL_DIR / "career_compass"
LIGHT_DIR = MODEL_DIR / "light_ranker"
HEAVY_DIR = MODEL_DIR / "heavy_ranker"

career_model = None
career_features: List[str] = []
light_model = None
light_features: List[str] = []
heavy_model = None
heavy_features: List[str] = []
heavy_mean: np.ndarray | None = None
heavy_std: np.ndarray | None = None


def load_feature_columns(path: Path) -> List[str]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def prepare_features(feature_columns: List[str], payload: Dict[str, float]) -> np.ndarray:
    values = [payload.get(col, 0.0) for col in feature_columns]
    return np.array(values, dtype=np.float32).reshape(1, -1)


@app.on_event("startup")
def load_models() -> None:
    global career_model, career_features, light_model, light_features
    global heavy_model, heavy_features, heavy_mean, heavy_std

    if (CAREER_DIR / "model.joblib").exists():
        career_model = joblib.load(CAREER_DIR / "model.joblib")
        career_features = load_feature_columns(CAREER_DIR / "feature_columns.json")

    if (LIGHT_DIR / "model.joblib").exists():
        light_model = joblib.load(LIGHT_DIR / "model.joblib")
        light_features = load_feature_columns(LIGHT_DIR / "feature_columns.json")

    if (HEAVY_DIR / "model.pt").exists():
        checkpoint = torch.load(HEAVY_DIR / "model.pt", map_location="cpu")
        heavy_features = checkpoint.get("feature_columns", [])
        input_dim = checkpoint.get("input_dim", len(heavy_features))
        hidden_dims = checkpoint.get("hidden_dims", [256, 128, 64])
        dropout = checkpoint.get("dropout", 0.2)
        heavy_model = HeavyRankerNet(input_dim=input_dim, hidden_dims=hidden_dims, dropout=dropout)
        heavy_model.load_state_dict(checkpoint["model_state"])
        heavy_model.eval()
        heavy_mean = np.array(checkpoint.get("mean", []), dtype=np.float32)
        heavy_std = np.array(checkpoint.get("std", []), dtype=np.float32)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/predict/career-compass", response_model=ScoreResponse)
def predict_career_compass(request: CareerCompassRequest) -> ScoreResponse:
    if career_model is None:
        return ScoreResponse(score=0.0)
    features = prepare_features(career_features, request.features)
    score = float(career_model.predict(features)[0])
    return ScoreResponse(score=score)


@app.post("/rank/light", response_model=RankResponse)
def rank_light(request: RankRequest) -> RankResponse:
    if light_model is None:
        return RankResponse(scores=[])
    scores = []
    for item in request.items:
        features = prepare_features(light_features, item)
        scores.append(float(light_model.predict(features)[0]))
    return RankResponse(scores=scores)


@app.post("/rank/heavy", response_model=RankResponse)
def rank_heavy(request: RankRequest) -> RankResponse:
    if heavy_model is None:
        return RankResponse(scores=[])
    scores = []
    for item in request.items:
        features = prepare_features(heavy_features, item)
        if heavy_mean is not None and heavy_std is not None and heavy_mean.size:
            features = (features - heavy_mean) / heavy_std
        tensor = torch.tensor(features, dtype=torch.float32)
        with torch.no_grad():
            score = float(heavy_model(tensor).item())
        scores.append(score)
    return RankResponse(scores=scores)
