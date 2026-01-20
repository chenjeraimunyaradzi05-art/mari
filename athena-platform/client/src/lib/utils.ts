import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const DEFAULT_LOCALE = 'en-AU';
const DEFAULT_CURRENCY = 'AUD';

export function getStoredPreference(key: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  return value || fallback;
}

export function setStoredPreference(key: string, value: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

export function getPreferredLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return (
    window.localStorage.getItem('athena.locale') ||
    window.navigator.language ||
    DEFAULT_LOCALE
  );
}

export function getPreferredCurrency() {
  return getStoredPreference('athena.currency', DEFAULT_CURRENCY).toUpperCase();
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
  locale: string = getPreferredLocale()
) {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return new Date(date).toLocaleDateString(locale, options || defaultOptions);
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  return formatDate(date);
}

export function formatCurrency(
  amount: number,
  currency: string = getPreferredCurrency(),
  locale: string = getPreferredLocale()
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSalaryRange(min?: number, max?: number): string {
  if (!min && !max) return 'Salary not specified';
  if (min && max) {
    return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  }
  if (min) return `From ${formatCurrency(min)}`;
  if (max) return `Up to ${formatCurrency(max)}`;
  return 'Salary not specified';
}

export function formatSalary(amount?: number): string {
  if (!amount) return 'Not specified';
  return formatCurrency(amount);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function generateAvatarUrl(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
}

export const PERSONA_LABELS: Record<string, string> = {
  EARLY_CAREER: 'Early Career',
  MID_CAREER: 'Professional',
  ENTREPRENEUR: 'Entrepreneur',
  CREATOR: 'Creator',
  MENTOR: 'Mentor',
  EDUCATION_PROVIDER: 'Education Provider',
  EMPLOYER: 'Employer',
  REAL_ESTATE: 'Real Estate',
  GOVERNMENT_NGO: 'Government / NGO',
};

export const PERSONA_COLORS: Record<string, string> = {
  EARLY_CAREER: 'bg-blue-100 text-blue-800',
  MID_CAREER: 'bg-purple-100 text-purple-800',
  ENTREPRENEUR: 'bg-orange-100 text-orange-800',
  CREATOR: 'bg-pink-100 text-pink-800',
  MENTOR: 'bg-indigo-100 text-indigo-800',
  EDUCATION_PROVIDER: 'bg-green-100 text-green-800',
  EMPLOYER: 'bg-gray-100 text-gray-800',
  REAL_ESTATE: 'bg-yellow-100 text-yellow-800',
  GOVERNMENT_NGO: 'bg-red-100 text-red-800',
};

export const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  FREELANCE: 'Freelance',
  INTERNSHIP: 'Internship',
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  REVIEWED: 'Reviewed',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  OFFERED: 'Offered',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const APPLICATION_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  REVIEWED: 'bg-blue-100 text-blue-800',
  SHORTLISTED: 'bg-purple-100 text-purple-800',
  INTERVIEW: 'bg-indigo-100 text-indigo-800',
  OFFERED: 'bg-green-100 text-green-800',
  HIRED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-100 text-gray-800',
};
