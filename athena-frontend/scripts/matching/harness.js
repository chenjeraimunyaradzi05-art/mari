// Simple offline matching harness per architecture/matching.md
function tfidfVector(text) {
  // very small toy: lowercase, split on non-word, counts
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean)
  const counts = {}
  tokens.forEach((t) => counts[t] = (counts[t] || 0) + 1)
  return counts
}

function overlapScore(profileVec, jobVec) {
  // skill overlap: sum min counts for shared terms / total profile tokens
  const shared = Object.keys(profileVec).filter(k => jobVec[k])
  const sharedSum = shared.reduce((s, k) => s + Math.min(profileVec[k], jobVec[k]), 0)
  const profileSum = Object.values(profileVec).reduce((s, v) => s + v, 0) || 1
  return sharedSum / profileSum
}

function score(profile, job) {
  const skill = overlapScore(tfidfVector(profile.skills || ''), tfidfVector(job.skills || ''))
  const intent = (profile.intent && job.title.toLowerCase().includes(profile.intent.toLowerCase())) ? 1 : 0
  const location = (!profile.location || !job.location) ? 1 : (profile.location.toLowerCase() === job.location.toLowerCase() ? 1 : 0)
  // weighted sum per doc: skills 0.5, location 0.2, intent 0.1, seniority 0.1, recency 0.1
  const seniority = (profile.seniority === job.seniority) ? 1 : 0
  const recency = job.age_days && job.age_days < 30 ? 1 : 0
  const final = (skill * 0.5 + location * 0.2 + intent * 0.1 + seniority * 0.1 + recency * 0.1)
  return Math.round(final * 100)
}

function precisionAtK(profile, jobs, k) {
  const scored = jobs.map(j => ({ ...j, score: score(profile, j) })).sort((a,b) => b.score - a.score)
  const topK = scored.slice(0, k)
  // assume apply label exists: job.applied_by_profiles = [ids]
  const relevant = topK.filter(j => j.applied_by && j.applied_by.includes(profile.id)).length
  return relevant / k
}

function run() {
  // synthetic dataset
  const profile = { id: 1, skills: 'javascript react node express', intent: 'developer', location: 'Melbourne', seniority: 'junior' }
  const jobs = [
    { id: 1, title: 'Junior Developer', skills: 'javascript react', location: 'Melbourne', seniority: 'junior', age_days: 2, applied_by: [1] },
    { id: 2, title: 'Senior Backend Engineer', skills: 'go sql', location: 'Sydney', seniority: 'senior', age_days: 20, applied_by: [] },
    { id: 3, title: 'Frontend Engineer', skills: 'react typescript', location: 'Melbourne', seniority: 'mid', age_days: 5, applied_by: [] },
    { id: 4, title: 'Apprentice Electrician', skills: 'wiring tools', location: 'Melbourne', seniority: 'junior', age_days: 10, applied_by: [] }
  ]

  console.log('Scoring sample jobs for profile:', profile)
  jobs.forEach(j => console.log(`Job ${j.id} score=${score(profile, j)}`))
  const p3 = precisionAtK(profile, jobs, 3)
  console.log('Precision@3:', p3)
}

if (require.main === module) run()
