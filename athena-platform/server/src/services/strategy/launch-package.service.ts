/**
 * The launch package: the blueprint's "bundled services" idea, done as the
 * list of what a launch needs in order, with the vetted vendors on the
 * platform who do each part and the discount partners give members.
 *
 * There is no bundle price because vendors quote their own work; what a
 * member gets is the order of operations, the partner picks per category,
 * and one place to send a request for proposals for the rest.
 */

export type Structure = 'SOLE_TRADER' | 'PARTNERSHIP' | 'COMPANY' | 'TRUST';

export interface LaunchStep {
  key: string;
  title: string;
  detail: string;
  href?: string;
  external?: boolean;
  vendorCategory?: string;
}

export interface VendorLike {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  services?: string[] | null;
  priceRange?: string | null;
  discountPct?: number | null;
  website?: string | null;
  location?: string | null;
  isVerified?: boolean | null;
  isPartner?: boolean | null;
  avgRating?: unknown;
  reviewCount?: number | null;
}

export const CATEGORY_LABELS: Record<string, string> = {
  ACCOUNTING_TAX: 'Accounting and tax',
  LEGAL: 'Legal',
  DESIGN_MARKETING: 'Brand, design and marketing',
  TECH_DEVELOPMENT: 'Website and software',
  HR_COMPLIANCE: 'HR and compliance',
  BUSINESS_COACHING: 'Business coaching',
  PHOTOGRAPHY_VIDEO: 'Photography and video',
  COPYWRITING: 'Copywriting',
  VIRTUAL_ASSISTANT: 'Virtual assistant',
  OTHER: 'Other',
};

export function launchChecklist(structure: Structure, options: { online?: boolean; employees?: boolean; premises?: boolean } = {}): LaunchStep[] {
  const steps: LaunchStep[] = [
    { key: 'structure', title: 'Settle the structure', detail: 'Compared on your numbers, then registered once.', href: '/dashboard/business/strategy#structure' },
    { key: 'abn', title: 'ABN, and a TFN for the entity', detail: structure === 'SOLE_TRADER' ? 'Free at the Australian Business Register; your own TFN covers a sole trader.' : 'Free at the Australian Business Register; the entity gets its own tax file number.', href: 'https://abr.gov.au', external: true },
  ];
  if (structure === 'COMPANY') steps.push({ key: 'asic', title: 'Register the company with ASIC', detail: 'Form 201, about $600, an ACN back within a day. Director IDs first.', href: 'https://asic.gov.au', external: true, vendorCategory: 'ACCOUNTING_TAX' });
  if (structure === 'TRUST') steps.push({ key: 'deed', title: 'Have the trust deed drawn and stamped', detail: 'A solicitor or a deed provider, usually $500 to $1,500; stamp it where the state requires.', vendorCategory: 'LEGAL' });
  if (structure === 'PARTNERSHIP') steps.push({ key: 'agreement', title: 'Sign the partnership agreement', detail: 'The draft from the formation studio, reviewed by a lawyer before anyone signs.', href: '/dashboard/formation', vendorCategory: 'LEGAL' });
  steps.push(
    { key: 'name', title: 'Business name, domain and email', detail: 'Register the name with ASIC if it is not your own, and take the domain the same day.', href: 'https://connectonline.asic.gov.au', external: true },
    { key: 'bank', title: 'A business bank account', detail: 'Separate from day one, connected to the bank feed so the ledger keeps itself.', href: '/dashboard/finance/banking' },
    { key: 'books', title: 'Accounting, invoices and the BAS', detail: 'Software or the ATHENA ledger; an accountant for the first return and the set-up questions.', href: '/dashboard/finance', vendorCategory: 'ACCOUNTING_TAX' },
    { key: 'gst', title: 'GST when sales reach $75,000', detail: 'Or from the start to claim GST on set-up costs. Then a BAS each quarter.', href: '/dashboard/finance/tax/plan#set-aside' },
    { key: 'insurance', title: 'Insurance before the first client', detail: 'Public liability if people visit; professional indemnity if you advise; workers compensation if you employ.', vendorCategory: 'HR_COMPLIANCE' },
  );
  if (options.employees) steps.push({ key: 'payroll', title: 'PAYG withholding, super and awards', detail: 'Register before the first pay run; pay super each quarter; check the award that covers the role.', vendorCategory: 'HR_COMPLIANCE' });
  if (options.premises) steps.push({ key: 'lease', title: 'The lease, reviewed', detail: 'A retail or commercial lease is a decade of obligations; have it read before signing.', vendorCategory: 'LEGAL' });
  steps.push(
    { key: 'brand', title: 'Brand and website', detail: 'A name, a mark, a page that says what you do and takes an enquiry or a payment.', vendorCategory: 'DESIGN_MARKETING' },
  );
  if (options.online !== false) steps.push({ key: 'terms', title: 'Terms, privacy and payments online', detail: 'Terms of trade, a privacy policy if you collect details, a payment provider.', vendorCategory: 'LEGAL' });
  steps.push(
    { key: 'launch', title: 'Launch, and the first ninety days', detail: 'The accelerator cohort, or a mentor who has done it, for the part no checklist covers.', href: '/dashboard/accelerator', vendorCategory: 'BUSINESS_COACHING' },
  );
  return steps;
}

export interface CategoryPicks {
  category: string;
  label: string;
  picks: Array<{ id: string; name: string; description: string | null; priceRange: string | null; discountPct: number | null; isPartner: boolean; isVerified: boolean; rating: number | null; reviewCount: number; website: string | null; location: string | null }>;
}

/** The best three vendors per category the launch needs: partners first, then rating. */
export function pickVendors(vendors: VendorLike[], categories: string[], perCategory = 3): CategoryPicks[] {
  return categories.map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    picks: vendors
      .filter((v) => v.category === category)
      .sort((a, b) => Number(Boolean(b.isPartner)) - Number(Boolean(a.isPartner)) || Number(Boolean(b.isVerified)) - Number(Boolean(a.isVerified)) || Number(b.avgRating ?? 0) - Number(a.avgRating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
      .slice(0, perCategory)
      .map((v) => ({ id: v.id, name: v.name, description: v.description ?? null, priceRange: v.priceRange ?? null, discountPct: v.discountPct ?? null, isPartner: Boolean(v.isPartner), isVerified: Boolean(v.isVerified), rating: v.avgRating === null || v.avgRating === undefined ? null : Number(v.avgRating), reviewCount: v.reviewCount ?? 0, website: v.website ?? null, location: v.location ?? null })),
  }));
}
