# The ML service is optional, and is off

**Decided 2026-09-23. Read before adding `ML_SERVICE_URL` to anything that
blocks a launch, and before starting work on models.**

## What was wrong

`/health/launch-readiness` listed `ML_SERVICE_URL` as a **required** production
check, so the endpoint answered `not_ready` (HTTP 503) without it.

The Python service the URL would point at could not start. `ModelLoader`
demanded a `model.joblib` for all six algorithm names and raised on the first
one it could not find, and **no trained model artefact of any kind exists
anywhere in this repository** — no `.joblib`, `.pkl`, `.pt`, `.onnx` or `.h5`
under `ml/`, and neither an `ml/artifacts` nor an `ml/data` directory. Three of
the six algorithm directories (`src/algorithms/income_stream`, `mentor_match`,
`safety_score`) contain no files at all.

So the platform's own readiness endpoint required a service that was guaranteed
to crash at boot. It could never report itself ready, and no amount of
configuration would have changed that.

Outside production the loader filled the gap by fitting a
`RandomForestRegressor` on `np.random.rand(100, 9)` and serving its output as a
career growth score. That is not a weaker prediction, it is a random number with
a forecast's label on it, and nothing in the response let a reader tell the two
apart.

## What is true now

| | |
|---|---|
| `ML_SERVICE_URL` in launch readiness | **Reported, not required.** `/health/launch-readiness` can return `ready` without it. |
| `ML_SERVICE_URL` in `/health/detailed` | Reported as `degraded` with the reason, plus the ranker's hit counts. Never `down`. |
| Missing artefact at ML service startup | The service **starts**. `/health` says `degraded` and names what is missing; `/ready` refuses with the same text. |
| Endpoints that need an absent model | HTTP 503 carrying the full account: what is missing, every path searched, and the command that would produce it. |
| Synthetic placeholder models | **Removed.** There is no code path that invents a prediction. |

The decision this records: **we did not make the promise true, so we stopped
making it.** Producing real models is out of scope, and a launch gate that can
never pass is worse than no gate — it trains people to ignore the endpoint.

## What actually depends on the ML service

Almost nothing, which is why demoting it is safe.

**The feed re-ranker is the only real consumer.**
`server/src/services/feed-ml.service.ts` posts feed candidates to
`POST /api/v1/feed/generate` and re-orders the feed by the returned positions.
Every failure path — not configured, not ready, unreachable, refused, empty
answer — returns the engagement order untouched. A member never sees a blank
feed because the model is absent.

That fallback is now **counted**. `/health/detailed` → `checks.ml_service.details.feedRanking`
carries `attempts`, `applied`, `skippedNotReady`, `refused`, `unavailable`,
`emptyResponse` and the last skip reason, and the skip is logged at most once
every five minutes. A ranker that is configured and has applied zero times out
of thousands of feeds is now visible instead of perfectly silent.

**`mlInferenceWorker` is not a consumer.** `server/src/services/workers.service.ts`
defines a BullMQ worker that calls `predictCareerGrowth`, `calculateSafetyScore`
and `findMentorMatches`, but `queueMLInference` in `server/src/utils/queue.ts`
has no caller anywhere in `server/src`. Nothing is ever enqueued, so nothing
ever runs.

**Five of the six Python routers need no model at all.** `feed`, `ranker`,
`safety_score`, `mentor_match` and `income_stream` compute their answers from
the request body with hand-written scoring. Only `career_compass` calls
`model_loader.get_model(...)`. That is why a missing artefact no longer stops
the service starting: it used to take the five routers that need nothing down
with the one that does, including the feed ranker that is the only thing the
Node API asks for.

## What turning it on would actually require

Not a weekend. In rough dependency order:

1. **Real training data, and the legal basis to use it.** `train.py` falls back
   to `generate_synthetic_data(5000, ...)` when the CSV is absent — a
   hand-typed weight vector plus Gaussian noise. An artefact produced that way
   is the placeholder problem with a longer runtime: it will load, it will
   score, and it will mean nothing. For ATHENA this is member career and safety
   data, so it needs a lawful basis, a retention decision, and a privacy review
   before a row is exported. Nothing in this repository does any of that.

2. **Trainers for the three algorithms that have none.** `income_stream`,
   `mentor_match` and `safety_score` are empty directories. Their routers'
   current heuristics are the whole implementation.

3. **Fix the artefact path and format mismatches.**
   - `career_compass/train.py` and `light_ranker/train.py` write
     `<output-dir>/model.joblib`, defaulting to a subdirectory of
     `ml/artifacts`. The loader reads `MODEL_PATH` (docker-compose sets
     `/app/models`, a named volume). The loader now also searches an
     `artifacts` and an `ml/artifacts` directory, so a local run is found, but a
     container still needs the artefact baked into the image or mounted.
   - `heavy_ranker/train.py` writes `model.pt` via `torch.save`, while the
     loader expects `heavy_ranker/model.joblib` and uses `joblib.load`. Loading
     it needs a torch branch plus the `HeavyRankerNet` class from
     `src/algorithms/heavy_ranker/model.py`.

4. **Decide what `ml/src/serving/app.py` is.** It is a second, separate FastAPI
   app that imports `ml.src.algorithms...`, a package path that does not resolve
   under the Dockerfile's `PYTHONPATH=/app/src`. The Dockerfile runs
   `src.api.main:app`, so `serving/app.py` is unreachable. Either delete it or
   make it the one entry point; having two is how the next person loads the
   wrong one.

5. **Tests and CI.** `ml/requirements.txt` pulls in pytest, pytest-asyncio and
   pytest-cov. There is not one test file under `ml/`. No workflow in
   `.github/workflows/` builds the ML image, runs a Python test, or deploys the
   service; `docker-compose.yml` builds the `development` target with `--reload`
   only.

6. **A place to run it and a way to reach it.** The service is designed to sit
   on a private network behind the Node API. `ML_SERVICE_KEY` must be set to the
   same value on both sides (the API sends it as `X-ML-Key`); without it every
   request except `/health` is accepted from anyone who can reach the port.

7. **Compliance review before `safety_score` is wired to anything.** Its content
   moderation is a keyword list, and its output would be scoring members of a
   platform whose users include domestic-violence survivors. An automated safety
   score that a member cannot see, question or appeal is a decision about her,
   not a feature.

## Turning it on, once artefacts exist

```bash
# From the ml/ directory
python -m src.algorithms.career_compass.train --output-dir artifacts/career_compass
```

Then, on the service:

```bash
# The directory, not the file: the loader appends career_compass/model.joblib.
MODEL_PATH=/app/models
ATHENA_REQUIRE_MODEL_ARTIFACTS=true   # see below
ML_SERVICE_KEY=<shared with the API>
```

`ATHENA_REQUIRE_MODEL_ARTIFACTS` is **off by default and should be on once real
artefacts exist.** With it on, a model an endpoint reads that has no artefact
raises `MissingModelArtifacts` at startup rather than degrading quietly — which
is what you want when the artefact is supposed to be there and its
disappearance is an incident. With it off (today's state) the service starts and
reports. It never blocks on a model nothing reads, in either mode.

On the API:

```bash
ML_SERVICE_URL=http://ml-service:8000
ML_SERVICE_KEY=<the same value>
ML_FEED_RANKING=true    # false keeps the service for predictions but ranks the feed by engagement only
```

## Verifying

```bash
curl -s $ML_SERVICE_URL/health | jq '.status, .models'   # "healthy" only when every consumed model loaded
curl -s -o /dev/null -w '%{http_code}\n' $ML_SERVICE_URL/ready   # 200, or 503 with the reason
```

From the API, with a diagnostics token:

```bash
curl -s -H "x-health-token: $HEALTH_DIAGNOSTICS_TOKEN" \
  https://<api>/health/detailed | jq '.checks.ml_service'
```

`details.feedRanking.applied` climbing alongside `attempts` is the only evidence
that the ranker is doing anything. If `attempts` climbs and `applied` stays at
zero, read `lastSkipReason`: `service not ready` is a deployment problem,
`refused with 422` is the Node and Python candidate schemas having drifted apart
and is logged at error level with the item types that were sent.

## Still open

`server/scripts/check-env.js` lists `ML_SERVICE_URL` under
`REQUIRED_IN_PRODUCTION`. That file says in its own comment that it mirrors the
launch-readiness endpoint, and it no longer does. It is not wired into any CI
workflow, so it blocks nothing today, but it will tell the next person to set a
variable that does nothing. Move the entry out of `REQUIRED_IN_PRODUCTION`.

`server/.env.production.template` is already correct — it says "Optional ML
service (recommendations); leave unset to disable" — and was the only place in
the repository that had been telling the truth about this.
