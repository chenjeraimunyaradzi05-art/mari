"""
The two routers that used to invent people and money.

/mentor-match/match returned five mentors who do not exist, and
/income-stream/predict returned the same fixed incomes and skill matches to
every member. Both now refuse with the reason. /mentor-match/score still works,
because it scores two profiles the caller supplies and invents no one.
"""

from __future__ import annotations

from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

from src.api.routers.income_stream import NO_INCOME_MODEL
from src.api.routers.mentor_match import NO_MENTOR_SOURCE


def mentee(**overrides: Any) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "user_id": "mentee-1",
        "industry": "Finance",
        "role": "Analyst",
        "experience_years": 2,
        "skills": ["Excel", "Modelling", "SQL"],
        "goals": ["skill_development", "leadership"],
        "preferred_style": "coaching",
        "availability_hours_per_month": 4,
        "timezone": "Australia/Brisbane",
        "languages": ["English"],
    }
    body.update(overrides)
    return body


def mentor(**overrides: Any) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "user_id": "mentor-1",
        "industry": "Finance",
        "role": "Director",
        "experience_years": 12,
        "expertise_areas": ["sql", "modelling", "leadership"],
        "mentoring_style": "coaching",
        "availability_hours_per_month": 6,
        "timezone": "Australia/Brisbane",
        "languages": ["English"],
    }
    body.update(overrides)
    return body


@pytest.mark.parametrize("path", ["/api/v1/income-stream/predict", "/api/v1/income-stream/evaluate-opportunity"])
def test_no_income_figure_is_offered(client: TestClient, path: str):
    for response in (
        client.post(path),
        client.post(path, json={"user_id": "a", "current_income": 4000, "skills": ["writing"], "industry": "media", "experience_years": 6}),
    ):
        assert response.status_code == 501
        assert response.json()["detail"] == NO_INCOME_MODEL


def test_no_mentor_is_invented(client: TestClient):
    response = client.post("/api/v1/mentor-match/match", json={"mentee": mentee()})
    assert response.status_code == 501
    assert response.json()["detail"] == NO_MENTOR_SOURCE
    assert "mentor_1" not in response.json().get("matches", [])


def test_two_supplied_profiles_are_scored(client: TestClient):
    response = client.post("/api/v1/mentor-match/score", json={"mentee": mentee(), "mentor": mentor()})
    assert response.status_code == 200
    body = response.json()
    assert body["mentor_id"] == "mentor-1"
    assert 0 <= body["overall_score"] <= 100
    assert body["style_fit"] == 95
    assert "Same industry experience (Finance)" in body["match_reasons"]
    assert body["potential_challenges"] == []


def test_a_rating_nobody_could_have_given_is_not_a_reason(client: TestClient):
    # ATHENA has no way for a mentee to rate a mentor, so a rating that arrives
    # here was made up upstream and must not be repeated to her as praise.
    body = client.post("/api/v1/mentor-match/score", json={"mentee": mentee(), "mentor": mentor(rating=5.0)}).json()
    assert not any("rated" in reason.lower() for reason in body["match_reasons"])


def test_the_difficulties_are_named(client: TestClient):
    body = client.post(
        "/api/v1/mentor-match/score",
        json={
            "mentee": mentee(availability_hours_per_month=10),
            "mentor": mentor(timezone="Europe/London", languages=["French"], availability_hours_per_month=2),
        },
    ).json()
    assert "Different timezones may affect meeting scheduling" in body["potential_challenges"]
    assert "No common language preference" in body["potential_challenges"]
    assert "Mentor has limited availability" in body["potential_challenges"]


def test_the_root_lists_every_router(client: TestClient):
    endpoints = client.get("/").json()["endpoints"]
    assert set(endpoints) == {"career_compass", "mentor_match", "safety_score", "income_stream", "ranker", "feed"}


@pytest.mark.parametrize(
    "years,first_goal",
    [(1, "skill_development"), (5, "career_transition"), (12, "leadership")],
)
def test_goal_suggestions_follow_the_career_stage(client: TestClient, years: float, first_goal: str):
    response = client.post(
        "/api/v1/mentor-match/recommend-goals",
        params={"industry": "Finance", "role": "Analyst", "experience_years": years},
        json=["returning to work after a career break"],
    )
    assert response.status_code == 200
    assert response.json()["recommendations"][0]["goal"] == first_goal
