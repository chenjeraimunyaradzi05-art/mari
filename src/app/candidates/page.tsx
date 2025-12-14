import React from 'react';
import '../dashboard/shared-dashboard.css';
import { Card, SectionHeader, Pill, StatChip } from '@/components/ui';

const profileSnapshot = {
  experienceYears: 6,
  profession: 'Product Designer',
  currentRole: 'Senior Product Designer',
  tenure: '1.4 yrs',
  skills: 18,
  profileScore: 86,
  latestActivity: 'Updated 2d ago',
};

const growth = [
  { title: 'Staff IC track', description: 'Prep a system thinking showcase with accessibility metrics.', confidence: 'high' },
  { title: 'Design ops lead', description: 'Lean into rituals, async reviews, and AI QA automation.', confidence: 'medium' },
  { title: 'Mentor pathway', description: 'Package your case studies for mentor onboarding.', confidence: 'medium' },
];

const skillRecommendations = [
  { skill: 'Design tokens', reason: 'Shows system rigor across surfaces', tags: ['Systems', 'Frontend'] },
  { skill: 'Service design', reason: 'Upcoming mobility journey squads need it', tags: ['Research'] },
  { skill: 'AI safety cues', reason: 'Hiring managers request safety instrumentation', tags: ['AI', 'Safety'] },
];

const jobRecommendations = [
  { company: 'Vertex Mobility', title: 'Product Designer, Safety UX', location: 'Remote AU', match: '92%' },
  { company: 'BrightPath', title: 'Senior Product Designer', location: 'Sydney', match: '88%' },
  { company: 'Careline', title: 'Design Lead, Journeys', location: 'Melbourne', match: '85%' },
];

export default function CandidatesPage() {
  return (
    <main
      className="dash-shell"
      aria-label="Candidate marketing"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <div className="dash-container" style={{ display: 'grid', gap: 18 }}>
        <Card
          tone="primary"
          padding={26}
          style={{ boxShadow: '0 18px 42px -28px rgba(233,30,140,0.48)' }}
        >
          <SectionHeader
            eyebrow="Candidates"
            title="AI career insights, resume parser, and job matches"
            subtitle="Drop your resume, parse it with AI, and get skill gaps plus tailored roles."
            actions={
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn-primary-gradient">Upload resume</button>
                <button className="btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>View job matches</button>
              </div>
            }
            tone="dark"
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <Pill tone="light">PDF/DOCX parsing</Pill>
            <Pill tone="light">Skill gap analysis</Pill>
            <Pill tone="light">Market signals</Pill>
          </div>
        </Card>

        <section className="dash-grid" style={{ gridTemplateColumns: '1.2fr 1fr', alignItems: 'start' }}>
          <Card style={{ boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <SectionHeader
              eyebrow="Resume parser"
              title="Upload and review before applying"
              subtitle="Drag and drop, then let AI extract your details with a review step before updating your profile."
            />
            <div style={{ marginTop: 14 }}>
              <div
                className="card-plain"
                style={{
                  border: '2px dashed var(--border)',
                  background: 'rgba(255,255,255,0.82)',
                  textAlign: 'center',
                  padding: 28,
                  boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)',
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>Click to upload or drag a file</p>
                <p className="stat-context" style={{ margin: '6px 0 10px' }}>PDF, DOC, DOCX up to 5MB</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn-primary-gradient">Browse files</button>
                  <button className="btn-ghost">Use sample resume</button>
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p className="stat-label">Profile snapshot</p>
            <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', marginTop: 10 }}>
              <StatChip label="Experience" value={`${profileSnapshot.experienceYears} yrs`} />
              <StatChip label="Profession" value={profileSnapshot.profession} />
              <StatChip label="Current role" value={profileSnapshot.currentRole} />
              <StatChip label="Tenure" value={profileSnapshot.tenure} />
              <StatChip label="Skills logged" value={profileSnapshot.skills} />
              <StatChip label="Profile score" value={`${profileSnapshot.profileScore}%`} />
            </div>
            <p className="stat-context" style={{ marginTop: 10 }}>{profileSnapshot.latestActivity}</p>
          </Card>
        </section>

        <section className="dash-grid" style={{ gridTemplateColumns: '1.2fr 1fr', alignItems: 'start' }}>
          <Card style={{ boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p className="stat-label">Growth opportunities</p>
            <h3 style={{ margin: '6px 0 12px' }}>AI career insights</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {growth.map((item) => (
                <div key={item.title} className="card-plain" style={{ border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{item.title}</p>
                    <Pill tone="accent">{item.confidence} confidence</Pill>
                  </div>
                  <p className="stat-context" style={{ margin: '6px 0 0' }}>{item.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="stat-label">Skill recommendations</p>
            <h3 style={{ margin: '6px 0 12px' }}>Add these to stay ahead</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {skillRecommendations.map((rec) => (
                <div key={rec.skill} className="card-plain" style={{ border: '1px solid #e5e7eb' }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{rec.skill}</p>
                  <p className="stat-context" style={{ margin: '4px 0 8px' }}>{rec.reason}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {rec.tags.map((tag) => (
                      <span key={tag} className="badge-soft">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

          <Card style={{ boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
          <SectionHeader
            eyebrow="Job recommendations"
            title="Matches sourced from AI profile signals"
            subtitle="Curated roles based on your parsed resume and profile telemetry."
          />
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="table-lite" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Match</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobRecommendations.map((job) => (
                  <tr key={`${job.company}-${job.title}`}>
                    <td>{job.company}</td>
                    <td>{job.title}</td>
                    <td>{job.location}</td>
                    <td><span className="badge-soft" style={{ background: '#ecfdf3', color: '#166534' }}>{job.match}</span></td>
                    <td><button className="btn-ghost">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
