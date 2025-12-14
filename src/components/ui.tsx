import React, { ReactNode } from 'react';

export function Card({ children, className, tone, padding = 18, style }: { children: ReactNode; className?: string; tone?: 'primary' | 'muted' | 'accent'; padding?: number; style?: React.CSSProperties; }) {
  const toneStyle = tone === 'primary'
    ? { background: 'linear-gradient(135deg,#0f172a,#1f2937)', color: '#fff' }
    : tone === 'accent'
      ? { background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff' }
      : {};
  return (
    <div className={`card-plain${className ? ` ${className}` : ''}`} style={{ padding, ...toneStyle, ...style }}>
      {children}
    </div>
  );
}

export function Pill({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'dark' | 'light' | 'accent'; }) {
  const palette = tone === 'accent'
    ? { background: '#ecfdf3', color: '#16a34a', border: '1px solid #dcfce7' }
    : tone === 'dark'
      ? { background: '#0f172a', color: '#fff', border: '1px solid #1f2937' }
      : { background: '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb' };
  return (
    <span className={`pill${className ? ` ${className}` : ''}`} style={{ ...palette }}>
      {children}
    </span>
  );
}

export function SectionHeader({ eyebrow, title, subtitle, actions, tone }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode; tone?: 'light' | 'dark'; }) {
  const eyebrowColor = tone === 'dark' ? 'rgba(255,255,255,0.7)' : '#6b7280';
  const subtitleColor = tone === 'dark' ? 'rgba(226,232,240,0.85)' : '#475569';
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gap: 4 }}>
        {eyebrow && <p className="stat-label" style={{ margin: 0, color: eyebrowColor }}>{eyebrow}</p>}
        <h1 style={{ margin: 0 }}>{title}</h1>
        {subtitle && <p className="stat-context" style={{ margin: 0, color: subtitleColor }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  );
}

export function StatChip({ label, value }: { label: string; value: string | number; }) {
  return (
    <div className="card-plain" style={{ border: '1px solid #e5e7eb', background: '#f8fafc' }}>
      <p className="stat-label" style={{ marginBottom: 4 }}>{label}</p>
      <p className="stat-value" style={{ fontSize: 20, margin: 0 }}>{value}</p>
    </div>
  );
}
