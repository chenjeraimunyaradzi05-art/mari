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
