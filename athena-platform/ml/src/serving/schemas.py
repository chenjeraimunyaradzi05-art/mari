from __future__ import annotations

from typing import Dict, List

from pydantic import BaseModel, Field


class CareerCompassRequest(BaseModel):
    features: Dict[str, float] = Field(default_factory=dict)


class RankRequest(BaseModel):
    items: List[Dict[str, float]] = Field(default_factory=list)


class ScoreResponse(BaseModel):
    score: float


class RankResponse(BaseModel):
    scores: List[float]
