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

**Synthetic data is a smoke test for the pipeline, not a way to produce a
model.** The synthetic target is a hand-typed weight vector over the features
plus Gaussian noise, so an artefact trained on it will load and score and mean
nothing. The two kinds of trainer treat it differently:

- CareerCompass refuses to train without `--data` unless you pass
  `--allow-synthetic-data`, and an artefact trained that way is stamped
  `"trained_on": "synthetic"` in its `model_card.json`, which the API's model
  loader refuses to serve.
- The light and heavy rankers still fall back to a generated dataset when no
  `--data` is given, and write no model card. Nothing in the API loads either
  of them today (`MODEL_CONSUMERS` in `src/api/services/model_loader.py` names
  only CareerCompass), but do not ship one.

- CareerCompass (XGBoost regressor) → `artifacts/career_compass/model.joblib`
  ```bash
  python -m src.algorithms.career_compass.train --data path/to/career_data.csv --output-dir artifacts/career_compass
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
  The Node API's feed ranker runs against either word, because the feed router
  reads no model; a Node caller that needs a model asks for it by name
  (`mlService.isReady('career_compass')`) and is refused until it is loaded.
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

`ML_SERVICE_KEY` must match the value the Node API sends as `X-ML-Key`. With it
set, every path except `/health` needs the key, `/docs`, `/redoc` and the
`GET /openapi.json` schema route included. Without it every endpoint is open to anything that can
reach the port, so the service refuses to start without one when the environment
name (`ATHENA_ENV`, `ENVIRONMENT`, `APP_ENV` or `NODE_ENV`) is `production`.

`DEBUG=true` makes an unhandled error return its exception text. It is read as a
boolean (`DEBUG=false` is off) and ignored in production.

The repository's `docker-compose.yml` is a development stack: it builds the
`development` image with `--reload`, sets `DEBUG=true`, sets no key and
publishes port 8000. Do not deploy this service with it.

## Notes

- All models accept feature maps keyed by feature name.
- Feature ordering is derived from `feature_columns.json` stored next to each
  model artifact.
- There are no synthetic stand-in models. An endpoint with no artefact answers
  503; it does not invent a number.
