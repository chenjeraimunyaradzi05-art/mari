"""
Feed Algorithm API Router (OpportunityVerse)
=============================================
Intelligent content mixing for the main feed experience.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from enum import Enum
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()


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


class FeedGenerationRequest(BaseModel):
    """Request to generate feed."""
    user_context: FeedUserContext
    candidates: List[FeedCandidate] = Field(default_factory=list)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=50)
    
    # Mixing configuration
    mix_config: Optional[Dict[str, float]] = None


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
    """
    import time
    start = time.time()
    
    try:
        context = request.user_context
        candidates = request.candidates
        
        # Get mix ratios
        mix_ratios = request.mix_config or DEFAULT_MIX_RATIOS.get(
            context.feed_context,
            DEFAULT_MIX_RATIOS[FeedContext.HOME]
        )
        
        # If no candidates provided, return empty (in production, would fetch from DB)
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
        
        # Apply mixing strategy
        mixed_feed = _apply_mixing(scored_items, mix_ratios, request.page_size)
        
        # Apply diversity
        diverse_feed = _ensure_diversity(mixed_feed)
        
        # Add positions
        for i, item in enumerate(diverse_feed):
            item.position = (request.page - 1) * request.page_size + i + 1
        
        return FeedGenerationResponse(
            feed_items=diverse_feed,
            page=request.page,
            has_more=len(candidates) > len(diverse_feed),
            mix_ratios=mix_ratios,
            generation_time_ms=round((time.time() - start) * 1000, 2)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Feed generation failed: {str(e)}"
        )


@router.post("/refresh-signal")
async def record_refresh_signal(user_id: str, feed_context: FeedContext):
    """Record that a user refreshed their feed (for learning)."""
    # In production, this would be stored for model training
    return {"status": "recorded", "user_id": user_id}


@router.post("/engagement-signal")
async def record_engagement(
    user_id: str,
    item_id: str,
    engagement_type: str,  # view, like, comment, share, click, dwell
    dwell_time_seconds: Optional[float] = None
):
    """Record user engagement for feed optimization."""
    # In production, this would update the engagement model
    return {
        "status": "recorded",
        "item_id": item_id,
        "engagement_type": engagement_type
    }


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
    
    for candidate in candidates:
        score = _calculate_item_score(candidate, context)
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


def _calculate_item_score(candidate: FeedCandidate, context: FeedUserContext) -> float:
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
    age_hours = (datetime.utcnow() - candidate.created_at).total_seconds() / 3600
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


def _apply_mixing(items: List[FeedItem], ratios: Dict[str, float], page_size: int) -> List[FeedItem]:
    """Apply content mixing based on ratios."""
    # Sort by score
    items.sort(key=lambda x: x.score, reverse=True)
    
    # Separate sponsored and organic
    sponsored = [i for i in items if i.is_sponsored]
    organic = [i for i in items if not i.is_sponsored]
    
    # Calculate sponsored slots
    sponsored_ratio = ratios.get("sponsored", 0.1)
    sponsored_slots = max(1, int(page_size * sponsored_ratio))
    
    # Build mixed feed
    mixed = []
    organic_idx = 0
    sponsored_idx = 0
    
    for i in range(min(page_size, len(items))):
        # Insert sponsored content at regular intervals
        if sponsored_idx < len(sponsored) and sponsored_idx < sponsored_slots:
            if (i + 1) % (page_size // max(1, sponsored_slots)) == 0:
                mixed.append(sponsored[sponsored_idx])
                sponsored_idx += 1
                continue
        
        if organic_idx < len(organic):
            mixed.append(organic[organic_idx])
            organic_idx += 1
    
    return mixed


def _ensure_diversity(items: List[FeedItem]) -> List[FeedItem]:
    """Ensure content type diversity in the feed."""
    if len(items) <= 5:
        return items
    
    # Track consecutive same types
    result = []
    type_streak = {}
    
    for item in items:
        streak = type_streak.get(item.item_type, 0)
        
        # If too many consecutive, try to find alternative
        if streak >= 3:
            # Find next item of different type
            for alt in items:
                if alt not in result and alt.item_type != item.item_type:
                    result.append(alt)
                    type_streak[alt.item_type] = type_streak.get(alt.item_type, 0) + 1
                    type_streak[item.item_type] = 0
                    break
            else:
                result.append(item)
                type_streak[item.item_type] = streak + 1
        else:
            result.append(item)
            type_streak[item.item_type] = streak + 1
    
    return result
