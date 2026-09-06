import { formatAud, readPackages, startingPrice, quickestDelivery, providerName, type SkillService } from './types';

const service = (overrides: Partial<SkillService> = {}): SkillService =>
  ({
    id: 's1',
    title: 'Brand kit',
    hourlyRate: 150,
    minimumHours: 2,
    provider: { id: 'p1', displayName: 'Mei Chen' },
    packages: null,
    ...overrides,
  }) as SkillService;

describe('marketplace price helpers', () => {
  it('reads packages from the JSON column without trusting it', () => {
    expect(readPackages(null)).toEqual([]);
    expect(readPackages('not json')).toEqual([]);
    expect(readPackages([{ name: 'Basic', price: 120, deliveryDays: 3 }, { name: 'no price' }, 42])).toEqual([{ name: 'Basic', price: 120, deliveryDays: 3 }]);
  });

  it('formats whole Australian dollars', () => {
    expect(formatAud(120)).toBe('$120');
    expect(formatAud(1250)).toBe('$1,250');
  });

  it('the starting price is the cheapest package, else the minimum booking by the hour', () => {
    expect(startingPrice(service({ packages: [{ name: 'Pro', price: 400, deliveryDays: 7 }, { name: 'Basic', price: 120, deliveryDays: 3 }] }))).toEqual({ amount: 120, unit: 'package' });
    expect(startingPrice(service())).toEqual({ amount: 300, unit: '2 hr minimum' });
    expect(startingPrice(service({ minimumHours: 1 }))).toEqual({ amount: 150, unit: 'hour' });
    expect(startingPrice(service({ hourlyRate: 0 }))).toBeNull();
  });

  it('the quickest delivery is the shortest package turnaround', () => {
    expect(quickestDelivery(service({ packages: [{ name: 'Pro', price: 400, deliveryDays: 7 }, { name: 'Basic', price: 120, deliveryDays: 3 }] }))).toBe(3);
    expect(quickestDelivery(service())).toBeNull();
  });

  it('names the provider', () => {
    expect(providerName(service())).toBe('Mei Chen');
  });
});
