from __future__ import annotations

from typing import List

import torch
from torch import nn


class HeavyRankerNet(nn.Module):
    def __init__(self, input_dim: int, hidden_dims: List[int], dropout: float = 0.2) -> None:
        super().__init__()
        layers = []
        last_dim = input_dim
        for dim in hidden_dims:
            layers.append(nn.Linear(last_dim, dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            last_dim = dim
        layers.append(nn.Linear(last_dim, 1))
        self.net = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)
