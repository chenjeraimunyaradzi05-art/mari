"""
Career Compass: the only endpoints in this service that read a model.

With no artefact they answer 503 carrying the loader's full account. With one,
the score is the model's output and nothing else, and the benchmark fields that
used to be filled with made-up numbers — a confidence of 0.85, a peer
percentile from four thresholds, an industry benchmark of 65.0 — stay null.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.api.services.model_loader import ModelLoader
from tests.support import StubCareerModel, career_profile, write_artifact

ENDPOINTS = [
    ("post", "/api/v1/career-compass/predict", career_profile()),
    ("post", "/api/v1/career-compass/batch-predict", {"profiles": [career_profile()]}),
    ("get", "/api/v1/career-compass/feature-importance", None),
]


@pytest.fixture
def served(model_dir, load_main):
    write_artifact(model_dir, "career_compass", StubCareerModel(score=62.5))
    main = load_main()
    with TestClient(main.app) as client:
        yield client


class TestWithoutAnArtefact:
    @pytest.mark.parametrize("method,path,body", ENDPOINTS)
    def test_every_endpoint_answers_503_with_the_account(self, client: TestClient, method, path, body):
        response = client.request(method.upper(), path, json=body)
        assert response.status_code == 503
        detail = response.json()["detail"]
        assert "No trained model artefact is available for: career_compass" in detail
        assert "career_compass/model.joblib" in detail
        assert "docs/runbooks/ML-SERVICE.md" in detail

    def test_a_malformed_profile_is_refused_before_the_model_is_asked(self, client: TestClient):
        response = client.post("/api/v1/career-compass/predict", json=career_profile(education_level=9))
        assert response.status_code == 422


class TestWithAnArtefact:
    def test_the_score_is_the_models_and_the_unmeasured_fields_are_null(self, served: TestClient):
        response = served.post("/api/v1/career-compass/predict", json=career_profile())
        assert response.status_code == 200
        body = response.json()
        assert body["user_id"] == "member-1"
        assert body["career_growth_score"] == 62.5
        assert body["confidence"] is None
        assert body["peer_percentile"] is None
        assert body["industry_benchmark"] is None

    def test_the_features_reach_the_model_in_the_order_it_was_trained_on(self, served: TestClient):
        served.post(
            "/api/v1/career-compass/predict",
            json=career_profile(
                years_experience=6,
                current_salary=85000,
                education_level=3,
                industry_growth=0.05,
                skills_score=64,
                leadership_score=48,
                certifications=1,
                location_index=1.1,
                company_size=250,
            ),
        )
        model = ModelLoader().get_model("career_compass")
        assert model.rows_seen[-1] == [6.0, 85000.0, 3.0, 0.05, 64.0, 48.0, 1.0, 1.1, 250.0]

    def test_the_salary_projection_is_arithmetic_on_her_own_salary(self, served: TestClient):
        body = served.post("/api/v1/career-compass/predict", json=career_profile(current_salary=100000)).json()
        rate = 0.03 + (62.5 / 100) * 0.07
        assert body["salary_projection"]["year_1"] == round(100000 * (1 + rate), 0)
        assert body["salary_projection"]["year_5"] == round(100000 * (1 + rate) ** 5, 0)

    def test_batch_predict_scores_every_profile(self, served: TestClient):
        profiles = [career_profile(user_id=f"member-{i}") for i in range(3)]
        response = served.post("/api/v1/career-compass/batch-predict", json={"profiles": profiles})
        assert response.status_code == 200
        predictions = response.json()["predictions"]
        assert [p["user_id"] for p in predictions] == ["member-0", "member-1", "member-2"]
        assert all(p["confidence"] is None for p in predictions)

    def test_feature_importance_comes_from_the_model_sorted(self, served: TestClient):
        features = served.get("/api/v1/career-compass/feature-importance").json()["features"]
        assert [f["name"] for f in features[:2]] == ["current_salary", "skills_score"]
        importances = [f["importance"] for f in features]
        assert importances == sorted(importances, reverse=True)
        assert len(features) == 9
