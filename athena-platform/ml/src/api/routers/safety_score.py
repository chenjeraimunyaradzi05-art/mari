"""
Safety Score API Router
=======================
Hand-written safety scoring over a profile the caller supplies.

``POST /calculate`` is the only endpoint here that answers. The other three
refuse with 501 and say why: each one used to return a verdict about a member,
or a receipt for data, that nothing behind it had produced. On a platform whose
members include women leaving violent relationships, a safety answer that was
never worked out is worse than no answer, because it will be believed. Nothing
in the Node API calls any of them; see docs/runbooks/ML-SERVICE.md before
wiring this router to anything.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from enum import Enum
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()
logger = logging.getLogger(__name__)


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
    # Null, because nothing measures it. This was a required float filled with
    # the literal 0.85 on every result, whatever the profile, so a caller could
    # not tell a score built from years of history from one built from a
    # three-day-old account with every field defaulted. A weighted sum of
    # hand-picked terms has no confidence to report; career_compass made the
    # same change for the same reason.
    confidence: Optional[float] = Field(
        None, ge=0, le=1, description="Confidence in the score, or null when nothing measures it"
    )

    # Score breakdown
    components: Dict[str, float]
    
    # Recommendations
    risk_factors: List[Dict[str, Any]]
    mitigations: List[str]
    
    # Metadata
    calculated_at: datetime
    valid_until: datetime
    algorithm_version: str = "1.0"


# ===========================================
# ENDPOINTS
# ===========================================

@router.post("/calculate", response_model=SafetyScoreResult)
async def calculate_safety_score(profile: UserSafetyProfile):
    """
    Score a safety profile the caller supplies.

    A weighted sum of four hand-written components (verification, behaviour,
    community and content) over the counts in the request. It reads nothing
    about the member beyond what it is sent and stores nothing it computes, so
    the score is only as good as the caller's counts, and ``confidence`` is null
    because nothing measures one. It was described here as "privacy-preserving
    algorithms", which is a claim about a method this function does not have.
    """
    try:
        score_result = _calculate_user_safety(profile)
        return score_result
    except Exception:
        # What went wrong stays in this service's log. The text of an exception
        # can name a file path, a model directory or a value out of the request,
        # and a caller needs none of it to know the call failed.
        logger.exception("Safety calculation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Safety calculation failed"
        )


#: What ``/interaction`` answers, and why.
INTERACTION_NOT_EVALUATED = (
    "This service cannot judge whether an interaction between two members is safe. "
    "It has no database and holds nothing about either of them. The endpoint that "
    "used to answer read neither id it was given: it started every pair at a risk "
    "of 20, added a fixed amount for a meeting or a transaction, and returned "
    "is_safe true for every pair it was ever asked about, meetings included, so it "
    "would have told a woman that meeting someone was safe without knowing who "
    "either of them was. Safety decisions "
    "about members are made in the API from live rows (safety-score.service, "
    "blocks and reports), where a moderator can see and review them."
)

#: What ``/moderate-content`` answers, and why.
CONTENT_NOT_MODERATED = (
    "This service does not moderate content. The endpoint that used to answer "
    "described itself as AI-powered and was a check for three words: 'scam', "
    "'fake' and 'spam'. Text containing one of them was flagged for review and "
    "approved in the same response, and everything else, threats included, was "
    "approved with a confidence of 0.9 that nothing had measured. ATHENA's "
    "moderation runs in the API: moderation.service assertContentAllowed screens "
    "every write surface with the moderation provider and queues borderline "
    "content for a person."
)

#: What ``/report-signal`` answers, and why.
SIGNAL_NOT_RECORDED = (
    "This service records no safety signals: it has no database. The endpoint "
    "used to answer 'signal_recorded' with an impact of 'pending_recalculation' "
    "while discarding the signal, so a caller reporting something about a member "
    "was told it had been kept and would count when it had gone nowhere. Reports "
    "and blocks are recorded by the API (POST /api/safety/reports and "
    "POST /api/safety/blocks), which is also where they change a member's safety score."
)


@router.post("/interaction")
async def evaluate_interaction_safety():
    """
    Refuses: see ``INTERACTION_NOT_EVALUATED``.

    It takes no body on purpose. The answer is the same whatever is sent, and a
    caller should meet the explanation rather than a validation error.
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=INTERACTION_NOT_EVALUATED)


@router.post("/moderate-content")
async def moderate_content():
    """Refuses: see ``CONTENT_NOT_MODERATED``."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=CONTENT_NOT_MODERATED)


@router.post("/report-signal")
async def report_safety_signal():
    """Refuses: see ``SIGNAL_NOT_RECORDED``."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=SIGNAL_NOT_RECORDED)


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
    
    # An aware UTC clock. datetime.utcnow() is naive, is deprecated from Python
    # 3.12, and is what made the feed router's age arithmetic fail against the
    # aware timestamps the Node API sends.
    now = datetime.now(timezone.utc)

    return SafetyScoreResult(
        user_id=profile.user_id,
        safety_score=round(overall_score, 1),
        risk_level=risk_level,
        # See the field: nothing measures it.
        confidence=None,
        components={k: round(v, 1) for k, v in components.items()},
        risk_factors=risk_factors,
        mitigations=mitigations,
        calculated_at=now,
        valid_until=now + timedelta(hours=24),
        algorithm_version="1.0"
    )
