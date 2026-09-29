"""
Income Stream API Router
========================
Refuses, with the reason, every request for an income prediction.

Both endpoints here used to answer, and neither answer was worked out from
anything. ``/predict`` offered the same three opportunities to anyone past a
simple threshold (ten free hours a week, three years' experience, five years')
— "Freelance Consulting" at an expected $2,000 a month, "Content Creation" at
$1,500 and "Professional Mentoring" at $800 — each with a skill match of 85, 70
or 90 whatever skills she had listed, and then added half
of those invented sums to her real income and called the total her predicted
potential. Its diversification score was 20, 40 or 65 by how many income
streams she had named. ``/evaluate-opportunity`` started every opportunity at a
fit of 70, moved it by risk tolerance alone, and told her to "pursue" anything
that stayed above 60.

A woman deciding whether she can afford to leave a job, or a relationship that
controls her money, would read those figures as a forecast. They were constants.
The API's own income view (``GET /api/algorithms/income-stream``,
``algorithm.service getIncomeStream``) reports her creator earnings from live
rows and dropped its own invented diversification and potential scores for the
same reason. Nothing in the Node API calls these endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


#: What both endpoints answer, and why.
NO_INCOME_MODEL = (
    "This service has no income model and cannot predict earnings. "
    "src/algorithms/income_stream has no trainer and no artefact exists. The "
    "endpoints that used to answer here returned fixed opportunities with fixed "
    "monthly incomes and fixed skill matches for every member, and a predicted "
    "potential built from those constants. For a member's actual earnings on "
    "ATHENA, use GET /api/algorithms/income-stream on the API, which reads them "
    "from live rows."
)


@router.post("/predict")
async def predict_income_opportunities():
    """
    Refuses: see ``NO_INCOME_MODEL``.

    It takes no body on purpose. The answer is the same whatever is sent, and a
    caller should meet the explanation rather than a validation error.
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=NO_INCOME_MODEL)


@router.post("/evaluate-opportunity")
async def evaluate_opportunity():
    """Refuses: see ``NO_INCOME_MODEL``."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=NO_INCOME_MODEL)
