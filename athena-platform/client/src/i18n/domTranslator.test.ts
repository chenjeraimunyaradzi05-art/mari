import { translateDocument, setDocumentDirection } from './domTranslator';
import { DICTIONARIES, ES_DICTIONARY, AR_DICTIONARY, VI_DICTIONARY } from './dictionary';

describe('DOM translator', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav>
        <a href="/jobs">Jobs</a>
        <button>  Cancel  </button>
        <span data-i18n-ignore>Cancel</span>
        <input value="Jobs" />
        <p>Unknown phrase stays</p>
      </nav>`;
  });

  it('translates rendered phrases, keeps spacing, and leaves inputs and ignored nodes alone', () => {
    translateDocument('es');
    expect(document.querySelector('a')!.textContent).toBe('Empleos');
    expect(document.querySelector('button')!.textContent).toBe('  Cancelar  ');
    expect(document.querySelector('[data-i18n-ignore]')!.textContent).toBe('Cancel');
    expect(document.querySelector('input')!.value).toBe('Jobs');
    expect(document.querySelector('p')!.textContent).toBe('Unknown phrase stays');
  });

  it('falls back from a regional locale to its language', () => {
    translateDocument('vi-VN');
    expect(document.querySelector('a')!.textContent).toBe('Việc làm');
  });

  it('sets right-to-left direction for Arabic and left-to-right otherwise', () => {
    setDocumentDirection('ar-AE');
    expect(document.documentElement.dir).toBe('rtl');
    setDocumentDirection('es');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('es');
  });

  it('the three launch languages cover the same phrases', () => {
    const es = Object.keys(ES_DICTIONARY).sort();
    expect(Object.keys(AR_DICTIONARY).sort()).toEqual(es);
    expect(Object.keys(VI_DICTIONARY).sort()).toEqual(es);
    expect(es.length).toBeGreaterThan(200);
    expect(Object.keys(DICTIONARIES)).toEqual(expect.arrayContaining(['es', 'ar', 'vi', 'vi-VN', 'es-MX']));
    // Every entry is translated, not copied.
    for (const [phrase, translated] of Object.entries(VI_DICTIONARY)) {
      expect(translated.trim().length).toBeGreaterThan(0);
      if (!['Email', 'Reels', 'Premium', 'Video', 'Marketing', 'Cookies', 'Error'].includes(phrase)) expect(translated).not.toBe(phrase);
    }
  });
});
