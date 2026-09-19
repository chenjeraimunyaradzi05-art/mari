import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StartHereRail from './StartHereRail';
import type { StartHerePick } from '@/lib/hooks';

// One pick of every type the server can send, already mapped (no score).
const picks: StartHerePick[] = [
  { type: 'USER', id: 'u1', title: 'Priya Nair', reason: 'Active member in your community', href: '/profile/u1' },
  { type: 'MENTOR', id: 'm1', title: 'Grace Okafor', reason: 'Mentor in your field', href: '/dashboard/mentors/m1' },
  { type: 'GROUP', id: 'g1', title: 'Brisbane Founders', reason: 'Popular entrepreneur community', href: '/dashboard/groups/g1' },
  { type: 'COURSE', id: 'c1', title: 'Financial Management Basics', reason: 'Build essential skills for your career', href: '/dashboard/learn/c1' },
  { type: 'JOB', id: 'j1', title: 'Operations Lead', reason: 'Jobs near Brisbane', href: '/dashboard/jobs/j1' },
  { type: 'POST', id: 'p1', title: 'What I wish I knew before my first pitch', reason: 'Popular in the entrepreneur community', href: '/posts/p1' },
];

describe('StartHereRail', () => {
  it('renders one item per type with its reason', () => {
    render(<StartHereRail isColdStart picks={picks} />);

    expect(screen.getByRole('heading', { name: /new here\? start with these/i })).toBeInTheDocument();

    for (const pick of picks) {
      expect(screen.getByText(pick.title).closest('a')).toHaveAttribute('href', pick.href);
      expect(screen.getByText(pick.reason)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('link')).toHaveLength(picks.length);
  });

  it('hides when the member is past cold start', () => {
    const { container } = render(<StartHereRail isColdStart={false} picks={picks} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('hides rather than rendering an empty frame when there is nothing to show', () => {
    const { container } = render(<StartHereRail isColdStart picks={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps each group to two picks', () => {
    const many: StartHerePick[] = [1, 2, 3, 4].map((n) => ({
      type: 'USER',
      id: `u${n}`,
      title: `Member ${n}`,
      reason: 'Active member in your community',
      href: `/profile/u${n}`,
    }));

    render(<StartHereRail isColdStart picks={many} />);

    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.queryByText('Member 3')).not.toBeInTheDocument();
  });
});
