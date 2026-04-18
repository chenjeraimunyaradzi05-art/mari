import {
  formatNumber,
  generateAvatarUrl,
  getFullName,
  getInitials,
  getStoredPreference,
  isValidEmail,
  isValidUrl,
  pluralize,
  setStoredPreference,
  slugify,
  truncate,
} from './utils';

describe('client utility helpers', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('reads and writes stored preferences', () => {
    expect(getStoredPreference('athena.currency', 'AUD')).toBe('AUD');

    setStoredPreference('athena.currency', 'usd');

    expect(getStoredPreference('athena.currency', 'AUD')).toBe('usd');
  });

  it('slugifies text safely', () => {
    expect(slugify('  Women in Tech: Perth 2026!  ')).toBe('women-in-tech-perth-2026');
  });

  it('formats compact numbers', () => {
    expect(formatNumber(950)).toBe('950');
    expect(formatNumber(1200)).toBe('1.2K');
    expect(formatNumber(2500000)).toBe('2.5M');
  });

  it('truncates long strings', () => {
    expect(truncate('athena-platform', 6)).toBe('athena...');
    expect(truncate('short', 10)).toBe('short');
  });

  it('builds names and initials', () => {
    expect(getInitials('Ada', 'Lovelace')).toBe('AL');
    expect(getFullName('Ada', 'Lovelace')).toBe('Ada Lovelace');
    expect(getFullName('Ada', '')).toBe('Ada');
  });

  it('pluralizes labels', () => {
    expect(pluralize(1, 'mentor')).toBe('mentor');
    expect(pluralize(2, 'mentor')).toBe('mentors');
    expect(pluralize(2, 'person', 'people')).toBe('people');
  });

  it('validates email and URL input', () => {
    expect(isValidEmail('founder@athena.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidUrl('https://athena.app/privacy')).toBe(true);
    expect(isValidUrl('notaurl')).toBe(false);
  });

  it('creates encoded avatar URLs', () => {
    expect(generateAvatarUrl('Ada Lovelace')).toBe(
      'https://api.dicebear.com/7.x/initials/svg?seed=Ada%20Lovelace'
    );
  });
});
