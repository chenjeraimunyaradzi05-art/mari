"""
The deployment posture src.api.main enforces: who may call it, what an error
tells them, and when it refuses to start at all.

Each of these used to fail open. The shared key was skipped for /docs, /redoc
and /openapi.json; DEBUG=false switched debug on because only presence was
tested; and a production deployment with no key started anyway and answered
anyone who could reach the port.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

KEY = "test-shared-key"

#: Paths that must refuse a caller without the key. /docs, /redoc and the
#: OpenAPI schema are here because they used to be exempt, which handed a map of
#: every endpoint to whoever found the port.
GUARDED_PATHS = [
    "/",
    "/ready",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/feed/mix-config/home",
    "/api/v1/career-compass/feature-importance",
    "/api/v1/safety-score/thresholds",
]


def _add_failing_route(app) -> None:
    async def explode():
        raise RuntimeError("internal detail that must not leave the service")

    app.add_api_route("/__raise", explode, methods=["GET"])


class TestSharedKey:
    @pytest.mark.parametrize("path", GUARDED_PATHS)
    def test_every_path_but_health_refuses_a_caller_without_the_key(self, load_main, path):
        main = load_main(ML_SERVICE_KEY=KEY)
        with TestClient(main.app) as client:
            response = client.get(path)
        assert response.status_code == 401
        assert response.json() == {"detail": "A valid X-ML-Key header is required"}

    @pytest.mark.parametrize("path", GUARDED_PATHS)
    def test_a_wrong_key_is_refused_like_a_missing_one(self, load_main, path):
        main = load_main(ML_SERVICE_KEY=KEY)
        with TestClient(main.app) as client:
            wrong = client.get(path, headers={"X-ML-Key": "not-the-key"})
            prefix = client.get(path, headers={"X-ML-Key": KEY[:-1]})
        assert wrong.status_code == 401
        assert prefix.status_code == 401

    def test_the_key_opens_every_path(self, load_main):
        main = load_main(ML_SERVICE_KEY=KEY)
        with TestClient(main.app) as client:
            for path in ("/", "/docs", "/redoc", "/openapi.json", "/api/v1/feed/mix-config/home"):
                response = client.get(path, headers={"X-ML-Key": KEY})
                assert response.status_code == 200, path

    def test_a_post_endpoint_is_guarded_too(self, load_main):
        main = load_main(ML_SERVICE_KEY=KEY)
        body = {"user_context": {"user_id": "member-1", "persona": "GENERAL"}, "candidates": []}
        with TestClient(main.app) as client:
            refused = client.post("/api/v1/feed/generate", json=body)
            allowed = client.post("/api/v1/feed/generate", json=body, headers={"X-ML-Key": KEY})
        assert refused.status_code == 401
        assert allowed.status_code == 200

    def test_health_answers_without_the_key(self, load_main):
        main = load_main(ML_SERVICE_KEY=KEY)
        with TestClient(main.app) as client:
            response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["service"] == "athena-ml"

    def test_a_key_of_only_whitespace_is_no_key(self, load_main):
        main = load_main(ML_SERVICE_KEY="   ")
        assert main.ML_SERVICE_KEY == ""
        with TestClient(main.app) as client:
            assert client.get("/").status_code == 200


class TestDebug:
    @pytest.mark.parametrize("value", ["false", "False", "0", "no", "off", ""])
    def test_a_false_value_leaves_debug_off(self, load_main, value):
        main = load_main(DEBUG=value)
        assert main.DEBUG is False

    @pytest.mark.parametrize("value", ["true", "1", "yes", "on"])
    def test_a_true_value_turns_debug_on_outside_production(self, load_main, value):
        main = load_main(DEBUG=value)
        assert main.DEBUG is True

    def test_debug_off_keeps_the_exception_text_inside_the_service(self, load_main):
        main = load_main(DEBUG="false")
        _add_failing_route(main.app)
        with TestClient(main.app, raise_server_exceptions=False) as client:
            response = client.get("/__raise")
        assert response.status_code == 500
        assert response.json()["message"] == "An unexpected error occurred"
        assert "internal detail" not in response.text

    def test_debug_on_shows_the_exception_text_in_development(self, load_main):
        main = load_main(DEBUG="true")
        _add_failing_route(main.app)
        with TestClient(main.app, raise_server_exceptions=False) as client:
            response = client.get("/__raise")
        assert response.status_code == 500
        assert "internal detail" in response.json()["message"]

    def test_debug_is_ignored_in_production(self, load_main):
        main = load_main(DEBUG="true", ATHENA_ENV="production", ML_SERVICE_KEY=KEY)
        assert main.DEBUG is False
        _add_failing_route(main.app)
        with TestClient(main.app, raise_server_exceptions=False) as client:
            response = client.get("/__raise", headers={"X-ML-Key": KEY})
        assert response.status_code == 500
        assert "internal detail" not in response.text


class TestProductionStartup:
    @pytest.mark.parametrize("variable", ["ATHENA_ENV", "ENVIRONMENT", "APP_ENV", "NODE_ENV"])
    def test_production_without_a_key_refuses_to_import(self, load_main, variable):
        with pytest.raises(RuntimeError, match="ML_SERVICE_KEY is not set"):
            load_main(**{variable: "production"})

    def test_production_is_matched_whatever_its_case(self, load_main):
        with pytest.raises(RuntimeError, match="ML_SERVICE_KEY"):
            load_main(ATHENA_ENV="Production")

    def test_production_with_a_key_starts_and_serves(self, load_main):
        main = load_main(ATHENA_ENV="production", ML_SERVICE_KEY=KEY)
        with TestClient(main.app) as client:
            assert client.get("/health").status_code == 200
            assert client.get("/", headers={"X-ML-Key": KEY}).status_code == 200

    def test_development_without_a_key_starts_open(self, load_main):
        main = load_main()
        with TestClient(main.app) as client:
            assert client.get("/").status_code == 200
            assert client.get("/docs").status_code == 200


class TestFailuresStayInsideTheService:
    """
    A router that catches its own exception answers 500 itself, so the global
    handler's DEBUG gate never sees it. Five routers did, and each put
    `str(e)` in the answer: a file path, a model directory or a value out of
    the request, to whoever sent the call.
    """

    SECRET = "SECRET-PATH /srv/models/career_compass.joblib"

    @staticmethod
    def _explode(*_args, **_kwargs):
        raise RuntimeError(TestFailuresStayInsideTheService.SECRET)

    def _cases(self, monkeypatch):
        """(path, body) for each of the five routers, with the piece that does the work made to fail."""
        from src.api.routers import career_compass, feed, mentor_match, ranker, safety_score
        from tests.support import career_profile
        from tests.test_feed import candidate, request as feed_request
        from tests.test_income_and_mentors import mentee, mentor

        class ExplodingModel:
            predict = staticmethod(self._explode)

        monkeypatch.setattr(career_compass.model_loader, "get_model", lambda name: ExplodingModel())
        monkeypatch.setattr(feed, "_score_candidates", self._explode)
        monkeypatch.setattr(mentor_match, "_compute_compatibility", self._explode)
        monkeypatch.setattr(ranker, "_light_rank", self._explode)
        monkeypatch.setattr(safety_score, "_calculate_user_safety", self._explode)

        return [
            ("/api/v1/career-compass/predict", career_profile(), "Prediction failed"),
            ("/api/v1/feed/generate", feed_request([candidate("a")]), "Feed generation failed"),
            ("/api/v1/mentor-match/score", {"mentee": mentee(), "mentor": mentor()}, "Scoring failed"),
            (
                "/api/v1/ranker/rank",
                {"candidates": [{"id": "a", "content_type": "post", "features": {}}], "user_context": {"user_id": "member-1"}},
                "Ranking failed",
            ),
            ("/api/v1/safety-score/calculate", {"user_id": "a", "account_age_days": 30}, "Safety calculation failed"),
        ]

    @pytest.mark.parametrize("environment", [{}, {"DEBUG": "true"}, {"ATHENA_ENV": "production", "ML_SERVICE_KEY": KEY}])
    def test_no_router_puts_the_exception_text_in_its_answer(self, load_main, monkeypatch, environment):
        # Development, development with DEBUG on, and production: the routers
        # answer the same way in all three, because the text is the log's.
        main = load_main(**environment)
        headers = {"X-ML-Key": KEY} if environment.get("ML_SERVICE_KEY") else {}
        with TestClient(main.app, raise_server_exceptions=False) as client:
            for path, body, generic in self._cases(monkeypatch):
                response = client.post(path, json=body, headers=headers)
                assert response.status_code == 500, f"{path}: {response.text}"
                assert response.json()["detail"] == generic, path
                assert "SECRET-PATH" not in response.text, path
                assert ".joblib" not in response.text, path

    def test_the_exception_is_in_the_log_instead(self, load_main, monkeypatch, caplog):
        main = load_main()
        with TestClient(main.app, raise_server_exceptions=False) as client:
            path, body, _ = self._cases(monkeypatch)[4]
            with caplog.at_level("ERROR"):
                client.post(path, json=body)
        assert "SECRET-PATH" in caplog.text


class TestHealthDoesNotMapTheContainer:
    """
    /health is the one path the shared key does not cover. It published the
    directories the loader searched and the text of its load errors.
    """

    def test_a_stranger_in_production_gets_which_models_are_missing_and_nothing_more(self, load_main):
        main = load_main(ATHENA_ENV="production", ML_SERVICE_KEY=KEY)
        with TestClient(main.app) as client:
            body = client.get("/health").json()
        assert "searched" not in body["models"]
        assert "detail" not in body["models"]
        assert body["models"]["missing_consumed"] == ["career_compass"]
        assert body["status"] == "degraded"

    def test_nothing_in_the_answer_names_a_directory(self, load_main, model_dir):
        main = load_main(ATHENA_ENV="production", ML_SERVICE_KEY=KEY)
        with TestClient(main.app) as client:
            text = client.get("/health").text
        assert str(model_dir) not in text

    def test_the_holder_of_the_key_still_gets_the_whole_account(self, load_main):
        main = load_main(ATHENA_ENV="production", ML_SERVICE_KEY=KEY)
        with TestClient(main.app) as client:
            body = client.get("/health", headers={"X-ML-Key": KEY}).json()
        assert body["models"]["searched"]
        assert "career_compass" in body["models"]["detail"]

    def test_a_wrong_key_is_a_stranger(self, load_main):
        main = load_main(ATHENA_ENV="production", ML_SERVICE_KEY=KEY)
        with TestClient(main.app) as client:
            body = client.get("/health", headers={"X-ML-Key": "not-the-key"}).json()
        assert "searched" not in body["models"]

    def test_development_keeps_the_whole_account_for_whoever_is_debugging(self, load_main):
        main = load_main()
        with TestClient(main.app) as client:
            body = client.get("/health").json()
        assert body["models"]["searched"]
        assert "detail" in body["models"]
