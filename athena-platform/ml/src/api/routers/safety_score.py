"""
Safety Score API Router
=======================
Privacy-preserving safety scoring for users and interactions.
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

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SignalType(str, Enum):
    BEHAVIORAL = "behavioral"
    CONTENT = "content"
    INTERACTION = "interaction"
    VERIFICATION = "verification"
    REPORT = "report"


# ===========================================
# REQUEST/RESPONSE SCHEMAS
# ===========================================

class SafetySignal(BaseModel):
    """Individual safety signal for scoring."""
    signal_type: SignalType
    signal_name: str
    value: float = Field(..., ge=-1, le=1, description="Signal strength (-1 to 1)")
    confidence: float = Field(default=1.0, ge=0, le=1)
    timestamp: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UserSafetyProfile(BaseModel):
    """User safety profile for scoring."""
    user_id: str
    account_age_days: int = Field(..., ge=0)
    is_verified: bool = False
    verification_level: int = Field(default=0, ge=0, le=3)
    
    # Behavioral signals
    report_count_received: int = Field(default=0, ge=0)
    report_count_made: int = Field(default=0, ge=0)
    block_count_received: int = Field(default=0, ge=0)
    message_response_rate: float = Field(default=0.5, ge=0, le=1)
    
    # Interaction patterns
    total_interactions: int = Field(default=0, ge=0)
    positive_interactions: int = Field(default=0, ge=0)
    
    # Content signals
    content_flags: int = Field(default=0, ge=0)
    content_approved: int = Field(default=0, ge=0)
    
    # Additional signals
    custom_signals: List[SafetySignal] = Field(default_factory=list)


class SafetyScoreResult(BaseModel):
    """Safety score calculation result."""
    user_id: str
    safety_score: float = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    confidence: float = Field(..., ge=0, le=1)
    
    # Score breakdown
    components: Dict[str, float]
    
    # Recommendations
    risk_factors: List[Dict[str, Any]]
    mitigations: List[str]
    
    # Metadata
    calculated_at: datetime
    valid_until: datetime
    algorithm_version: str = "1.0"


class InteractionSafetyRequest(BaseModel):
    """Request to evaluate interaction safety."""
    initiator_id: str
    recipient_id: str
    interaction_type: str = Field(..., description="message, meeting, transaction, etc.")
    context: Dict[str, Any] = Field(default_factory=dict)


class InteractionSafetyResult(BaseModel):
    """Interaction safety evaluation result."""
    is_safe: bool
    risk_level: RiskLevel
    risk_score: float = Field(..., ge=0, le=100)
    warnings: List[str]
    recommendations: List[str]
    requires_verification: bool = False


class ContentModerationRequest(BaseModel):
    """Request to moderate content."""
    content_id: str
    content_type: str = Field(..., description="text, image, video, etc.")
    content_text: Optional[str] = None
    content_url: Optional[str] = None
    author_id: str
    context: Dict[str, Any] = Field(default_factory=dict)


class ContentModerationResult(BaseModel):
    """Content moderation result."""
    content_id: str
    is_approved: bool
    risk_level: RiskLevel
    categories_flagged: List[str]
    confidence: float
    requires_human_review: bool
    explanation: str


# ===========================================
# ENDPOINTS
# ===========================================

@router.post("/calculate", response_model=SafetyScoreResult)
async def calculate_safety_score(profile: UserSafetyProfile):
    """
    Calculate comprehensive safety score for a user.
    
    Uses privacy-preserving algorithms to assess:
    - Account authenticity
    - Behavioral patterns
    - Interaction history
    - Community standing
    """
    try:
        score_result = _calculate_user_safety(profile)
        return score_result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Safety calculation failed: {str(e)}"
        )


@router.post("/interaction", response_model=InteractionSafetyResult)
async def evaluate_interaction_safety(request: InteractionSafetyRequest):
    """
    Evaluate safety of a proposed interaction between users.
    
    Considers:
    - Both users' safety scores
    - Interaction type risks
    - Historical patterns
    - Context signals
    """
    try:
        # In production, would fetch both users' safety profiles
        result = _evaluate_interaction(request)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Interaction evaluation failed: {str(e)}"
        )


@router.post("/moderate-content", response_model=ContentModerationResult)
async def moderate_content(request: ContentModerationRequest):
    """
    AI-powered content moderation.
    
    Detects:
    - Harmful content
    - Spam/scams
    - Policy violations
    - Inappropriate material
    """
    try:
        result = _moderate_content(request)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Content moderation failed: {str(e)}"
        )


@router.post("/report-signal")
async def report_safety_signal(
    user_id: str,
    signal: SafetySignal,
    reported_by: Optional[str] = None
):
    """
    Report a safety signal that affects user's safety score.
    
    Signals are weighted and aggregated to update scores.
    """
    # In production, this would persist the signal and trigger recalculation
    return {
        "status": "signal_recorded",
        "user_id": user_id,
        "signal_type": signal.signal_type,
        "impact": "pending_recalculation"
    }


@router.get("/thresholds")
async def get_safety_thresholds():
    """Get current safety score thresholds and their meanings."""
    return {
        "thresholds": {
            "low_risk": {"min": 70, "max": 100, "level": "low"},
            "medium_risk": {"min": 40, "max": 69, "level": "medium"},
            "high_risk": {"min": 20, "max": 39, "level": "high"},
            "critical_risk": {"min": 0, "max": 19, "level": "critical"}
        },
        "score_components": {
            "verification": {"weight": 0.25, "description": "Identity verification status"},
            "behavior": {"weight": 0.30, "description": "Behavioral patterns and history"},
            "community": {"weight": 0.25, "description": "Community standing and interactions"},
            "content": {"weight": 0.20, "description": "Content quality and compliance"}
        }
    }


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def _calculate_user_safety(profile: UserSafetyProfile) -> SafetyScoreResult:
    """Calculate comprehensive safety score."""
    from datetime import timedelta
    
    components = {}
    risk_factors = []
    mitigations = []
    
    # Verification component (0-100)
    verification_score = 30  # Base for existing account
    if profile.is_verified:
        verification_score += 40
    verification_score += profile.verification_level * 10
    if profile.account_age_days > 180:
        verification_score += 10
    elif profile.account_age_days < 7:
        verification_score -= 20
        risk_factors.append({"factor": "new_account", "severity": "medium"})
    components["verification"] = min(100, max(0, verification_score))
    
    # Behavioral component (0-100)
    behavior_score = 70  # Base
    if profile.report_count_received > 0:
        penalty = min(40, profile.report_count_received * 10)
        behavior_score -= penalty
        risk_factors.append({
            "factor": "reports_received",
            "count": profile.report_count_received,
            "severity": "high" if profile.report_count_received > 3 else "medium"
        })
    if profile.block_count_received > 2:
        behavior_score -= 15
        risk_factors.append({"factor": "multiple_blocks", "severity": "medium"})
    components["behavior"] = max(0, behavior_score)
    
    # Community component (0-100)
    community_score = 50  # Base
    if profile.total_interactions > 0:
        positive_ratio = profile.positive_interactions / profile.total_interactions
        community_score = 30 + (positive_ratio * 70)
    if profile.message_response_rate > 0.7:
        community_score += 10
    components["community"] = min(100, community_score)
    
    # Content component (0-100)
    content_score = 80  # Base
    if profile.content_flags > 0:
        penalty = min(50, profile.content_flags * 15)
        content_score -= penalty
        risk_factors.append({"factor": "content_flags", "severity": "high"})
    if profile.content_approved > 10:
        content_score += 10
    components["content"] = max(0, min(100, content_score))
    
    # Process custom signals
    for signal in profile.custom_signals:
        impact = signal.value * signal.confidence * 10
        if signal.signal_type == SignalType.VERIFICATION:
            components["verification"] = min(100, components["verification"] + impact)
        elif signal.signal_type == SignalType.BEHAVIORAL:
            components["behavior"] = max(0, min(100, components["behavior"] + impact))
    
    # Calculate overall score (weighted average)
    overall_score = (
        components["verification"] * 0.25 +
        components["behavior"] * 0.30 +
        components["community"] * 0.25 +
        components["content"] * 0.20
    )
    
    # Determine risk level
    if overall_score >= 70:
        risk_level = RiskLevel.LOW
    elif overall_score >= 40:
        risk_level = RiskLevel.MEDIUM
    elif overall_score >= 20:
        risk_level = RiskLevel.HIGH
    else:
        risk_level = RiskLevel.CRITICAL
    
    # Generate mitigations
    if components["verification"] < 60:
        mitigations.append("Complete identity verification to improve score")
    if components["behavior"] < 60:
        mitigations.append("Maintain positive interactions to rebuild trust")
    if components["community"] < 60:
        mitigations.append("Engage more with the community")
    
    now = datetime.utcnow()
    
    return SafetyScoreResult(
        user_id=profile.user_id,
        safety_score=round(overall_score, 1),
        risk_level=risk_level,
        confidence=0.85,
        components={k: round(v, 1) for k, v in components.items()},
        risk_factors=risk_factors,
        mitigations=mitigations,
        calculated_at=now,
        valid_until=now + timedelta(hours=24),
        algorithm_version="1.0"
    )


def _evaluate_interaction(request: InteractionSafetyRequest) -> InteractionSafetyResult:
    """Evaluate interaction safety between two users."""
    warnings = []
    recommendations = []
    
    # Simplified evaluation - in production would fetch actual profiles
    base_risk = 20  # Low base risk
    
    # Context-based adjustments
    if request.interaction_type == "transaction":
        base_risk += 20
        recommendations.append("Use platform's secure payment system")
    elif request.interaction_type == "meeting":
        base_risk += 15
        recommendations.append("Meet in a public place for first meeting")
        recommendations.append("Share meeting details with a trusted contact")
    
    # Determine safety
    is_safe = base_risk < 50
    
    if base_risk >= 30:
        warnings.append("Exercise caution with new connections")
    
    return InteractionSafetyResult(
        is_safe=is_safe,
        risk_level=RiskLevel.LOW if base_risk < 30 else RiskLevel.MEDIUM,
        risk_score=base_risk,
        warnings=warnings,
        recommendations=recommendations,
        requires_verification=base_risk >= 40
    )


def _moderate_content(request: ContentModerationRequest) -> ContentModerationResult:
    """Moderate content for policy compliance."""
    categories_flagged = []
    is_approved = True
    requires_human_review = False
    
    # Simple keyword-based detection (placeholder for ML model)
    if request.content_text:
        text_lower = request.content_text.lower()
        
        # Check for potential issues
        harmful_patterns = ["scam", "fake", "spam"]
        for pattern in harmful_patterns:
            if pattern in text_lower:
                categories_flagged.append("potential_spam")
                requires_human_review = True
                break
    
    # Determine approval
    if categories_flagged:
        is_approved = len(categories_flagged) == 0 or requires_human_review
    
    risk_level = RiskLevel.LOW
    if categories_flagged:
        risk_level = RiskLevel.MEDIUM if requires_human_review else RiskLevel.HIGH
    
    return ContentModerationResult(
        content_id=request.content_id,
        is_approved=is_approved,
        risk_level=risk_level,
        categories_flagged=categories_flagged,
        confidence=0.9 if not categories_flagged else 0.7,
        requires_human_review=requires_human_review,
        explanation="Content passed automated checks" if is_approved else "Content flagged for review"
    )
