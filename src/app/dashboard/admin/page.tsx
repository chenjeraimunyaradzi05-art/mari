import React from 'react';
import './admin-dashboard.css';

const stats = [
  { label: 'Total Earnings', value: '$128,400', note: 'Since last 30 days', icon: 'fas fa-dollar-sign', tone: 'bg-gradient-primary' },
  { label: 'Members', value: '24,180', note: 'Active members / total', icon: 'fas fa-users', tone: 'bg-gradient-rose' },
  { label: 'Companies', value: '642', note: 'Verified partners', icon: 'fas fa-building', tone: 'bg-gradient-amber' },
  { label: 'Jobs', value: '1,204', note: 'Open / pending', icon: 'fas fa-briefcase', tone: 'bg-gradient-green' },
  { label: 'Active Jobs', value: '884', icon: 'fas fa-check-circle', tone: 'bg-gradient-blue', small: true },
  { label: 'Expired Jobs', value: '86', icon: 'fas fa-times-circle', tone: 'bg-gradient-gray', small: true },
  { label: 'Pending Jobs', value: '234', icon: 'fas fa-hourglass-half', tone: 'bg-gradient-amber', small: true },
  { label: 'Avg Identity Resolution', value: '3.2 hrs', icon: 'fas fa-clock', tone: 'bg-gradient-red', small: true },
];

const pendingJobs = [
  {
    title: 'Frontend Engineer',
    company: 'Moro Labs',
    jobType: 'Full-time',
    category: 'Engineering',
    role: 'React Specialist',
    salary: '$120k - $140k',
    salaryType: 'Annual',
    deadline: 'Dec 30, 2025',
  },
  {
    title: 'Data Analyst',
    company: 'Northstar',
    jobType: 'Contract',
    category: 'Data',
    role: 'Analytics',
    salary: '$70k - $90k',
    salaryType: 'Annual',
    deadline: 'Jan 10, 2026',
  },
  {
    title: 'Customer Success Lead',
    company: 'BrightLoop',
    jobType: 'Hybrid',
    category: 'Operations',
    role: 'Success',
    salary: '$95k - $110k',
    salaryType: 'Annual',
    deadline: 'Jan 5, 2026',
  },
];

const recentEvents = [
  { title: 'New company onboarded: Vertex Mobility', timeAgo: '5m ago' },
  { title: 'Job approved: Senior Product Designer', timeAgo: '18m ago' },
  { title: 'Alert resolved: SLA breach', timeAgo: '1h ago' },
];

export default function AdminDashboardPage() {
  return (
    <main
      className="athena-dashboard"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <div className="container">
        <header
          className="athena-dashboard__header"
          style={{ background: 'var(--card)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)', padding: '18px 20px' }}
        >
          <div className="athena-dashboard__title">
            <h1>Athena — Admin Dashboard</h1>
            <p className="muted">A concise overview of site health, activity and pending work.</p>
          </div>
          <div className="athena-dashboard__actions">
            <form className="search" role="search">
              <input name="q" className="search__input" placeholder="Search jobs, members, companies..." />
            </form>
            <div className="action-buttons">
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'linear-gradient(120deg,#e91e8c,#8b5cf6)', border: 'none', boxShadow: '0 10px 22px -14px rgba(233,30,140,0.55)' }}
              >
                View all jobs
              </button>
              <button type="button" className="btn btn-ghost" style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}>
                Analytics
              </button>
            </div>
          </div>
        </header>

        <section className="athena-stats-grid" aria-label="Key statistics">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className={`stat ${stat.small ? 'small' : ''}`}
              style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}
            >
              <div className={`stat__icon ${stat.tone}`}>
                <i className={stat.icon} aria-hidden="true" />
              </div>
              <div className="stat__meta">
                <div className="stat__label">{stat.label}</div>
                <div className="stat__value">{stat.value}</div>
                {stat.note ? <div className="stat__note muted">{stat.note}</div> : null}
              </div>
            </article>
          ))}
        </section>

        <section className="athena-analytics" aria-label="Analytics">
          <div className="analytics-charts">
            <div className="card__header" style={{ padding: '0 4px 12px 0' }}>
              <h3 style={{ margin: 0 }}>Overview &amp; trends</h3>
            </div>
            <div className="chart-placeholder">Traffic &amp; engagement — chart placeholder</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '14px' }}>
              <div className="small-chart">Conversion: 12.4%</div>
              <div className="small-chart">Avg Response: 3.2 hrs</div>
              <div className="small-chart">New members: 482</div>
            </div>
          </div>

          <aside className="analytics-summary">
            <div className="analytics-card" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 12px 28px -22px rgba(233,30,140,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted, #6b7280)' }}>Conversion last 30d</div>
                  <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>12.4%</div>
                </div>
                <div className="stat__icon bg-gradient-rose" style={{ width: 48, height: 48, fontSize: 14 }}>
                  <i className="fas fa-chart-line" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="analytics-card" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 12px 28px -22px rgba(233,30,140,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted, #6b7280)' }}>SLA Health (7d)</div>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>Good</div>
                </div>
                <div className="stat__icon bg-gradient-blue" style={{ width: 48, height: 48, fontSize: 14 }}>
                  <i className="fas fa-shield-alt" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div
              className="analytics-card"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 12px 28px -22px rgba(233,30,140,0.35)' }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted, #6b7280)' }}>Open alerts</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>8</div>
              </div>
              <div className="stat__icon bg-gradient-amber" style={{ width: 48, height: 48, fontSize: 14 }}>
                <i className="fas fa-exclamation-triangle" aria-hidden="true" />
              </div>
            </div>
          </aside>
        </section>

        <section className="athena-grid">
          <div className="athena-grid__main">
            <div className="card card--elevated" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
              <header className="card__header">
                <h3>Pending Jobs Approval</h3>
                <div className="card__actions">
                  <button type="button" className="btn btn-outline" style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}>
                    View all
                  </button>
                </div>
              </header>

              <div className="card__body">
                <div className="table-responsive">
                  <table className="table table--striped table--compact">
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Category &amp; Role</th>
                        <th>Salary</th>
                        <th>Deadline</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingJobs.map((job) => (
                        <tr key={`${job.title}-${job.company}`}>
                          <td className="job-cell">
                            <div className="job-cell__fallback"><i className="fas fa-building" aria-hidden="true" /></div>
                            <div className="job-cell__meta">
                              <div className="job-cell__title">{job.title}</div>
                              <div className="muted">{job.company} • {job.jobType}</div>
                            </div>
                          </td>
                          <td>
                            <div className="font-weight-600">{job.category}</div>
                            <div className="muted">{job.role}</div>
                          </td>
                          <td>
                            <div className="salary-range">{job.salary}</div>
                            <div className="muted small">{job.salaryType}</div>
                          </td>
                          <td>{job.deadline}</td>
                          <td><span className="badge badge--warning">Pending</span></td>
                          <td className="text-right">
                            <div className="btn-group" style={{ display: 'inline-flex', gap: 8 }}>
                              <button type="button" className="btn btn-sm btn-primary" title="Edit" style={{ background: 'linear-gradient(120deg,#e91e8c,#8b5cf6)', border: 'none' }}><i className="fas fa-edit" aria-hidden="true" /></button>
                              <button type="button" className="btn btn-sm btn-outline" title="Delete" style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}><i className="fas fa-trash-alt" aria-hidden="true" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <footer className="card__footer text-right">
                <button type="button" className="btn btn-outline btn-sm" style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}>Load more</button>
              </footer>
            </div>
          </div>

          <aside className="athena-grid__side">
            <div className="card card--compact" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 12px 28px -22px rgba(233,30,140,0.35)' }}>
              <h4>Quick Overview</h4>
              <ul className="mini-list">
                <li>Open jobs <strong>1,204</strong></li>
                <li>Pending approvals <strong>234</strong></li>
                <li>Avg resolution <strong>3.2 hrs</strong></li>
              </ul>
            </div>

            <div className="card card--compact" style={{ border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 12px 28px -22px rgba(233,30,140,0.35)' }}>
              <h4>Recent Activity</h4>
              <ul className="activity-list">
                {recentEvents.map((event) => (
                  <li key={event.title}>
                    <div className="dot" />
                    <div className="event-meta">
                      <div className="event-title">{event.title}</div>
                      <div className="muted small">{event.timeAgo}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>

        <div className="athena-layout-spacer" />
      </div>
    </main>
  );
}
