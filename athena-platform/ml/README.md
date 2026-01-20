# Athena ML

This folder contains the Python ML training and serving stack for Athena’s ranking and career prediction models.

## Structure
- `config/`: Training configs for each model.
- `src/algorithms/`: Training code for CareerCompass, Light Ranker, Heavy Ranker.
- `src/serving/`: FastAPI inference service.
- `artifacts/`: Trained model outputs (created on training).

## Setup
Create a Python environment and install dependencies from `requirements.txt`.

## Training
Each algorithm provides a standalone training script. If no dataset is provided, a synthetic dataset will be generated automatically.

- CareerCompass (XGBoost regressor)
  - Output: `ml/artifacts/career_compass/model.joblib`

- Light Ranker (fast linear model)
  - Output: `ml/artifacts/light_ranker/model.joblib`

- Heavy Ranker (deep neural net)
  - Output: `ml/artifacts/heavy_ranker/model.pt`

## Serving
FastAPI service exposes:
- `GET /health`
- `POST /predict/career-compass`
- `POST /rank/light`
- `POST /rank/heavy`

Set `ATHENA_ML_MODEL_DIR` to the artifacts directory if running from a different working directory.

## Notes
- All models accept feature maps keyed by feature name.
- Feature ordering is derived from `feature_columns.json` stored next to each model artifact.
