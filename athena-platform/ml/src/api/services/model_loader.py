"""
Model Loader Service
====================
Handles loading and managing ML models for the API.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional

import joblib


class ModelLoader:
    """Singleton model loader for ML models."""
    
    _instance: Optional["ModelLoader"] = None
    _models: Dict[str, Any] = {}
    _status: Dict[str, bool] = {}
    _ready: bool = False
    
    def __new__(cls) -> "ModelLoader":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def load_all_models(self) -> None:
        """Load all required models on startup."""
        model_configs = {
            "career_compass": "career_compass/model.joblib",
            "mentor_match": "mentor_match/model.joblib",
            "safety_score": "safety_score/model.joblib",
            "income_stream": "income_stream/model.joblib",
            "light_ranker": "light_ranker/model.joblib",
            "heavy_ranker": "heavy_ranker/model.joblib",
        }
        
        base_path = Path(os.getenv("MODEL_PATH", "models"))
        
        for name, rel_path in model_configs.items():
            try:
                model_path = base_path / rel_path
                if model_path.exists():
                    self._models[name] = joblib.load(model_path)
                    self._status[name] = True
                    print(f"  ✓ Loaded {name}")
                else:
                    # Create placeholder for development
                    self._models[name] = self._create_placeholder_model(name)
                    self._status[name] = True
                    print(f"  ⚠ Using placeholder for {name}")
            except Exception as e:
                print(f"  ✗ Failed to load {name}: {e}")
                self._status[name] = False
        
        self._ready = True
    
    def _create_placeholder_model(self, name: str) -> Any:
        """Create a placeholder model for development."""
        from sklearn.ensemble import RandomForestRegressor
        import numpy as np
        
        # Create a simple trained model
        model = RandomForestRegressor(n_estimators=10, random_state=42)
        X = np.random.rand(100, 9)
        y = np.random.rand(100) * 100
        model.fit(X, y)
        
        return model
    
    def get_model(self, name: str) -> Optional[Any]:
        """Get a loaded model by name."""
        return self._models.get(name)
    
    def get_status(self) -> Dict[str, bool]:
        """Get loading status of all models."""
        return self._status.copy()
    
    def is_ready(self) -> bool:
        """Check if all critical models are loaded."""
        critical_models = ["career_compass"]
        return all(self._status.get(m, False) for m in critical_models)
    
    async def cleanup(self) -> None:
        """Cleanup resources on shutdown."""
        self._models.clear()
        self._status.clear()
        self._ready = False
