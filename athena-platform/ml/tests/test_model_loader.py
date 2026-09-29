"""
What the model loader does with an artefact that is missing, refused, broken or
fine, and what /health and /ready say about each.

The loader used to demand an artefact for all six model names and raise on the
first it could not find, which took down the five routers that read no model
along with the one that does. Outside production it filled the gap by fitting a
random forest to random noise and serving it as a career forecast. These tests
hold the replacement to its word: a missing artefact is reported, never
invented, and never blocks what does not need it.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from src.api.services.model_loader import (
    MODEL_ARTIFACTS,
    MODEL_CONSUMERS,
    MissingModelArtifacts,
    ModelLoader,
)
from tests.support import StubCareerModel, career_profile, write_artifact

UNREAD_MODELS = [name for name in MODEL_ARTIFACTS if name not in MODEL_CONSUMERS]


def load() -> ModelLoader:
    loader = ModelLoader()
    asyncio.run(loader.load_all_models())
    return loader


class TestMissingArtefact:
    def test_the_service_starts_and_says_it_is_degraded(self, client: TestClient, model_dir):
        health = client.get("/health")
        assert health.status_code == 200
        body = health.json()
        assert body["status"] == "degraded"
        assert body["models"]["missing_consumed"] == ["career_compass"]
        assert body["models_loaded"] == {name: False for name in MODEL_ARTIFACTS}
        assert str(model_dir.resolve()) in body["models"]["searched"]

    def test_ready_refuses_with_the_whole_account(self, client: TestClient):
        ready = client.get("/ready")
        assert ready.status_code == 503
        detail = ready.json()["detail"]
        assert "career_compass" in detail
        assert "python -m src.algorithms.career_compass.train" in detail
        assert "answer 503 until an artefact exists" in detail

    def test_models_nothing_reads_are_listed_apart_and_cost_nothing(self, client: TestClient):
        models = client.get("/health").json()["models"]
        assert sorted(models["unread_declared"]) == sorted(UNREAD_MODELS)
        assert set(models["missing_consumed"]).isdisjoint(UNREAD_MODELS)

    def test_the_routers_that_read_no_model_still_answer(self, client: TestClient):
        assert client.get("/api/v1/feed/mix-config/home").status_code == 200
        assert client.get("/api/v1/safety-score/thresholds").status_code == 200

    def test_nothing_is_invented_in_its_place(self):
        loader = load()
        assert loader.get_model("career_compass") is None
        assert loader.missing_consumed_models() == ["career_compass"]


class TestLoadedArtefact:
    def test_a_real_artefact_is_loaded_and_reported_healthy(self, model_dir, load_main):
        write_artifact(model_dir, "career_compass", StubCareerModel())
        main = load_main()
        with TestClient(main.app) as client:
            health = client.get("/health").json()
            ready = client.get("/ready")
        assert health["status"] == "healthy"
        assert health["models_loaded"]["career_compass"] is True
        assert health["models"]["missing_consumed"] == []
        assert health["models"]["detail"] is None
        assert ready.status_code == 200

    def test_the_trainers_default_directory_is_searched(self, monkeypatch, tmp_path):
        # The trainers write to artifacts/<name>/ under the working directory by
        # default, and that directory used to be searched by nobody.
        elsewhere = tmp_path / "unused"
        elsewhere.mkdir()
        monkeypatch.setenv("MODEL_PATH", str(elsewhere))
        write_artifact(tmp_path / "work" / "artifacts", "career_compass", StubCareerModel())
        loader = load()
        assert loader.get_model("career_compass") is not None

    def test_a_card_that_says_real_data_is_served(self, model_dir):
        write_artifact(model_dir, "career_compass", StubCareerModel(), card={"trained_on": "real", "servable": True})
        assert load().get_model("career_compass") is not None

    def test_an_artefact_with_no_card_is_served(self, model_dir):
        # Cards did not exist before the loader started reading them; an older
        # artefact is not refused for lacking one.
        write_artifact(model_dir, "career_compass", StubCareerModel())
        assert load().get_model("career_compass") is not None


class TestRefusedArtefact:
    def test_a_card_marked_synthetic_is_refused(self, model_dir, load_main):
        write_artifact(
            model_dir,
            "career_compass",
            StubCareerModel(),
            card={"trained_on": "synthetic", "note": "fitted to generate_synthetic_data"},
        )
        main = load_main()
        with TestClient(main.app) as client:
            health = client.get("/health").json()
            predict = client.post("/api/v1/career-compass/predict", json=career_profile())
        assert health["status"] == "degraded"
        assert health["models_loaded"]["career_compass"] is False
        assert "trained on synthetic data" in health["models"]["detail"]
        assert "fitted to generate_synthetic_data" in health["models"]["detail"]
        assert predict.status_code == 503

    def test_a_card_marked_unservable_is_refused(self, model_dir):
        write_artifact(model_dir, "career_compass", StubCareerModel(), card={"servable": False, "note": "held back"})
        loader = load()
        assert loader.get_model("career_compass") is None
        assert "marked unservable" in loader.describe_missing()
        assert "held back" in loader.describe_missing()

    def test_an_unreadable_card_is_refused_rather_than_ignored(self, model_dir):
        artifact = write_artifact(model_dir, "career_compass", StubCareerModel())
        (artifact.parent / "model_card.json").write_text("{not json", encoding="utf-8")
        loader = load()
        assert loader.get_model("career_compass") is None
        assert "could not be read" in loader.describe_missing()

    def test_a_card_that_is_not_an_object_is_refused(self, model_dir):
        artifact = write_artifact(model_dir, "career_compass", StubCareerModel())
        (artifact.parent / "model_card.json").write_text('["synthetic"]', encoding="utf-8")
        loader = load()
        assert loader.get_model("career_compass") is None
        assert "does not contain an object" in loader.describe_missing()

    def test_an_artefact_that_will_not_load_is_reported_with_its_error(self, model_dir):
        target = model_dir / "career_compass" / "model.joblib"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"this is not a pickle")
        loader = load()
        assert loader.get_model("career_compass") is None
        detail = loader.describe_missing()
        assert "present but not usable" in detail

    def test_a_model_refused_on_a_second_load_is_not_served_from_the_first(self, model_dir):
        # The loader is a singleton and keeps its map between loads. Without the
        # status gate in get_model, a model that loaded once and was refused
        # later would still be handed to the router while /health said missing.
        artifact = write_artifact(model_dir, "career_compass", StubCareerModel())
        assert load().get_model("career_compass") is not None

        (artifact.parent / "model_card.json").write_text('{"trained_on": "synthetic"}', encoding="utf-8")
        reloaded = load()
        assert reloaded.get_model("career_compass") is None
        assert reloaded.get_status()["career_compass"] is False


class TestStrictStartup:
    def test_a_missing_model_an_endpoint_reads_stops_startup(self, monkeypatch):
        monkeypatch.setenv("ATHENA_REQUIRE_MODEL_ARTIFACTS", "true")
        with pytest.raises(MissingModelArtifacts) as raised:
            load()
        assert raised.value.missing == ["career_compass"]
        assert "stops the service from starting" in str(raised.value)

    def test_strict_startup_stops_the_app_through_its_lifespan(self, monkeypatch, load_main):
        monkeypatch.setenv("ATHENA_REQUIRE_MODEL_ARTIFACTS", "yes")
        main = load_main()
        with pytest.raises(MissingModelArtifacts):
            with TestClient(main.app):
                pass

    def test_a_refused_artefact_counts_as_missing_under_strict_startup(self, monkeypatch, model_dir):
        monkeypatch.setenv("ATHENA_REQUIRE_MODEL_ARTIFACTS", "1")
        write_artifact(model_dir, "career_compass", StubCareerModel(), card={"trained_on": "synthetic"})
        with pytest.raises(MissingModelArtifacts):
            load()

    def test_strict_startup_never_blocks_on_a_model_nothing_reads(self, monkeypatch, model_dir):
        monkeypatch.setenv("ATHENA_REQUIRE_MODEL_ARTIFACTS", "true")
        write_artifact(model_dir, "career_compass", StubCareerModel())
        loader = load()
        assert loader.is_ready()
        assert all(loader.get_status()[name] is False for name in UNREAD_MODELS)

    def test_strict_startup_is_off_unless_asked_for(self):
        loader = load()
        assert loader.get_report()["strict_startup"] is False
        assert not loader.is_ready()
