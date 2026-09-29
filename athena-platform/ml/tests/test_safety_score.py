"""
The safety-score router: one endpoint that computes from what it is sent, and
three that refuse and say why.

The three used to answer. /interaction told a woman any meeting was safe
without reading who either person was; /moderate-content approved what it
flagged; /report-signal said a signal was recorded and threw it away.
"""

from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from src.api.routers.safety_score import (
    CONTENT_NOT_MODERATED,
    INTERACTION_NOT_EVALUATED,
    SIGNAL_NOT_RECORDED,
)

CALCULATE = "/api/v1/safety-score/calculate"

REFUSALS = [
    (
        "/api/v1/safety-score/interaction",
        INTERACTION_NOT_EVALUATED,
        {"initiator_id": "a", "recipient_id": "b", "interaction_type": "meeting"},
    ),
    (
        "/api/v1/safety-score/moderate-content",
        CONTENT_NOT_MODERATED,
        {"content_id": "c", "content_type": "text", "content_text": "I know where you live", "author_id": "a"},
    ),
    (
        "/api/v1/safety-score/report-signal",
        SIGNAL_NOT_RECORDED,
        {"signal_type": "report", "signal_name": "harassment", "value": -1},
    ),
]


@pytest.mark.parametrize("path,detail,body", REFUSALS)
def test_the_endpoints_with_nothing_behind_them_refuse(client: TestClient, path, detail, body):
    for response in (client.post(path), client.post(path, json=body)):
        assert response.status_code == 501
        assert response.json()["detail"] == detail


def test_a_threat_is_not_approved_by_anything_here(client: TestClient):
    response = client.post(
        "/api/v1/safety-score/moderate-content",
        json={"content_id": "c", "content_type": "text", "content_text": "I will find you", "author_id": "a"},
    )
    assert "is_approved" not in response.text


def test_the_score_reports_no_confidence_it_did_not_measure(client: TestClient):
    response = client.post(CALCULATE, json={"user_id": "member-1", "account_age_days": 400, "is_verified": True})
    assert response.status_code == 200
    body = response.json()
    assert body["confidence"] is None
    # Verification 30 + 40 verified + 10 for an account over 180 days = 80,
    # behaviour 70, community 50 with no interactions, content 80: a weighted
    # sum of her own counts and nothing else.
    assert body["components"] == {"verification": 80, "behavior": 70, "community": 50, "content": 80}
    assert body["safety_score"] == 69.5
    assert body["risk_level"] == "medium"


def test_the_score_is_worked_out_from_the_counts_it_is_sent(client: TestClient):
    clean = client.post(CALCULATE, json={"user_id": "a", "account_age_days": 400}).json()
    reported = client.post(
        CALCULATE,
        json={"user_id": "a", "account_age_days": 400, "report_count_received": 5, "content_flags": 3},
    ).json()
    assert reported["safety_score"] < clean["safety_score"]
    factors = {factor["factor"] for factor in reported["risk_factors"]}
    assert {"reports_received", "content_flags"} <= factors


def test_a_new_account_is_named_as_a_factor(client: TestClient):
    body = client.post(CALCULATE, json={"user_id": "a", "account_age_days": 2}).json()
    assert {"factor": "new_account", "severity": "medium"} in body["risk_factors"]


def test_the_timestamps_carry_their_zone(client: TestClient):
    body = client.post(CALCULATE, json={"user_id": "a", "account_age_days": 30}).json()
    calculated = datetime.fromisoformat(body["calculated_at"].replace("Z", "+00:00"))
    valid_until = datetime.fromisoformat(body["valid_until"].replace("Z", "+00:00"))
    assert calculated.tzinfo is not None
    assert (valid_until - calculated).total_seconds() == 24 * 3600


def test_the_thresholds_match_the_levels_the_score_uses(client: TestClient):
    thresholds = client.get("/api/v1/safety-score/thresholds").json()["thresholds"]
    assert thresholds["low_risk"]["min"] == 70
    assert thresholds["critical_risk"]["max"] == 19
