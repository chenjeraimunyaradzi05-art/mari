"""
POST /api/v1/feed/generate: the one endpoint the Node API calls.

server/src/services/feed-ml.service.ts posts up to two hundred of a member's
feed candidates here and re-orders her feed by the positions that come back.
Before these tests it had never once received a ranking: the Node side sends
``created_at`` as ``Date.toISOString()``, the router subtracted that aware
timestamp from a naive ``datetime.utcnow()``, and every call ended in a 500 that
the API counted as the service being unavailable.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

import pytest
from fastapi.testclient import TestClient

from src.api.routers.feed import MAX_SAME_TYPE_RUN, SIGNALS_NOT_RECORDED, FeedItemType

GENERATE = "/api/v1/feed/generate"
NODE_ML_SERVICE = Path(__file__).resolve().parents[2] / "server" / "src" / "services" / "ml.service.ts"


def iso(moment: datetime) -> str:
    """A timestamp exactly as JavaScript's Date.toISOString() writes one."""
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{moment.microsecond // 1000:03d}Z"


def candidate(identifier: str, **overrides: Any) -> Dict[str, Any]:
    """A candidate in the shape feed-ml.service toFeedCandidate builds."""
    body: Dict[str, Any] = {
        "id": identifier,
        "item_type": "post",
        "author_id": f"author-{identifier}",
        "created_at": iso(datetime.now(timezone.utc) - timedelta(hours=3)),
        "view_count": 0,
        "like_count": 0,
        "comment_count": 0,
        "share_count": 0,
        "tags": [],
        "is_sponsored": False,
    }
    body.update(overrides)
    return body


def request(candidates: List[Dict[str, Any]], **overrides: Any) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "user_context": {"user_id": "member-1", "persona": "GENERAL"},
        "candidates": candidates,
        "page": 1,
    }
    body.update(overrides)
    return body


def generate(client: TestClient, candidates: List[Dict[str, Any]], **overrides: Any) -> Dict[str, Any]:
    response = client.post(GENERATE, json=request(candidates, **overrides))
    assert response.status_code == 200, response.text
    return response.json()


class TestTheNodeContract:
    def test_the_exact_payload_the_node_api_sends_is_ranked(self, client: TestClient):
        # user_context carries only user_id and persona, page is 1 and
        # page_size is 20, which is all rerankWithMl ever sends.
        candidates = [candidate(f"post-{i}", like_count=i) for i in range(5)]
        body = generate(client, candidates, page_size=20)
        assert {item["id"] for item in body["feed_items"]} == {c["id"] for c in candidates}
        assert [item["position"] for item in body["feed_items"]] == [1, 2, 3, 4, 5]

    @pytest.mark.parametrize("item_type", [member.value for member in FeedItemType])
    def test_every_feed_item_type_is_accepted(self, client: TestClient, item_type: str):
        body = generate(client, [candidate("only", item_type=item_type)])
        assert body["feed_items"][0]["item_type"] == item_type

    def test_the_node_vocabulary_is_exactly_the_python_one(self):
        # A value the Node side can send that this enum lacks is not an unknown
        # type, it is a 422 that fails the member's whole batch. The two lists
        # are compared from source so that drift fails here, not in her feed.
        if not NODE_ML_SERVICE.exists():
            pytest.skip("server/src/services/ml.service.ts is not in this checkout")
        source = NODE_ML_SERVICE.read_text(encoding="utf-8")
        union = re.search(r"export type FeedItemType =([^;]+);", source)
        assert union, "FeedItemType is no longer declared in ml.service.ts"
        node_types = set(re.findall(r"'([a-z_]+)'", union.group(1)))
        assert node_types == {member.value for member in FeedItemType}

    def test_a_type_outside_the_vocabulary_is_refused_not_guessed(self, client: TestClient):
        response = client.post(GENERATE, json=request([candidate("a", item_type="reel")]))
        assert response.status_code == 422


class TestTimestamps:
    @pytest.mark.parametrize(
        "created_at",
        ["2026-09-25T10:00:00.000Z", "2026-09-25T10:00:00Z", "2026-09-25T20:00:00+10:00", "2026-09-25T10:00:00"],
    )
    def test_aware_and_naive_timestamps_are_both_ranked(self, client: TestClient, created_at: str):
        body = generate(client, [candidate("a", created_at=created_at), candidate("b")])
        assert len(body["feed_items"]) == 2

    def test_newer_posts_score_higher_all_else_equal(self, client: TestClient):
        now = datetime.now(timezone.utc)
        body = generate(
            client,
            [
                candidate("old", created_at=iso(now - timedelta(days=8))),
                candidate("new", created_at=iso(now - timedelta(hours=1))),
            ],
        )
        scores = {item["id"]: item["score"] for item in body["feed_items"]}
        assert scores["new"] > scores["old"]
        assert body["feed_items"][0]["id"] == "new"

    def test_a_timestamp_in_the_future_earns_no_more_than_a_brand_new_one(self, client: TestClient):
        now = datetime.now(timezone.utc)
        body = generate(
            client,
            [
                candidate("future", created_at=iso(now + timedelta(days=30))),
                candidate("now", created_at=iso(now)),
            ],
        )
        scores = {item["id"]: item["score"] for item in body["feed_items"]}
        assert scores["future"] <= scores["now"] + 0.01


class TestOrdering:
    def test_every_candidate_appears_exactly_once(self, client: TestClient):
        # Six high-quality posts ahead of two videos is what triggered the
        # diversity pass, which used to drop the displaced post and list the
        # video twice.
        candidates = [candidate(f"post-{i}", content_quality_score=0.9) for i in range(6)]
        candidates += [candidate(f"video-{i}", item_type="video", content_quality_score=0.1) for i in range(2)]
        body = generate(client, candidates, page_size=20)
        ids = [item["id"] for item in body["feed_items"]]
        assert Counter(ids).most_common(1)[0][1] == 1
        assert set(ids) == {c["id"] for c in candidates}

    def test_a_long_run_of_one_type_is_broken_while_another_type_remains(self, client: TestClient):
        candidates = [candidate(f"post-{i}", content_quality_score=0.9) for i in range(6)]
        candidates += [candidate(f"video-{i}", item_type="video", content_quality_score=0.1) for i in range(2)]
        types = [item["item_type"] for item in generate(client, candidates, page_size=20)["feed_items"]]
        run_of_posts = ["post"] * MAX_SAME_TYPE_RUN
        assert types == run_of_posts + ["video"] + run_of_posts + ["video"]

    def test_a_run_is_left_alone_when_nothing_else_is_left(self, client: TestClient):
        types = [item["item_type"] for item in generate(client, [candidate(f"p{i}") for i in range(6)])["feed_items"]]
        assert types == ["post"] * 6

    def test_positions_are_one_based_and_contiguous(self, client: TestClient):
        body = generate(client, [candidate(f"p{i}") for i in range(7)])
        assert [item["position"] for item in body["feed_items"]] == list(range(1, 8))

    def test_followed_authors_are_ranked_first_and_say_why(self, client: TestClient):
        body = generate(
            client,
            [candidate("stranger"), candidate("friend", author_id="followed-author")],
            user_context={"user_id": "member-1", "persona": "GENERAL", "followed_users": ["followed-author"]},
        )
        first = body["feed_items"][0]
        assert first["id"] == "friend"
        assert first["reason"] == "From someone you follow"

    def test_a_blocked_author_is_never_ranked_into_her_feed(self, client: TestClient):
        body = generate(
            client,
            [candidate("safe"), candidate("unwanted", author_id="blocked-author")],
            user_context={"user_id": "member-1", "persona": "GENERAL", "blocked_users": ["blocked-author"]},
        )
        assert [item["id"] for item in body["feed_items"]] == ["safe"]


class TestPaging:
    def test_page_two_continues_where_page_one_stopped(self, client: TestClient):
        candidates = [candidate(f"p{i}", like_count=100 * i) for i in range(25)]
        first = generate(client, candidates, page=1, page_size=10)
        second = generate(client, candidates, page=2, page_size=10)
        third = generate(client, candidates, page=3, page_size=10)

        first_ids = [item["id"] for item in first["feed_items"]]
        second_ids = [item["id"] for item in second["feed_items"]]
        third_ids = [item["id"] for item in third["feed_items"]]
        assert not set(first_ids) & set(second_ids)
        assert set(first_ids) | set(second_ids) | set(third_ids) == {c["id"] for c in candidates}
        assert [item["position"] for item in second["feed_items"]] == list(range(11, 21))
        assert first["has_more"] and second["has_more"] and not third["has_more"]

    def test_no_candidates_is_an_empty_feed_not_an_error(self, client: TestClient):
        body = generate(client, [])
        assert body["feed_items"] == []
        assert body["has_more"] is False


class TestSponsoredContent:
    def test_sponsored_items_are_labelled_and_placed(self, client: TestClient):
        candidates = [candidate(f"p{i}") for i in range(19)] + [candidate("ad", item_type="ad", is_sponsored=True)]
        body = generate(client, candidates, page_size=20)
        sponsored = [item for item in body["feed_items"] if item["is_sponsored"]]
        assert [item["id"] for item in sponsored] == ["ad"]
        assert sponsored[0]["reason"] == "Sponsored"
        # A tenth of a twenty-item page is placed at its interval, the end of
        # the page. Breaking up the run of posts must not pull it forward.
        assert sponsored[0]["position"] == 20

    def test_a_sponsored_share_of_zero_places_no_sponsored_item(self, client: TestClient):
        candidates = [candidate(f"p{i}") for i in range(10)] + [candidate("ad", item_type="ad", is_sponsored=True)]
        body = generate(client, candidates, page_size=10, mix_config={"sponsored": 0})
        assert not any(item["is_sponsored"] for item in body["feed_items"])

    @pytest.mark.parametrize("ratio", [2, -0.5])
    def test_a_share_outside_zero_to_one_is_refused(self, client: TestClient, ratio: float):
        response = client.post(
            GENERATE,
            json=request([candidate("a"), candidate("ad", is_sponsored=True)], mix_config={"sponsored": ratio}),
        )
        assert response.status_code == 422


class TestSignals:
    @pytest.mark.parametrize("path", ["/api/v1/feed/refresh-signal", "/api/v1/feed/engagement-signal"])
    def test_a_signal_is_refused_rather_than_falsely_recorded(self, client: TestClient, path: str):
        plain = client.post(path)
        with_body = client.post(path, params={"user_id": "member-1", "item_id": "p1", "engagement_type": "like"})
        for response in (plain, with_body):
            assert response.status_code == 501
            assert response.json()["detail"] == SIGNALS_NOT_RECORDED
            assert "recorded" not in response.json().get("status", "")

    def test_mix_config_is_readable(self, client: TestClient):
        body = client.get("/api/v1/feed/mix-config/explore").json()
        assert body["ratios"]["sponsored"] == 0.10
