export type AdCreative = {
  type?: 'image' | 'video';
  label?: string;
  title?: string;
  description?: string;
  cta_text?: string;
  cta_route?: string;
  cta_url?: string;
  media?: string;
  poster?: string;
  alt?: string;
  external?: boolean;
  metrics?: {
    creative_id?: string;
    campaign_id?: string;
    company_id?: string;
    slot?: string;
    signature?: string;
  };
};

// Fallback preview ads mirrored from Blade templates (config/advertising.php)
export const frontendPreviewAds: AdCreative[] = [
  {
    label: 'STEM re-entry partner',
    title: 'Nebula Systems · Returnships for coders',
    description:
      'A six-month re-skilling runway with paid lab hours and senior mentors, rebuilt for carers rejoining product teams.',
    cta_text: 'Review talent brief',
    cta_route: 'business.network',
    media: '/assets/imgs/page/homepage6/img1.png',
  },
  {
    label: 'Rapid housing alliance',
    title: 'Hearthstone Co-Living · Safe leases fast',
    description: 'Pre-approved studio clusters with wraparound security deposits so relocations happen in days, not months.',
    cta_text: 'Explore vacancies',
    cta_route: 'housing.index',
    media: '/assets/imgs/page/homepage6/img3.png',
  },
  {
    label: 'Digital freedom fund',
    title: 'Brightwave Fiber · Unlimited care data',
    description:
      'Underwritten broadband, devices and tech concierges so survivors can work, study and access clinicians remotely.',
    cta_text: 'View connectivity kit',
    cta_route: 'education.discovery',
    media: '/assets/imgs/page/homepage4/img-big5.png',
  },
  {
    label: 'Whole-health coalition',
    title: 'Solace Clinics · Mobile calm suites',
    description: 'High-resolution diagnostics, trauma-informed telehealth and on-site decompression pods inside community hubs.',
    cta_text: 'See care model',
    cta_route: 'wellness.hub',
    media: '/assets/imgs/page/homepage4/img-big6.png',
  },
];

export async function getFrontendPreviewAds(position?: string): Promise<AdCreative[]> {
  // In the absence of a backend API, serve static preview ads.
  // If an API becomes available, call it here and fall back to this list.
  return frontendPreviewAds.map((ad) => ({
    ...ad,
    metrics: {
      ...(ad.metrics || {}),
      slot: position || ad.metrics?.slot,
    },
  }));
}
