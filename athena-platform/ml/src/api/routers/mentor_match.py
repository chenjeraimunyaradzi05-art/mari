"""
Mentor Match API Router
=======================
AI-powered mentor-mentee matching based on compatibility scoring.
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

class MentoringStyle(str, Enum):
    DIRECTIVE = "directive"
    COLLABORATIVE = "collaborative"
    DELEGATIVE = "delegative"
    COACHING = "coaching"


class MentorshipGoal(str, Enum):
    CAREER_TRANSITION = "career_transition"
    SKILL_DEVELOPMENT = "skill_development"
    LEADERSHIP = "leadership"
    ENTREPRENEURSHIP = "entrepreneurship"
    WORK_LIFE_BALANCE = "work_life_balance"
    INDUSTRY_KNOWLEDGE = "industry_knowledge"


# ===========================================
# REQUEST/RESPONSE SCHEMAS
# ===========================================

class MenteeProfile(BaseModel):
    """Mentee profile for matching."""
    user_id: str
    industry: str
    role: str
    experience_years: float = Field(..., ge=0)
    skills: List[str]
    goals: List[MentorshipGoal]
    preferred_style: Optional[MentoringStyle] = None
    availability_hours_per_month: int = Field(default=4, ge=1, le=20)
    timezone: str = Field(default="UTC")
    languages: List[str] = Field(default=["English"])
    
    # Optional preferences
    prefer_same_gender: bool = False
    prefer_same_background: bool = False
    budget_range: Optional[Dict[str, float]] = None


class MentorProfile(BaseModel):
    """Mentor profile for matching."""
    user_id: str
    industry: str
    role: str
    experience_years: float
    expertise_areas: List[str]
    mentoring_style: MentoringStyle
    availability_hours_per_month: int
    timezone: str
    languages: List[str]
    rating: float = Field(default=0.0, ge=0, le=5)
    total_mentees: int = Field(default=0)
    success_stories: int = Field(default=0)
    hourly_rate: Optional[float] = None
    is_pro_bono: bool = False


class MatchScore(BaseModel):
    """Detailed match scoring breakdown."""
    mentor_id: str
    overall_score: float = Field(..., ge=0, le=100)
    
    # Score components
    skill_alignment: float = Field(..., ge=0, le=100)
    goal_compatibility: float = Field(..., ge=0, le=100)
    style_fit: float = Field(..., ge=0, le=100)
    availability_match: float = Field(..., ge=0, le=100)
    experience_relevance: float = Field(..., ge=0, le=100)
    
    # Explanation
    match_reasons: List[str]
    potential_challenges: List[str]
    
    # Mentor summary
    mentor_summary: Dict[str, Any]


class MatchRequest(BaseModel):
    """Request for mentor matching."""
    mentee: MenteeProfile
    mentor_pool: Optional[List[str]] = Field(None, description="Specific mentor IDs to consider")
    max_results: int = Field(default=10, ge=1, le=50)
    min_score: float = Field(default=50.0, ge=0, le=100)


class MatchResponse(BaseModel):
    """Mentor matching response."""
    mentee_id: str
    matches: List[MatchScore]
    total_considered: int
    algorithm_version: str = "1.0"


# ===========================================
# ENDPOINTS
# ===========================================

@router.post("/match", response_model=MatchResponse)
async def find_mentor_matches(request: MatchRequest):
    """
    Find optimal mentor matches for a mentee.
    
    Uses multi-factor compatibility scoring considering:
    - Skill alignment
    - Goal compatibility
    - Communication style fit
    - Availability overlap
    - Experience relevance
    """
    try:
        # In production, this would query the database for mentors
        # For now, return simulated matches
        matches = _calculate_matches(request.mentee, request.max_results, request.min_score)
        
        return MatchResponse(
            mentee_id=request.mentee.user_id,
            matches=matches,
            total_considered=100,  # Would be actual count
            algorithm_version="1.0"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Matching failed: {str(e)}"
        )


@router.post("/score", response_model=MatchScore)
async def calculate_match_score(mentee: MenteeProfile, mentor: MentorProfile):
    """Calculate compatibility score between a specific mentee and mentor."""
    try:
        score = _compute_compatibility(mentee, mentor)
        return score
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scoring failed: {str(e)}"
        )


@router.post("/recommend-goals")
async def recommend_mentorship_goals(
    industry: str,
    role: str,
    experience_years: float,
    current_challenges: List[str]
):
    """Recommend mentorship goals based on career stage and challenges."""
    recommendations = []
    
    if experience_years < 3:
        recommendations.extend([
            {
                "goal": MentorshipGoal.SKILL_DEVELOPMENT,
                "priority": "high",
                "reason": "Early career focus on building core competencies"
            },
            {
                "goal": MentorshipGoal.INDUSTRY_KNOWLEDGE,
                "priority": "medium",
                "reason": "Understanding industry dynamics and expectations"
            }
        ])
    elif experience_years < 7:
        recommendations.extend([
            {
                "goal": MentorshipGoal.CAREER_TRANSITION,
                "priority": "high",
                "reason": "Mid-career is optimal for strategic moves"
            },
            {
                "goal": MentorshipGoal.LEADERSHIP,
                "priority": "medium",
                "reason": "Building leadership skills for advancement"
            }
        ])
    else:
        recommendations.extend([
            {
                "goal": MentorshipGoal.LEADERSHIP,
                "priority": "high",
                "reason": "Senior roles require refined leadership"
            },
            {
                "goal": MentorshipGoal.ENTREPRENEURSHIP,
                "priority": "medium",
                "reason": "Experience enables entrepreneurial ventures"
            }
        ])
    
    return {"recommendations": recommendations}


# ===========================================
# HELPER FUNCTIONS
# ===========================================

def _calculate_matches(mentee: MenteeProfile, max_results: int, min_score: float) -> List[MatchScore]:
    """Calculate mentor matches (simplified for demonstration)."""
    # In production, this queries the database and uses the trained model
    simulated_matches = []
    
    for i in range(min(max_results, 5)):
        score = 85 - (i * 8)  # Decreasing scores
        if score >= min_score:
            simulated_matches.append(MatchScore(
                mentor_id=f"mentor_{i+1}",
                overall_score=score,
                skill_alignment=score + 5,
                goal_compatibility=score - 3,
                style_fit=score + 2,
                availability_match=score - 5,
                experience_relevance=score + 8,
                match_reasons=[
                    f"Strong alignment in {mentee.goals[0].value if mentee.goals else 'career goals'}",
                    f"Experience in {mentee.industry}",
                    "Positive mentee feedback history"
                ],
                potential_challenges=[
                    "Different timezone may require scheduling flexibility"
                ],
                mentor_summary={
                    "name": f"Mentor {i+1}",
                    "title": "Senior Professional",
                    "rating": 4.8 - (i * 0.1),
                    "mentees_helped": 25 - (i * 3)
                }
            ))
    
    return simulated_matches


def _compute_compatibility(mentee: MenteeProfile, mentor: MentorProfile) -> MatchScore:
    """Compute detailed compatibility score."""
    # Skill alignment
    mentee_skills = set(s.lower() for s in mentee.skills)
    mentor_expertise = set(e.lower() for e in mentor.expertise_areas)
    skill_overlap = len(mentee_skills & mentor_expertise)
    skill_alignment = min(100, (skill_overlap / max(len(mentee_skills), 1)) * 100 + 20)
    
    # Goal compatibility
    goal_score = 70  # Base score
    if MentorshipGoal.LEADERSHIP in mentee.goals and mentor.experience_years >= 10:
        goal_score += 15
    if MentorshipGoal.ENTREPRENEURSHIP in mentee.goals:
        goal_score += 10
    goal_compatibility = min(100, goal_score)
    
    # Style fit
    style_fit = 80  # Default good fit
    if mentee.preferred_style and mentee.preferred_style == mentor.mentoring_style:
        style_fit = 95
    
    # Availability match
    mentee_hours = mentee.availability_hours_per_month
    mentor_hours = mentor.availability_hours_per_month
    availability_match = min(100, (min(mentee_hours, mentor_hours) / max(mentee_hours, 1)) * 100)
    
    # Experience relevance
    exp_diff = mentor.experience_years - mentee.experience_years
    if 5 <= exp_diff <= 15:
        experience_relevance = 90
    elif exp_diff > 15:
        experience_relevance = 75
    else:
        experience_relevance = 60
    
    # Overall score (weighted average)
    overall = (
        skill_alignment * 0.25 +
        goal_compatibility * 0.25 +
        style_fit * 0.15 +
        availability_match * 0.15 +
        experience_relevance * 0.20
    )
    
    return MatchScore(
        mentor_id=mentor.user_id,
        overall_score=round(overall, 1),
        skill_alignment=round(skill_alignment, 1),
        goal_compatibility=round(goal_compatibility, 1),
        style_fit=round(style_fit, 1),
        availability_match=round(availability_match, 1),
        experience_relevance=round(experience_relevance, 1),
        match_reasons=_generate_match_reasons(mentee, mentor, overall),
        potential_challenges=_identify_challenges(mentee, mentor),
        mentor_summary={
            "user_id": mentor.user_id,
            "role": mentor.role,
            "industry": mentor.industry,
            "rating": mentor.rating,
            "style": mentor.mentoring_style.value
        }
    )


def _generate_match_reasons(mentee: MenteeProfile, mentor: MentorProfile, score: float) -> List[str]:
    """Generate human-readable match reasons."""
    reasons = []
    
    if mentor.industry == mentee.industry:
        reasons.append(f"Same industry experience ({mentor.industry})")
    
    skill_overlap = set(s.lower() for s in mentee.skills) & set(e.lower() for e in mentor.expertise_areas)
    if skill_overlap:
        reasons.append(f"Expertise in: {', '.join(list(skill_overlap)[:3])}")
    
    if mentor.rating >= 4.5:
        reasons.append(f"Highly rated mentor ({mentor.rating}/5.0)")
    
    if mentor.success_stories >= 5:
        reasons.append(f"{mentor.success_stories} successful mentoring relationships")
    
    return reasons if reasons else ["Good overall compatibility"]


def _identify_challenges(mentee: MenteeProfile, mentor: MentorProfile) -> List[str]:
    """Identify potential challenges in the mentorship."""
    challenges = []
    
    if mentee.timezone != mentor.timezone:
        challenges.append("Different timezones may affect meeting scheduling")
    
    if not set(mentee.languages) & set(mentor.languages):
        challenges.append("No common language preference")
    
    if mentor.availability_hours_per_month < mentee.availability_hours_per_month:
        challenges.append("Mentor has limited availability")
    
    return challenges
