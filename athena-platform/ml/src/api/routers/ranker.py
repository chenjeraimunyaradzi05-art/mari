"""
Ranker API Router
=================
Light and Heavy ranking algorithms for content and recommendations.
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
    LIGHT = "light"  # Fast, simple scoring
    HEAVY = "heavy"  # Complex, ML-based


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

@router.post("/rank", response_model=RankingResponse)
async def rank_candidates(request: RankingRequest):
    """
    Rank candidates using specified model.
    
    Light Ranker: Fast heuristic-based scoring
    Heavy Ranker: Deep ML model for higher accuracy
    """
    import time
    start = time.time()
    
    try:
        if request.ranking_model == RankingModel.LIGHT:
            ranked = _light_rank(request.candidates, request.user_context)
        else:
            ranked = _heavy_rank(request.candidates, request.user_context)
        
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


def _heavy_rank(candidates: List[RankingCandidate], context: UserContext) -> List[RankedItem]:
    """Heavy ranking using ML model."""
    # In production, this would use a trained model
    # For now, use enhanced light ranking with additional factors
    results = _light_rank(candidates, context)
    
    # Apply ML-based adjustments (placeholder)
    for item in results:
        # Simulate ML model adjustment
        item.score = item.score * 1.05  # Small boost
    
    results.sort(key=lambda x: x.score, reverse=True)
    return results


def _compute_score(candidate: RankingCandidate, context: UserContext) -> tuple[float, Dict[str, float]]:
    """Compute relevance score with breakdown."""
    breakdown = {}
    
    # Base relevance
    breakdown["base"] = 50.0
    
    # Interest matching
    if context.interests:
        candidate_tags = candidate.features.get("tags", [])
        matches = len(set(context.interests) & set(candidate_tags))
        breakdown["interest_match"] = min(30, matches * 10)
    else:
        breakdown["interest_match"] = 10
    
    # Skill matching (for jobs/courses)
    if context.skills and candidate.content_type in [ContentType.JOB, ContentType.COURSE]:
        required_skills = candidate.features.get("required_skills", [])
        skill_matches = len(set(s.lower() for s in context.skills) & 
                          set(s.lower() for s in required_skills))
        breakdown["skill_match"] = min(25, skill_matches * 8)
    else:
        breakdown["skill_match"] = 0
    
    # Recency boost
    freshness = candidate.features.get("freshness_score", 0.5)
    breakdown["recency"] = freshness * 15
    
    # Engagement signals
    engagement = candidate.features.get("engagement_rate", 0.1)
    breakdown["engagement"] = engagement * 20
    
    # Location relevance
    if context.location and candidate.features.get("location"):
        if context.location.lower() in candidate.features["location"].lower():
            breakdown["location"] = 10
        else:
            breakdown["location"] = 0
    else:
        breakdown["location"] = 5
    
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
    """Generate human-readable explanation."""
    top_factors = sorted(breakdown.items(), key=lambda x: x[1], reverse=True)[:2]
    
    explanations = {
        "interest_match": "matches your interests",
        "skill_match": "aligns with your skills",
        "recency": "recently posted",
        "engagement": "highly engaging content",
        "location": "relevant to your location"
    }
    
    reasons = [explanations.get(k, k) for k, v in top_factors if v > 5]
    
    if reasons:
        return f"Recommended because it {' and '.join(reasons)}"
    return "General recommendation based on your profile"
