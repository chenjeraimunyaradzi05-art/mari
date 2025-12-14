export const heroCopy = {
  home: {
    eyebrow: 'Safety, work, and stability',
    headline: 'Athena moves faster than harm.',
    subhead: 'Jobs, housing, care, and capital in one place—prioritised for women rebuilding on a deadline.',
  },
  dashboard: {
    eyebrow: 'Operational view',
    headline: 'Cross-cutting modules stay in lockstep with templates.',
    subhead: 'Filters, hero copy, and advertising slots read from shared config to avoid drift.',
  },
};

export const filterLabels: Record<string, string> = {
  housing: 'Housing filters',
  business: 'Business filters',
  money: 'Money filters',
  wellness: 'Wellness filters',
};

export function getFilterLabel(key: string): string {
  return filterLabels[key] ?? 'Filters';
}
