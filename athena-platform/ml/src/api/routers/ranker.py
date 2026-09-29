"""
Ranker API Router
=================
Hand-written ranking for content and recommendations.

Only the light ranker exists. See ``HEAVY_RANKER_UNAVAILABLE`` for what the
heavy one was, and why asking for it is now refused rather than answered.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from enum import Enum

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()


# ===========================================
# ENUMS & TYPES
# ===========================================

class RankingModel(str, Enum):
    LIGHT = "light"  # Hand-written scoring over the features the caller sends
    HEAVY = "heavy"  # Refused: see HEAVY_RANKER_UNAVAILABLE


class ContentType(str, Enum):
    JOB = "job"
    POST = "post"
    VIDEO = "video"
    COURSE = "course"
    MENTOR = "mentor"
    USER = "user"


# ===========================================
# REQUEST/RESPONSE SCHEMAS
# ===========================================

class RankingCandidate(BaseModel):
    """Item to be ranked."""
    id: str
    content_type: ContentType
    features: Dict[str, Any]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UserContext(BaseModel):
    """User context for personalized ranking."""
    user_id: str
    persona: str = "general"
    interests: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    interaction_history: List[Dict[str, Any]] = Field(default_factory=list)
    session_context: Dict[str, Any] = Field(default_factory=dict)


class RankingRequest(BaseModel):
    """Ranking request."""
    candidates: List[RankingCandidate] = Field(..., min_length=1, max_length=1000)
    user_context: UserContext
    ranking_model: RankingModel = RankingModel.LIGHT
    top_k: Optional[int] = Field(None, ge=1, le=100)
    diversity_factor: float = Field(default=0.2, ge=0, le=1)


class RankedItem(BaseModel):
    """Ranked item result."""
    id: str
    content_type: ContentType
    score: float
    rank: int
    score_breakdown: Dict[str, float]
    explanation: str


class RankingResponse(BaseModel):
    """Ranking response."""
    ranked_items: List[RankedItem]
    model_used: RankingModel
    processing_time_ms: float
    diversity_applied: bool


# ===========================================
# ENDPOINTS
# ===========================================

#: What a request for the heavy ranker is told, and why.
HEAVY_RANKER_UNAVAILABLE = (
    "There is no heavy ranking model to serve. src/algorithms/heavy_ranker/train.py "
    "writes model.pt with torch.save, the model loader reads model.joblib with "
    "joblib.load, no artefact of either kind exists, and nothing in this router "
    "ever loaded one. This path used to take the light ranker's score, multiply it "
    "by 1.05 under a comment calling that an ML adjustment, and report "
    "model_used 'heavy': the same order as the light ranker, labelled as the "
    "deeper model. Ask for ranking_model 'light', which is hand-written scoring "
    "over the features you send and says so."
)


@router.post("/rank", response_model=RankingResponse)
async def rank_candidates(request: RankingRequest):
    """
    Rank candidates with the light ranker: hand-written scoring over the
    features each candidate carries and the context the caller sends.

    A request for the heavy ranker is refused with 501; see
    ``HEAVY_RANKER_UNAVAILABLE``.
    """
    import time
    start = time.time()

    if request.ranking_model == RankingModel.HEAVY:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=HEAVY_RANKER_UNAVAILABLE)

    try:
        ranked = _light_rank(request.candidates, request.user_context)

        # Apply diversity if requested
        if request.diversity_factor > 0:
            ranked = _apply_diversity(ranked, request.diversity_factor)
        
        # Limit to top_k
        if request.top_k:
            ranked = ranked[:request.top_k]
        
        # Add ranks
        for i, item in enumerate(ranked):
            item.rank = i + 1
        
        return RankingResponse(
            ranked_items=ranked,
            model_used=request.ranking_model,
            processing_time_ms=round((time.time() - start) * 1000, 2),
            diversity_applied=request.diversity_factor > 0
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ranking failed: {str(e)}"
        )


@router.post("/score-single")
async def score_single_item(candidate: RankingCandidate, user_context: UserContext):
    """Score a single item for a user."""
    score, breakdown = _compute_score(candidate, user_context)
    
    return {
        "id": candidate.id,
        "score": score,
        "breakdown": breakdown
    }


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def _light_rank(candidates: List[RankingCandidate], context: UserContext) -> List[RankedItem]:
    """Light/fast ranking using heuristics."""
    results = []
    
    for candidate in candidates:
        score, breakdown = _compute_score(candidate, context)
        
        results.append(RankedItem(
            id=candidate.id,
            content_type=candidate.content_type,
            score=score,
            rank=0,  # Will be set later
            score_breakdown=breakdown,
            explanation=_generate_explanation(breakdown)
        ))
    
    # Sort by score descending
    results.sort(key=lambda x: x.score, reverse=True)
    return results


def _compute_score(candidate: RankingCandidate, context: UserContext) -> tuple[float, Dict[str, float]]:
    """
    Compute relevance score with breakdown.

    Each factor is credited only from something the caller actually sent. Four
    of them used to hand out points for information nobody supplied: a member
    with no interests got 10 for "interest_match", a candidate with no
    freshness score got 7.5 for "recency", one with no engagement rate got 2
    for "engagement", and one with no location got 5 for "location". The
    explanation is built from the largest factors, so an item could be
    recommended to a woman "because it matches your interests" when she had
    given none. A factor with nothing to go on now scores 0 and is never named
    as a reason.
    """
    breakdown = {}

    # Base relevance. The same for every candidate, so it moves no item past
    # another and is never offered as a reason; see _generate_explanation.
    breakdown["base"] = 50.0

    # Interest matching
    candidate_tags = candidate.features.get("tags") or []
    if context.interests and candidate_tags:
        matches = len(set(i.lower() for i in context.interests) & set(str(t).lower() for t in candidate_tags))
        breakdown["interest_match"] = min(30, matches * 10)
    else:
        breakdown["interest_match"] = 0

    # Skill matching (for jobs/courses)
    if context.skills and candidate.content_type in [ContentType.JOB, ContentType.COURSE]:
        required_skills = candidate.features.get("required_skills", [])
        skill_matches = len(set(s.lower() for s in context.skills) &
                          set(s.lower() for s in required_skills))
        breakdown["skill_match"] = min(25, skill_matches * 8)
    else:
        breakdown["skill_match"] = 0

    # Recency boost
    freshness = candidate.features.get("freshness_score")
    breakdown["recency"] = float(freshness) * 15 if isinstance(freshness, (int, float)) else 0

    # Engagement signals
    engagement = candidate.features.get("engagement_rate")
    breakdown["engagement"] = float(engagement) * 20 if isinstance(engagement, (int, float)) else 0

    # Location relevance: credited only when both sides named a place.
    candidate_location = candidate.features.get("location")
    if context.location and isinstance(candidate_location, str) and candidate_location:
        breakdown["location"] = 10 if context.location.lower() in candidate_location.lower() else 0
    else:
        breakdown["location"] = 0

    total = sum(breakdown.values())
    return round(min(100, total), 2), {k: round(v, 2) for k, v in breakdown.items()}


def _apply_diversity(items: List[RankedItem], factor: float) -> List[RankedItem]:
    """Apply diversity to avoid similar content clustering."""
    if len(items) <= 3:
        return items
    
    # Group by content type
    type_counts: Dict[ContentType, int] = {}
    diversified = []
    
    for item in items:
        count = type_counts.get(item.content_type, 0)
        
        # Penalize if too many of same type
        if count >= 3:
            item.score *= (1 - factor * 0.5)
        
        type_counts[item.content_type] = count + 1
        diversified.append(item)
    
    diversified.sort(key=lambda x: x.score, reverse=True)
    return diversified


def _generate_explanation(breakdown: Dict[str, float]) -> str:
    """
    Generate human-readable explanation.

    Only the factors named below can be a reason. "base", the constant every
    candidate starts from, is always the largest entry in the breakdown; it used
    to be picked first and printed under its own key, so every explanation this
    ranker ever produced began "Recommended because it base and ...".
    """
    explanations = {
        "interest_match": "matches your interests",
        "skill_match": "aligns with your skills",
        "recency": "was recently posted",
        "engagement": "is drawing engagement",
        "location": "is relevant to your location"
    }

    top_factors = sorted(
        ((k, v) for k, v in breakdown.items() if k in explanations),
        key=lambda x: x[1],
        reverse=True,
    )[:2]

    reasons = [explanations[k] for k, v in top_factors if v > 5]

    if reasons:
        return f"Recommended because it {' and '.join(reasons)}"
    return "General recommendation based on your profile"
