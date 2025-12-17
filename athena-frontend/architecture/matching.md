# Job Matching Design (MVP)

## Goal
Provide an initial matching algorithm to connect Members with job openings and apprenticeship opportunities with measurable quality and review metrics.

## Dataset
- Job postings: title, description, skills, location, salary range, seniority
- Member profiles: skills, experience, intent, location, portfolio, availability
- Historical interactions: clicks, applies, interview invites

## Matching Approach (MVP)
1. Feature extraction: TF-IDF or small embedding per job and profile (useable with pgvector later)
2. Scoring function: weighted sum of skill overlap (0.5), location proximity (0.2), intent match (0.1), seniority alignment (0.1), recency/engagement boost (0.1)
3. Produce match score 0-100 and return top N

## Evaluation
- Offline: precision@10, recall@10 with historical apply data
- Online: A/B test against baseline; measure apply rate, interview conversion

## API Contract (MVP)
- POST /api/match/score
  - Request: { profile_id: number, job_ids: number[] }
  - Response: { scores: [{ job_id, score }] }

## Next steps
- Create synthetic dataset and evaluation harness
- Implement scoring endpoint in backend and expose via OpenAPI
- Integrate feedback loop for supervised re-weighting
