import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PAYMENTS_DISABLED_USER_MESSAGE } from '@/common/config/paymentsFlag';

const root = process.cwd();

const meetupSurfaces = [
  'src/features/meetups/components/ListingMeetupSection.vue',
  'src/features/meetups/components/FirmShakeInlinePanel.vue',
  'src/features/meetups/views/FirmShakeViewPage.vue',
  'src/features/listings/views/ListingDetailPage.vue',
] as const;

describe('payments-disabled UX contracts', () => {
  it('exposes copy that does not promise Stripe or “soon”', () => {
    expect(PAYMENTS_DISABLED_USER_MESSAGE.toLowerCase()).toContain('unavailable');
    expect(PAYMENTS_DISABLED_USER_MESSAGE.toLowerCase()).not.toMatch(/soon|stripe|coming/);
  });

  it('meetup surfaces import the shared disabled message constant', () => {
    for (const rel of meetupSurfaces) {
      const source = readFileSync(join(root, rel), 'utf8');
      expect(source, rel).toMatch(/PAYMENTS_DISABLED_USER_MESSAGE/);
      expect(source, rel).not.toMatch(/coming soon|Stripe soon|payment processor soon/i);
    }
  });

  it('accepted-deposit CTAs gate on isPaymentsEnabled', () => {
    for (const rel of meetupSurfaces.slice(0, 3)) {
      const source = readFileSync(join(root, rel), 'utf8');
      expect(source, rel).toMatch(/isPaymentsEnabled/);
      expect(source, rel).toMatch(/paymentsEnabled/);
    }
  });
});
