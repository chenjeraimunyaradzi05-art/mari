/**
 * @jest-environment node
 */

/**
 * Emergency help has to be on every page a signed-in member can be on, and the
 * dashboard shell only covers the pages beneath it. The root layout is what
 * covers the reels, jobs, events, search, a live room and a profile she followed
 * a link to, so these keep it from being dropped from there by a tidy-up. The
 * layout is an async server component that reads request headers, so it is read
 * as source rather than rendered; the button's own behaviour is covered with it
 * in components/safety/EmergencyHelp.test.tsx.
 */

import fs from 'fs';
import path from 'path';

const layout = fs.readFileSync(path.resolve(__dirname, 'layout.tsx'), 'utf8');

describe('the root layout', () => {
  it('mounts Emergency help for signed-in members, inside the providers its dialog needs', () => {
    expect(layout).toMatch(/import \{ SignedInEmergencyHelp \} from '@\/components\/safety\/EmergencyHelp'/);

    const providers = layout.slice(layout.indexOf('<Providers>'), layout.indexOf('</Providers>'));
    expect(providers).toContain('<SignedInEmergencyHelp />');
  });
});
