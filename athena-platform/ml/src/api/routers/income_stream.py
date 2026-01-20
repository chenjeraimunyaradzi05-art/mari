"""
Income Stream API Router
========================
Predicts income opportunities and earning potential.
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

class IncomeStreamType(str, Enum):
    EMPLOYMENT = "employment"
    FREELANCE = "freelance"
    BUSINESS = "business"
    PASSIVE = "passive"
    CREATOR = "creator"
    MENTORING = "mentoring"


class RiskTolerance(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# ===========================================
# REQUEST/RESPONSE SCHEMAS
# ===========================================

class IncomeProfile(BaseModel):
    """User profile for income prediction."""
    user_id: str
    current_income: float = Field(..., ge=0)
    income_streams: List[Dict[str, Any]] = Field(default_factory=list)
    skills: List[str]
    industry: str
    experience_years: float = Field(..., ge=0)
    available_hours_per_week: int = Field(default=40, ge=0, le=80)
    risk_tolerance: RiskTolerance = RiskTolerance.MEDIUM
    location: str = "Global"
    has_business: bool = False


class IncomeOpportunity(BaseModel):
    """Potential income opportunity."""
    opportunity_id: str
    stream_type: IncomeStreamType
    title: str
    description: str
    estimated_monthly_income: Dict[str, float] = Field(..., description="min/max/expected")
    time_investment_hours: int
    startup_cost: float = 0
    risk_level: RiskTolerance
    skill_match: float = Field(..., ge=0, le=100)
    requirements: List[str]
    resources: List[Dict[str, str]]


class IncomePredictionResponse(BaseModel):
    """Income prediction response."""
    user_id: str
    current_monthly_income: float
    predicted_potential: float
    income_gap: float
    opportunities: List[IncomeOpportunity]
    diversification_score: float = Field(..., ge=0, le=100)
    recommendations: List[str]


# ===========================================
# ENDPOINTS
# ===========================================

@router.post("/predict", response_model=IncomePredictionResponse)
async def predict_income_opportunities(profile: IncomeProfile):
    """
    Predict income opportunities and earning potential.
    
    Analyzes:
    - Current income streams
    - Skills and experience
    - Market opportunities
    - Risk tolerance
    """
    try:
        opportunities = _generate_opportunities(profile)
        potential = _calculate_potential(profile, opportunities)
        
        return IncomePredictionResponse(
            user_id=profile.user_id,
            current_monthly_income=profile.current_income,
            predicted_potential=potential,
            income_gap=potential - profile.current_income,
            opportunities=opportunities,
            diversification_score=_calculate_diversification(profile),
            recommendations=_generate_recommendations(profile, opportunities)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )


@router.post("/evaluate-opportunity")
async def evaluate_opportunity(
    profile: IncomeProfile,
    opportunity_type: IncomeStreamType,
    details: Dict[str, Any]
):
    """Evaluate a specific income opportunity for a user."""
    fit_score = 70  # Base score
    
    # Adjust based on risk tolerance
    if opportunity_type in [IncomeStreamType.BUSINESS, IncomeStreamType.CREATOR]:
        if profile.risk_tolerance == RiskTolerance.HIGH:
            fit_score += 15
        elif profile.risk_tolerance == RiskTolerance.LOW:
            fit_score -= 20
    
    return {
        "fit_score": fit_score,
        "recommendation": "pursue" if fit_score >= 60 else "consider_alternatives",
        "considerations": ["Time investment", "Market demand", "Competition"]
    }


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def _generate_opportunities(profile: IncomeProfile) -> List[IncomeOpportunity]:
    """Generate personalized income opportunities."""
    opportunities = []
    
    # Freelance opportunity
    if profile.skills and profile.available_hours_per_week >= 10:
        opportunities.append(IncomeOpportunity(
            opportunity_id="opp_freelance_1",
            stream_type=IncomeStreamType.FREELANCE,
            title="Freelance Consulting",
            description="Leverage your skills for consulting projects",
            estimated_monthly_income={"min": 500, "max": 5000, "expected": 2000},
            time_investment_hours=15,
            startup_cost=0,
            risk_level=RiskTolerance.LOW,
            skill_match=85,
            requirements=["Portfolio", "Professional profile"],
            resources=[{"type": "guide", "url": "/guides/freelancing"}]
        ))
    
    # Creator opportunity
    if profile.experience_years >= 3:
        opportunities.append(IncomeOpportunity(
            opportunity_id="opp_creator_1",
            stream_type=IncomeStreamType.CREATOR,
            title="Content Creation",
            description="Share expertise through content",
            estimated_monthly_income={"min": 100, "max": 10000, "expected": 1500},
            time_investment_hours=10,
            startup_cost=200,
            risk_level=RiskTolerance.MEDIUM,
            skill_match=70,
            requirements=["Content strategy", "Consistent posting"],
            resources=[{"type": "course", "url": "/courses/creator-economy"}]
        ))
    
    # Mentoring opportunity
    if profile.experience_years >= 5:
        opportunities.append(IncomeOpportunity(
            opportunity_id="opp_mentor_1",
            stream_type=IncomeStreamType.MENTORING,
            title="Professional Mentoring",
            description="Guide others in your field",
            estimated_monthly_income={"min": 200, "max": 3000, "expected": 800},
            time_investment_hours=5,
            startup_cost=0,
            risk_level=RiskTolerance.LOW,
            skill_match=90,
            requirements=["Industry expertise", "Communication skills"],
            resources=[{"type": "program", "url": "/mentors/become-mentor"}]
        ))
    
    return opportunities


def _calculate_potential(profile: IncomeProfile, opportunities: List[IncomeOpportunity]) -> float:
    """Calculate total income potential."""
    current = profile.current_income
    additional = sum(opp.estimated_monthly_income["expected"] for opp in opportunities[:3])
    return current + (additional * 0.5)  # Conservative estimate


def _calculate_diversification(profile: IncomeProfile) -> float:
    """Calculate income diversification score."""
    stream_count = len(profile.income_streams)
    if stream_count == 0:
        return 20
    elif stream_count == 1:
        return 40
    elif stream_count == 2:
        return 65
    else:
        return min(100, 70 + (stream_count * 10))


def _generate_recommendations(profile: IncomeProfile, opportunities: List[IncomeOpportunity]) -> List[str]:
    """Generate income recommendations."""
    recommendations = []
    
    if len(profile.income_streams) < 2:
        recommendations.append("Consider diversifying with a secondary income stream")
    
    if profile.risk_tolerance == RiskTolerance.LOW:
        recommendations.append("Focus on stable, recurring income opportunities")
    
    if profile.available_hours_per_week < 10:
        recommendations.append("Consider passive income options given time constraints")
    
    return recommendations
