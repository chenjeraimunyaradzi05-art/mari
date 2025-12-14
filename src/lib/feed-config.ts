export type FeedFilter = {
  value: string;
  label: string;
};

export const FEED_FILTERS: FeedFilter[] = [
  { value: 'for-you', label: 'For You' },
  { value: 'latest', label: 'Latest' },
  { value: 'media', label: 'Media' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'money', label: 'Money' },
  { value: 'wellbeing', label: 'Wellbeing' },
];

export type SponsorAd = {
  title: string;
  description?: string;
  mediaUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  badge?: string;
  external?: boolean;
};

export const SPONSOR_ADS: SponsorAd[] = [
  {
    title: 'Scholarship spotlight',
    description: 'Women in STEM grants from trusted university partners with matched funding.',
    mediaUrl: 'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80',
    ctaText: 'View partners',
    ctaUrl: '/partners',
    badge: 'Sponsor',
  },
  {
    title: 'Safe housing alliance',
    description: 'Ethical lenders and community housing providers with capped rates.',
    mediaUrl: 'https://images.unsplash.com/photo-1529429617124-aee85b02f4a5?auto=format&fit=crop&w=900&q=80',
    ctaText: 'Explore offers',
    ctaUrl: '/housing',
    badge: 'Impact ad',
  },
  {
    title: 'Career runway',
    description: 'Telecom, banking, and aviation apprenticeships with guaranteed interviews.',
    mediaUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=80',
    ctaText: 'See pathways',
    ctaUrl: '/apprenticeships',
    badge: 'Trusted sponsor',
  },
];
