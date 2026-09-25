"""
Career Compass API Router
=========================
Predicts career growth trajectories and provides personalized recommendations.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from src.api.services.model_loader import ModelLoader

router = APIRouter()
model_loader = ModelLoader()


# ===========================================
# REQUEST/RESPONSE SCHEMAS
# ===========================================

class CareerProfile(BaseModel):
    """User career profile for prediction."""
    user_id: str = Field(..., description="Unique user identifier")
    years_experience: float = Field(..., ge=0, le=50, description="Years of professional experience")
    current_salary: float = Field(..., ge=0, description="Current annual salary")
    education_level: int = Field(..., ge=1, le=5, description="1=High School, 2=Associate, 3=Bachelor, 4=Master, 5=PhD")
    industry_growth: float = Field(default=0.04, description="Industry growth rate")
    skills_score: float = Field(..., ge=0, le=100, description="Aggregate skills assessment score")
    leadership_score: float = Field(default=50.0, ge=0, le=100, description="Leadership capability score")
    certifications: int = Field(default=0, ge=0, description="Number of professional certifications")
    location_index: float = Field(default=1.0, ge=0.5, le=1.6, description="Location cost of living index")
    company_size: int = Field(default=100, ge=1, description="Current company employee count")
    
    # Optional context
    target_role: Optional[str] = Field(None, description="Desired future role")
    target_industry: Optional[str] = Field(None, description="Target industry for transition")
    timeline_months: int = Field(default=24, ge=6, le=120, description="Career planning horizon in months")


class CareerPrediction(BaseModel):
    """Career growth prediction result."""
    user_id: str
    career_growth_score: float = Field(..., description="Predicted career growth score (0-100)")
    # Null whenever nothing measured it. It used to be a required float and was
    # filled with the literal 0.85 on every prediction, under a comment saying a
    # real figure "would come from model in production" — so the API published a
    # confidence that was the same for a perfect fit and a hopeless one, and a
    # consumer had no way to know. A regressor with no calibrated interval has
    # no confidence to report; saying so is the honest field.
    confidence: Optional[float] = Field(
        None, ge=0, le=1, description="Prediction confidence, or null when the model reports none"
    )
    
    # Trajectory projections
    salary_projection: Dict[str, float] = Field(..., description="Salary projections by year")
    role_trajectory: List[str] = Field(..., description="Suggested role progression")
    
    # Recommendations
    skill_gaps: List[Dict[str, Any]] = Field(..., description="Skills to develop")
    recommended_actions: List[Dict[str, Any]] = Field(..., description="Actionable steps")
    
    # Benchmarks
    #
    # Both are null, and both used to be numbers this file made up.
    #
    # `peer_percentile` was four thresholds over the model's own output — score
    # 80 became "90th percentile", 60 became "70th" — under the comment
    # "Simplified - would use actual distribution in production". No distribution
    # of peers was ever computed, so the figure compared a woman to nobody while
    # telling her she was ahead of nine in ten of them. `industry_benchmark` was
    # the literal 65.0, commented "Would come from aggregated data".
    #
    # A benchmark that is not measured against anything is not a weak benchmark,
    # it is a fiction with a number's authority, and this one is shown to a woman
    # deciding whether to ask for a promotion. There is no aggregate to compute
    # them from in this service, so they report that rather than inventing it.
    peer_percentile: Optional[float] = Field(
        None,
        description="Position relative to peers, or null when no peer distribution has been computed",
    )
    industry_benchmark: Optional[float] = Field(
        None,
        description="Industry average score, or null when no industry aggregate has been computed",
    )


class BatchPredictionRequest(BaseModel):
    """Batch prediction request."""
    profiles: List[CareerProfile] = Field(..., min_length=1, max_length=100)


class BatchPredictionResponse(BaseModel):
    """Batch prediction response."""
    predictions: List[CareerPrediction]
    processing_time_ms: float


# ===========================================
# ENDPOINTS
# ===========================================

@router.post("/predict", response_model=CareerPrediction)
async def predict_career_growth(profile: CareerProfile):
    """
    Predict career growth trajectory for a single user.

    The career growth score is the loaded artefact's output and nothing else.
    That artefact is produced by ``src/algorithms/career_compass/train.py``,
    which fits an XGBoost regressor — on whatever dataset it was pointed at, and
    this repository ships none, so in practice there is no artefact and this
    endpoint answers 503. It said "trained on career progression data" here,
    which was a description of an intention rather than of anything that had
    happened.

    Everything else in the response is derived from the request and the score by
    the helpers at the bottom of this file: the salary projection is compound
    growth on her current salary at a rate the score picks, the role trajectory
    and the skill gaps are threshold rules over the fields she sent. They are
    arithmetic on her own numbers, not predictions, and the fields that could
    not be computed at all are null rather than filled.
    """
    try:
        model = model_loader.get_model("career_compass")
        if model is None:
            # The same account the startup log and /health carry, rather than
            # five words. This is the endpoint a caller is most likely to meet
            # first, and "Career Compass model not loaded" left them with no way
            # to find out whether that was a deployment mistake or the permanent
            # state of a service that has never had a trained artefact.
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=model_loader.describe_missing(["career_compass"])
            )
        
        # Prepare features for prediction
        features = [
            profile.years_experience,
            profile.current_salary,
            profile.education_level,
            profile.industry_growth,
            profile.skills_score,
            profile.leadership_score,
            profile.certifications,
            profile.location_index,
            profile.company_size,
        ]
        
        # Get prediction from model
        import numpy as np
        prediction = model.predict(np.array([features]))[0]
        
        # Generate comprehensive response
        return CareerPrediction(
            user_id=profile.user_id,
            career_growth_score=round(float(prediction), 2),
            # The loaded artefact is a plain regressor; it returns a point
            # estimate and nothing about how sure it is. See the field.
            confidence=None,
            salary_projection=_generate_salary_projection(profile, prediction),
            role_trajectory=_generate_role_trajectory(profile, prediction),
            skill_gaps=_analyze_skill_gaps(profile),
            recommended_actions=_generate_recommendations(profile, prediction),
            # See the fields: nothing in this service holds a peer distribution
            # or an industry aggregate, so there is nothing honest to put here.
            peer_percentile=None,
            industry_benchmark=None,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )


@router.post("/batch-predict", response_model=BatchPredictionResponse)
async def batch_predict(request: BatchPredictionRequest):
    """Batch predict career growth for multiple users."""
    import time
    start_time = time.time()
    
    predictions = []
    for profile in request.profiles:
        pred = await predict_career_growth(profile)
        predictions.append(pred)
    
    return BatchPredictionResponse(
        predictions=predictions,
        processing_time_ms=round((time.time() - start_time) * 1000, 2)
    )


@router.get("/feature-importance")
async def get_feature_importance():
    """Get feature importance from the trained model."""
    model = model_loader.get_model("career_compass")
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=model_loader.describe_missing(["career_compass"])
        )
    
    feature_names = [
        "years_experience", "current_salary", "education_level",
        "industry_growth", "skills_score", "leadership_score",
        "certifications", "location_index", "company_size"
    ]
    
    try:
        importance = model.feature_importances_
        return {
            "features": [
                {"name": name, "importance": round(float(imp), 4)}
                for name, imp in sorted(
                    zip(feature_names, importance),
                    key=lambda x: x[1],
                    reverse=True
                )
            ]
        }
    except Exception:
        return {"features": [], "message": "Feature importance not available"}


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def _generate_salary_projection(profile: CareerProfile, score: float) -> Dict[str, float]:
    """Generate salary projections based on career growth score."""
    base = profile.current_salary
    growth_rate = 0.03 + (score / 100) * 0.07  # 3-10% based on score
    
    return {
        "year_1": round(base * (1 + growth_rate), 0),
        "year_2": round(base * (1 + growth_rate) ** 2, 0),
        "year_3": round(base * (1 + growth_rate) ** 3, 0),
        "year_5": round(base * (1 + growth_rate) ** 5, 0),
    }


def _generate_role_trajectory(profile: CareerProfile, score: float) -> List[str]:
    """Generate suggested role progression."""
    trajectories = {
        "high": ["Senior Specialist", "Team Lead", "Manager", "Director"],
        "medium": ["Senior Role", "Specialist", "Team Lead"],
        "low": ["Mid-level Role", "Senior Role"],
    }
    
    if score >= 70:
        return trajectories["high"]
    elif score >= 40:
        return trajectories["medium"]
    return trajectories["low"]


def _analyze_skill_gaps(profile: CareerProfile) -> List[Dict[str, Any]]:
    """Analyze skill gaps based on profile."""
    gaps = []
    
    if profile.skills_score < 70:
        gaps.append({
            "skill": "Technical Skills",
            "current": profile.skills_score,
            "target": 80,
            "priority": "high",
            "resources": ["Online courses", "Certifications", "Projects"]
        })
    
    if profile.leadership_score < 60:
        gaps.append({
            "skill": "Leadership",
            "current": profile.leadership_score,
            "target": 70,
            "priority": "medium",
            "resources": ["Leadership workshops", "Mentorship", "Team projects"]
        })
    
    if profile.certifications < 2:
        gaps.append({
            "skill": "Professional Certifications",
            "current": profile.certifications,
            "target": 3,
            "priority": "medium",
            "resources": ["Industry certifications", "Professional development"]
        })
    
    return gaps


def _generate_recommendations(profile: CareerProfile, score: float) -> List[Dict[str, Any]]:
    """Generate actionable recommendations."""
    recommendations = []
    
    if score < 50:
        recommendations.append({
            "action": "Upskill in high-demand areas",
            "impact": "high",
            "timeframe": "3-6 months",
            "details": "Focus on technical skills that are in demand in your industry"
        })
    
    if profile.years_experience >= 5 and profile.leadership_score < 60:
        recommendations.append({
            "action": "Develop leadership capabilities",
            "impact": "high",
            "timeframe": "6-12 months",
            "details": "Seek leadership opportunities or formal training"
        })
    
    recommendations.append({
        "action": "Expand professional network",
        "impact": "medium",
        "timeframe": "ongoing",
        "details": "Connect with mentors and industry professionals"
    })
    
    return recommendations


