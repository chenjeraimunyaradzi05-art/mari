import { chromium, Browser, Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Interactive Ads page a11y', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should have no critical or serious axe violations', async () => {
    await page.goto(`${BASE_URL}/dashboard/ads/interactive`, { waitUntil: 'networkidle' });

    // Ensure previews are rendered
    await page.waitForSelector('main[role="main"], main');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const violations = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact || '')); 
    if (violations.length) {
      const message = violations
        .map((v) => `${v.id}: ${v.help} (impact: ${v.impact}) -> nodes: ${v.nodes.length}`)
        .join('\n');
      throw new Error(`Axe violations found:\n${message}`);
    }
  });
});
