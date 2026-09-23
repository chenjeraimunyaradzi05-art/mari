# Athena ML

The Python ML training and serving stack for ATHENA's ranking and career
prediction models.

**This service is optional and is currently off.** No trained model artefact
exists in this repository, `ML_SERVICE_URL` is not a required production launch
check, and the one thing in the platform that uses this service — the feed
re-ranker — falls back to the engagement order without it.
[`docs/runbooks/ML-SERVICE.md`](../docs/runbooks/ML-SERVICE.md) records what
turning it on would actually require. Read that before starting work here.

## Structure

- `config/` — training configs for CareerCompass, the light ranker and the heavy ranker.
- `src/algorithms/` — training code. Only those three have any; the
  `income_stream`, `mentor_match` and `safety_score` directories are empty.
- `src/api/` — the FastAPI service that is actually served (`src.api.main:app`,
  which is what the Dockerfile runs).
- `src/serving/` — a second, older FastAPI app that nothing runs. It imports
  `ml.src.algorithms...`, which does not resolve under the Dockerfile's
  `PYTHONPATH`. Do not add to it; see the runbook.
- An `artifacts` directory is where the training scripts write. It is not in the
  repository, because nothing has been trained.

## Setup

Create a Python environment and install dependencies from `requirements.txt`.

## Training

Each algorithm provides a standalone training script.

**If no dataset is provided, a synthetic one is generated.** That is a smoke
test for the pipeline, not a way to produce a model: the synthetic target is a
hand-typed weight vector over the features plus Gaussian noise, so an artefact
trained on it will load and score and mean nothing. Do not ship one.

- CareerCompass (XGBoost regressor) → `artifacts/career_compass/model.joblib`
  ```bash
  python -m src.algorithms.career_compass.train --output-dir artifacts/career_compass
  ```
- Light Ranker (fast linear model) → `artifacts/light_ranker/model.joblib`
- Heavy Ranker (deep neural net) → `artifacts/heavy_ranker/model.pt`

The heavy ranker's `model.pt` is not loadable by the API's model loader, which
reads `model.joblib` through `joblib.load`. Wiring it up needs a torch branch;
the runbook lists it.

## Serving

`src/api/main.py` exposes:

- `GET /health` — `healthy` only when every model some endpoint reads is loaded,
  `degraded` otherwise, with `models` naming what is missing and why it matters.
- `GET /ready` — 503 while any such model is missing.
- `POST /api/v1/career-compass/*` — the only endpoints that read a model. 503
  while there is no artefact, with the full account in the body.
- `POST /api/v1/mentor-match/*`, `/api/v1/safety-score/*`,
  `/api/v1/income-stream/*`, `/api/v1/ranker/*`, `/api/v1/feed/*` — hand-written
  scoring over the request body. No model, so nothing to be missing.

Set `MODEL_PATH` to the directory holding the artefacts. The loader searches
`MODEL_PATH` first, then an `artifacts` or `ml/artifacts` directory, so a local
training run is found without configuring anything.

Set `ATHENA_REQUIRE_MODEL_ARTIFACTS=true` once real artefacts exist: a model an
endpoint reads that has no artefact then stops the service at startup, with a
message naming it, instead of degrading quietly.

`ML_SERVICE_KEY` must match the value the Node API sends as `X-ML-Key`. Without
it, every endpoint except `/health` is open to anything that can reach the port.

## Notes

- All models accept feature maps keyed by feature name.
- Feature ordering is derived from `feature_columns.json` stored next to each
  model artifact.
- There are no synthetic stand-in models. An endpoint with no artefact answers
  503; it does not invent a number.
