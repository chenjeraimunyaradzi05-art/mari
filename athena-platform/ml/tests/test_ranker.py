"""
The light ranker, and the refusal that replaced the heavy one.

The heavy ranker was the light ranker's score times 1.05, reported as a deeper
model. The light ranker's explanations began "Recommended because it base",
and it credited interests, freshness, engagement and location a member had
never supplied, so it could give "matches your interests" as the reason to a
woman who had named none.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from fastapi.testclient import TestClient

from src.api.routers.ranker import HEAVY_RANKER_UNAVAILABLE

RANK = "/api/v1/ranker/rank"


def item(identifier: str, content_type: str = "post", **features: Any) -> Dict[str, Any]:
    return {"id": identifier, "content_type": content_type, "features": features}


def rank(client: TestClient, candidates: List[Dict[str, Any]], **context: Any) -> Dict[str, Any]:
    body = {"candidates": candidates, "user_context": {"user_id": "member-1", **context}, "diversity_factor": 0}
    response = client.post(RANK, json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_the_heavy_ranker_is_refused_with_the_reason(client: TestClient):
    response = client.post(
        RANK,
        json={"candidates": [item("a")], "user_context": {"user_id": "member-1"}, "ranking_model": "heavy"},
    )
    assert response.status_code == 501
    assert response.json()["detail"] == HEAVY_RANKER_UNAVAILABLE


def test_the_light_ranker_orders_by_score_and_numbers_the_ranks(client: TestClient):
    body = rank(
        client,
        [item("dull", engagement_rate=0.05), item("lively", engagement_rate=0.9)],
    )
    assert body["model_used"] == "light"
    assert [ranked["id"] for ranked in body["ranked_items"]] == ["lively", "dull"]
    assert [ranked["rank"] for ranked in body["ranked_items"]] == [1, 2]


def test_no_explanation_names_the_constant_every_item_starts_with(client: TestClient):
    body = rank(client, [item("a"), item("b", tags=["finance"])], interests=["finance"])
    for ranked in body["ranked_items"]:
        assert not re.search(r"\bbase\b", ranked["explanation"]), ranked["explanation"]


def test_no_credit_or_reason_for_interests_she_never_gave(client: TestClient):
    body = rank(client, [item("a", tags=["finance", "leadership"])])
    ranked = body["ranked_items"][0]
    assert ranked["score_breakdown"]["interest_match"] == 0
    assert "interests" not in ranked["explanation"]


def test_a_shared_interest_is_credited_and_given_as_the_reason(client: TestClient):
    body = rank(client, [item("a", tags=["Finance", "leadership"])], interests=["finance", "leadership"])
    ranked = body["ranked_items"][0]
    assert ranked["score_breakdown"]["interest_match"] == 20
    assert ranked["explanation"].startswith("Recommended because it matches your interests")


def test_factors_nobody_supplied_score_nothing(client: TestClient):
    breakdown = rank(client, [item("bare")])["ranked_items"][0]["score_breakdown"]
    assert breakdown["recency"] == 0
    assert breakdown["engagement"] == 0
    assert breakdown["location"] == 0
    assert breakdown["skill_match"] == 0


def test_an_item_with_nothing_to_go_on_says_so(client: TestClient):
    explanation = rank(client, [item("bare")])["ranked_items"][0]["explanation"]
    assert explanation == "General recommendation based on your profile"


def test_skills_match_jobs_case_insensitively(client: TestClient):
    body = rank(client, [item("job", "job", required_skills=["Python", "SQL"])], skills=["python", "sql"])
    assert body["ranked_items"][0]["score_breakdown"]["skill_match"] == 16


def test_location_is_credited_only_when_both_sides_name_a_place(client: TestClient):
    body = rank(
        client,
        [item("here", location="Brisbane, QLD"), item("there", location="Perth, WA")],
        location="Brisbane",
    )
    breakdowns = {ranked["id"]: ranked["score_breakdown"] for ranked in body["ranked_items"]}
    assert breakdowns["here"]["location"] == 10
    assert breakdowns["there"]["location"] == 0


def test_top_k_limits_the_answer(client: TestClient):
    body = client.post(
        RANK,
        json={
            "candidates": [item(f"i{n}", engagement_rate=n / 10) for n in range(5)],
            "user_context": {"user_id": "member-1"},
            "top_k": 2,
        },
    ).json()
    assert [ranked["id"] for ranked in body["ranked_items"]] == ["i4", "i3"]
