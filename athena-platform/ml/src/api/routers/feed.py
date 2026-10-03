"""
Feed Algorithm API Router (OpportunityVerse)
=============================================
Intelligent content mixing for the main feed experience.

``POST /generate`` is the one endpoint in this service the Node API actually
calls: ``server/src/services/feed-ml.service.ts`` posts up to two hundred feed
candidates to it and re-orders the member's feed by the positions it returns.
Everything in this file is hand-written scoring over what that caller sends; no
model is read.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, Dict, List, Optional
from enum import Enum
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()
logger = logging.getLogger(__name__)


# ===========================================
# ENUMS & TYPES
# ===========================================

class FeedItemType(str, Enum):
    POST = "post"
    VIDEO = "video"
    JOB = "job"
    COURSE = "course"
    AD = "ad"
    MENTOR = "mentor"
    EVENT = "event"
    STORY = "story"


class FeedContext(str, Enum):
    HOME = "home"
    EXPLORE = "explore"
    PROFESSIONAL = "professional"
    LEARNING = "learning"
    SOCIAL = "social"


# ===========================================
# REQUEST/RESPONSE SCHEMAS
# ===========================================

class FeedUserContext(BaseModel):
    """User context for feed generation."""
    user_id: str
    persona: str
    interests: List[str] = Field(default_factory=list)
    followed_users: List[str] = Field(default_factory=list)
    followed_organizations: List[str] = Field(default_factory=list)
    blocked_users: List[str] = Field(default_factory=list)

    # Session context
    session_id: Optional[str] = None
    device_type: str = "web"
    feed_context: FeedContext = FeedContext.HOME

    # Preferences
    preferred_content_types: List[FeedItemType] = Field(default_factory=list)
    language: str = "en"


class FeedCandidate(BaseModel):
    """Candidate item for feed."""
    id: str
    item_type: FeedItemType
    author_id: str
    created_at: datetime

    # Engagement signals
    view_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0

    # Content signals
    content_quality_score: float = Field(default=0.5, ge=0, le=1)
    tags: List[str] = Field(default_factory=list)

    # Metadata
    is_sponsored: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FeedItem(BaseModel):
    """Item in the generated feed."""
    id: str
    item_type: FeedItemType
    score: float
    position: int
    reason: str
    is_sponsored: bool = False


#: A mixing ratio is a share of a page, so it lives between none and all of it.
#: An unbounded float let a caller send ``{"sponsored": 2}``, which asked for
#: more sponsored slots than the page had and then divided the page size by
#: that count with integer division — zero — and the modulo that followed took
#: the whole request down with a 500.
MixRatio = Annotated[float, Field(ge=0, le=1)]


class FeedGenerationRequest(BaseModel):
    """Request to generate feed."""
    user_context: FeedUserContext
    candidates: List[FeedCandidate] = Field(default_factory=list)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=50)

    # Mixing configuration
    mix_config: Optional[Dict[str, MixRatio]] = None


class FeedGenerationResponse(BaseModel):
    """Generated feed response."""
    feed_items: List[FeedItem]
    page: int
    has_more: bool
    mix_ratios: Dict[str, float]
    generation_time_ms: float


# ===========================================
# DEFAULT FEED MIXING RATIOS
# ===========================================

DEFAULT_MIX_RATIOS = {
    FeedContext.HOME: {
        "following": 0.35,
        "recommended": 0.40,
        "trending": 0.15,
        "sponsored": 0.10
    },
    FeedContext.EXPLORE: {
        "following": 0.10,
        "recommended": 0.50,
        "trending": 0.30,
        "sponsored": 0.10
    },
    FeedContext.PROFESSIONAL: {
        "jobs": 0.40,
        "industry_news": 0.30,
        "professional_content": 0.20,
        "sponsored": 0.10
    },
    FeedContext.LEARNING: {
        "courses": 0.40,
        "tutorials": 0.30,
        "mentors": 0.20,
        "sponsored": 0.10
    }
}

#: The longest run of one item type the feed will show before it reaches past
#: a higher-scoring item for something different.
MAX_SAME_TYPE_RUN = 3


# ===========================================
# ENDPOINTS
# ===========================================

@router.post("/generate", response_model=FeedGenerationResponse)
async def generate_feed(request: FeedGenerationRequest):
    """
    Generate personalized feed using OpportunityVerse algorithm.

    The algorithm balances:
    - Content from followed users
    - AI-recommended content
    - Trending/popular content
    - Sponsored content (ethically placed)

    It also optimizes for:
    - Diversity (content types, authors)
    - Freshness
    - User engagement patterns

    ``page`` is honoured. Every page used to be built from the top of the
    candidate list, so page two returned page one's items again with their
    positions renumbered. The ordering is now built far enough to cover the
    requested page and that page's slice is returned.
    """
    import time
    start = time.time()

    try:
        context = request.user_context
        # A candidate by someone she has blocked is never ranked into her feed.
        # blocked_users was accepted and then read by nothing, so a caller that
        # sent it had every reason to think it was being honoured. The Node API
        # removes blocked authors before it calls, so today this is a second
        # lock on the same door rather than the only one.
        blocked = set(context.blocked_users)
        candidates = [candidate for candidate in request.candidates if candidate.author_id not in blocked]

        # Get mix ratios
        mix_ratios = request.mix_config or DEFAULT_MIX_RATIOS.get(
            context.feed_context,
            DEFAULT_MIX_RATIOS[FeedContext.HOME]
        )

        # No candidates, no feed. This service has no database to find any in.
        if not candidates:
            return FeedGenerationResponse(
                feed_items=[],
                page=request.page,
                has_more=False,
                mix_ratios=mix_ratios,
                generation_time_ms=0
            )

        # Score and rank candidates
        scored_items = _score_candidates(candidates, context)

        # Order everything up to the end of the requested page, then cut it.
        through_page = request.page * request.page_size
        mixed_feed = _apply_mixing(scored_items, mix_ratios, through_page)
        diverse_feed = _ensure_diversity(mixed_feed)

        page_start = (request.page - 1) * request.page_size
        page_items = diverse_feed[page_start:through_page]

        # Add positions
        for offset, item in enumerate(page_items):
            item.position = page_start + offset + 1

        return FeedGenerationResponse(
            feed_items=page_items,
            page=request.page,
            has_more=len(candidates) > through_page,
            mix_ratios=mix_ratios,
            generation_time_ms=round((time.time() - start) * 1000, 2)
        )
    except Exception:
        # What went wrong stays in this service's log. The text of an exception
        # can name a file path, a model directory or a value out of the request,
        # and a caller needs none of it to know the call failed.
        logger.exception("Feed generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Feed generation failed"
        )


#: What the two signal endpoints answer, and why.
SIGNALS_NOT_RECORDED = (
    "This service records no feed signals. It has no database, and nothing in it "
    "learns from engagement: the feed ranking below is hand-written scoring over "
    "the candidates each request carries. These endpoints used to answer "
    "{\"status\": \"recorded\"} to every call while keeping nothing, so a caller "
    "had every reason to believe a refresh or a like was training a model when it "
    "was discarded on arrival. Engagement ATHENA does keep is written by the API "
    "to its own tables (post impressions, likes and saves)."
)


@router.post("/refresh-signal")
async def record_refresh_signal():
    """
    Refuses: nothing here stores a refresh. See ``SIGNALS_NOT_RECORDED``.

    It takes no parameters on purpose. The answer is the same whatever is sent,
    and a caller should meet the explanation rather than a validation error
    about fields that would have been thrown away.
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=SIGNALS_NOT_RECORDED)


@router.post("/engagement-signal")
async def record_engagement():
    """Refuses: nothing here stores engagement. See ``SIGNALS_NOT_RECORDED``."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=SIGNALS_NOT_RECORDED)


@router.get("/mix-config/{context}")
async def get_mix_config(context: FeedContext):
    """Get the mixing configuration for a feed context."""
    return {
        "context": context,
        "ratios": DEFAULT_MIX_RATIOS.get(context, DEFAULT_MIX_RATIOS[FeedContext.HOME])
    }


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def _score_candidates(candidates: List[FeedCandidate], context: FeedUserContext) -> List[FeedItem]:
    """Score candidates based on relevance."""
    scored = []
    now = datetime.now(timezone.utc)

    for candidate in candidates:
        score = _calculate_item_score(candidate, context, now)
        reason = _determine_reason(candidate, context)

        scored.append(FeedItem(
            id=candidate.id,
            item_type=candidate.item_type,
            score=score,
            position=0,  # Will be set later
            reason=reason,
            is_sponsored=candidate.is_sponsored
        ))

    return scored


def _age_in_hours(created_at: datetime, now: datetime) -> float:
    """
    How old a candidate is, in hours, never negative.

    The Node API sends ``created_at`` as ``Date.toISOString()``, which ends in
    ``Z``, so pydantic hands this a timezone-aware datetime. The age used to be
    ``datetime.utcnow() - created_at`` — a naive clock minus an aware one — which
    Python refuses with a TypeError. That refusal became a 500 on every call the
    API ever made, the API's feed ranker counted each one as the service being
    unavailable and kept the engagement order, and the only consumer this
    service has never once received a ranking. A timestamp with no zone is read
    as UTC, which is what every clock in this platform keeps.

    A timestamp in the future — a skewed clock on either side — counts as brand
    new rather than earning more than the full freshness credit.
    """
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return max(0.0, (now - created_at).total_seconds() / 3600)


def _calculate_item_score(candidate: FeedCandidate, context: FeedUserContext, now: datetime) -> float:
    """Calculate relevance score for a feed item."""
    score = 0.0

    # Base quality score
    score += candidate.content_quality_score * 30

    # From followed users/orgs boost
    if candidate.author_id in context.followed_users:
        score += 25
    if candidate.author_id in context.followed_organizations:
        score += 20

    # Interest matching
    user_interests = set(i.lower() for i in context.interests)
    candidate_tags = set(t.lower() for t in candidate.tags)
    interest_overlap = len(user_interests & candidate_tags)
    score += min(20, interest_overlap * 5)

    # Engagement signals (normalized)
    engagement = (
        candidate.like_count * 1 +
        candidate.comment_count * 2 +
        candidate.share_count * 3
    )
    score += min(15, engagement / 100)

    # Freshness (decay over time)
    age_hours = _age_in_hours(candidate.created_at, now)
    freshness = max(0, 10 - (age_hours / 24))  # Decays over 10 days
    score += freshness

    # Preferred content type bonus
    if candidate.item_type in context.preferred_content_types:
        score += 5

    return min(100, score)


def _determine_reason(candidate: FeedCandidate, context: FeedUserContext) -> str:
    """Determine why this item is being shown."""
    if candidate.is_sponsored:
        return "Sponsored"
    if candidate.author_id in context.followed_users:
        return "From someone you follow"
    if candidate.author_id in context.followed_organizations:
        return "From an organization you follow"

    user_interests = set(i.lower() for i in context.interests)
    candidate_tags = set(t.lower() for t in candidate.tags)
    if user_interests & candidate_tags:
        return "Based on your interests"

    return "Recommended for you"


def _apply_mixing(items: List[FeedItem], ratios: Dict[str, float], length: int) -> List[FeedItem]:
    """
    Order the scored items for the first ``length`` positions, placing sponsored
    items at a regular interval up to their share of that length.

    The sponsored share used to be at least one slot whatever the ratio said, so
    a caller that asked for ``"sponsored": 0`` still got an advert. The share is
    now exactly what the ratio buys, which for a small page can be none.
    """
    # Sort by score
    items.sort(key=lambda x: x.score, reverse=True)

    # Separate sponsored and organic
    sponsored = [i for i in items if i.is_sponsored]
    organic = [i for i in items if not i.is_sponsored]

    # Calculate sponsored slots
    sponsored_ratio = ratios.get("sponsored", 0.1)
    sponsored_slots = min(len(sponsored), int(length * sponsored_ratio))
    interval = length // sponsored_slots if sponsored_slots else 0

    # Build mixed feed
    mixed: List[FeedItem] = []
    organic_idx = 0
    sponsored_idx = 0

    for i in range(min(length, len(items))):
        # Insert sponsored content at regular intervals
        if interval and sponsored_idx < sponsored_slots and (i + 1) % interval == 0:
            mixed.append(sponsored[sponsored_idx])
            sponsored_idx += 1
            continue

        if organic_idx < len(organic):
            mixed.append(organic[organic_idx])
            organic_idx += 1
        elif sponsored_idx < sponsored_slots:
            # Organic ran out before the page did: the remaining paid slots
            # fill it rather than leaving a hole in the numbering.
            mixed.append(sponsored[sponsored_idx])
            sponsored_idx += 1

    return mixed


def _ensure_diversity(items: List[FeedItem]) -> List[FeedItem]:
    """
    Break up long runs of one content type, keeping every item exactly once.

    When a run reached ``MAX_SAME_TYPE_RUN``, the next organic item of a
    different type is brought forward; otherwise the order is the one the mixer
    produced. A sponsored item is never the one brought forward: the mixer
    spaces paid items out on purpose, and breaking up a run of posts is not a
    reason to move an advert up a member's feed.

    This used to append the brought-forward item without placing the one it
    displaced, and without removing the brought-forward item from where it
    already was — so the displaced item vanished from the feed and the
    other one appeared twice. The Node caller keeps the first occurrence of an
    id and moves anything missing to the end, so members saw posts pushed out of
    their place for no reason either of them could name.
    """
    remaining = list(items)
    result: List[FeedItem] = []
    run_type: Optional[FeedItemType] = None
    run_length = 0

    while remaining:
        pick = 0
        if run_length >= MAX_SAME_TYPE_RUN:
            for index, candidate in enumerate(remaining):
                if candidate.item_type != run_type and not candidate.is_sponsored:
                    pick = index
                    break

        chosen = remaining.pop(pick)
        if chosen.item_type == run_type:
            run_length += 1
        else:
            run_type = chosen.item_type
            run_length = 1
        result.append(chosen)

    return result
