/**
 * The cars pillar, rendered.
 *
 * What these pin is the difference between "the server said" and "the phone
 * could not hear": a garage that did not load is not an empty garage, a car
 * that did not load is not a car that left the catalogue, and a catalogue
 * price is never shown without the date it was checked. The listings page
 * through twenty at a time without showing a car twice, and an offer is sent
 * with the amount she typed only after she confirms it.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';

const mockOverview = jest.fn<(...args: any[]) => any>();
const mockCatalogue = jest.fn<(...args: any[]) => any>();
const mockCar = jest.fn<(...args: any[]) => any>();
const mockListings = jest.fn<(...args: any[]) => any>();
const mockSaved = jest.fn<(...args: any[]) => any>();
const mockListing = jest.fn<(...args: any[]) => any>();
const mockSave = jest.fn<(...args: any[]) => any>();
const mockUnsave = jest.fn<(...args: any[]) => any>();
const mockOffer = jest.fn<(...args: any[]) => any>();
const mockNavigate = jest.fn();
let mockParams: Record<string, unknown> = {};

jest.mock('../../services/api', () => ({
  unwrapApiData: (payload: any) => payload?.data ?? payload,
}));

jest.mock('../../services/cars', () => ({
  ...(jest.requireActual('../../services/cars') as object),
  carsApi: {
    overview: (...args: unknown[]) => mockOverview(...args),
    catalogue: (...args: unknown[]) => mockCatalogue(...args),
    car: (...args: unknown[]) => mockCar(...args),
    listings: (...args: unknown[]) => mockListings(...args),
    savedListings: (...args: unknown[]) => mockSaved(...args),
    listing: (...args: unknown[]) => mockListing(...args),
    save: (...args: unknown[]) => mockSave(...args),
    unsave: (...args: unknown[]) => mockUnsave(...args),
    offer: (...args: unknown[]) => mockOffer(...args),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, push: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => effect(), [effect]);
  },
}));

import { CarsScreen } from '../cars/CarsScreen';
import { CarCatalogueScreen } from '../cars/CarCatalogueScreen';
import { CarDetailScreen } from '../cars/CarDetailScreen';
import { CarListingsScreen } from '../cars/CarListingsScreen';
import { CarListingDetailScreen } from '../cars/CarListingDetailScreen';
import { byLabel, press, pressableWithText, renderScreen, settle, shows, unmountScreens, visibleText } from './renderScreen';

jest.setTimeout(30_000);

const answered = (data: unknown) => Promise.resolve({ data: { success: true, data } });

const catalogueCar = (id: string, asAt: string | null) => ({
  id,
  slug: `car-${id}`,
  make: 'Toyota',
  model: `Model ${id}`,
  variant: 'Hybrid',
  year: 2025,
  bodyLabel: 'SUV',
  fuelLabel: 'Hybrid',
  seats: 5,
  priceFrom: 38000,
  ancap: { status: 'current', label: '5 stars, tested 2022' },
  energy: '4.1 L/100 km',
  warranty: null,
  servicingCostYear: 300,
  runningCostYear: 1800,
  asAt,
  sourceUrl: null,
  ratingAvg: 0,
  ratingCount: 0,
  emissions: null,
});

const listing = (id: string) => ({
  id,
  title: `Car ${id}`,
  make: 'Mazda',
  model: 'CX-5',
  year: 2019,
  variant: null,
  bodyLabel: 'SUV',
  fuelLabel: 'Petrol',
  transmission: 'AUTOMATIC',
  odometerKm: 82000,
  price: 24000,
  priceGuideLow: 21000,
  priceGuideHigh: 26000,
  priceVerdict: 'FAIR',
  photos: [],
  suburb: 'Paddington',
  city: 'Brisbane',
  state: 'QLD',
  sellerKind: 'PRIVATE',
  serviceHistory: 'FULL',
  accidentHistory: 'NONE',
  ownersCount: 2,
  ppsrChecked: true,
  roadworthy: false,
  regoExpires: null,
  status: 'ACTIVE',
  seller: { id: 'seller-1', name: 'Jo K.', memberSince: '2025-01-01' },
  saved: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  unmountScreens();
  jest.restoreAllMocks();
});

describe('CarsScreen', () => {
  it('says the garage could not be read, not that it is empty', async () => {
    mockOverview.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<CarsScreen />);

    expect(shows(screen, 'Your garage could not be read')).toBe(true);
    expect(shows(screen, 'No cars in your garage yet')).toBe(false);
    // The catalogue and listings still work; they do not depend on the garage.
    expect(pressableWithText(screen, 'New-car catalogue')).not.toBeNull();
  });

  it('shows her reminders and the server’s own next step on a purchase', async () => {
    mockOverview.mockReturnValue(
      answered({
        vehicles: [],
        reminders: [{ key: 'rego', kind: 'REGO', title: 'Rego is due for the Corolla', body: 'Due 3 Oct.', dueOn: '2026-10-03', daysAway: 7, urgency: 'soon' }],
        purchases: [{ id: 'p1', status: 'ACCEPTED', role: 'buyer', offerAmount: 20000, agreedAmount: 20000, nextStep: 'Pay through ATHENA. The money is held, not sent, until you have the car.', listing: { id: 'l1', title: '2019 Mazda CX-5' } }],
        counts: { saved: 2, listings: 0, testDrives: 0, tradeIns: 0 },
      })
    );

    const screen = await renderScreen(<CarsScreen />);

    expect(shows(screen, 'Rego is due for the Corolla')).toBe(true);
    expect(shows(screen, 'The money is held, not sent')).toBe(true);
    expect(shows(screen, 'Saved listings (2)')).toBe(true);
    expect(shows(screen, 'No cars in your garage yet')).toBe(true);
  });
});

describe('CarCatalogueScreen', () => {
  it('says once when every price was checked at the same time', async () => {
    mockCatalogue.mockReturnValue(answered({ cars: [catalogueCar('a', 'March 2026'), catalogueCar('b', 'March 2026')], total: 2, makes: [], asAt: 'March 2026' }));

    const screen = await renderScreen(<CarCatalogueScreen />);

    const text = visibleText(screen);
    expect(text.match(/as at March 2026/g)).toHaveLength(1);
    expect(text).toContain('$38,000');
    expect(text).toContain('before on-road costs');
  });

  it('puts each car’s own date on it when they were checked at different times', async () => {
    mockCatalogue.mockReturnValue(answered({ cars: [catalogueCar('a', 'March 2026'), catalogueCar('b', '2025 model year')], total: 2, makes: [], asAt: null }));

    const screen = await renderScreen(<CarCatalogueScreen />);

    const text = visibleText(screen);
    expect(text).toContain('Price as at March 2026');
    expect(text).toContain('Price as at 2025 model year');
  });

  it('shows a failed load as a failure, not as "no cars match"', async () => {
    mockCatalogue.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<CarCatalogueScreen />);

    expect(shows(screen, 'The catalogue could not be loaded')).toBe(true);
    expect(shows(screen, 'No cars in the catalogue match')).toBe(false);
  });
});

describe('CarDetailScreen', () => {
  it('says a car is not in the catalogue only when the server says so', async () => {
    mockParams = { slug: 'gone-car' };
    mockCar.mockRejectedValue({ response: { status: 404 } });

    const screen = await renderScreen(<CarDetailScreen />);
    expect(shows(screen, 'That car is not in the catalogue')).toBe(true);
  });

  it('says a car did not load when the request did not get through', async () => {
    mockParams = { slug: 'car-a' };
    mockCar.mockRejectedValue(new Error('Network Error'));

    const screen = await renderScreen(<CarDetailScreen />);
    expect(shows(screen, 'This car could not be loaded')).toBe(true);
    expect(shows(screen, 'not in the catalogue')).toBe(false);
  });
});

describe('CarListingsScreen', () => {
  it('asks for the next twenty at the end of the list, shows each car once, and stops at the total', async () => {
    const first = Array.from({ length: 20 }, (_, i) => listing(`l${i}`));
    mockListings
      .mockReturnValueOnce(answered({ listings: first, total: 22, page: 1 }))
      .mockReturnValueOnce(answered({ listings: [listing('l19'), listing('l20'), listing('l21')], total: 22, page: 2 }));

    const screen = await renderScreen(<CarListingsScreen />);
    expect(mockListings).toHaveBeenLastCalledWith({ q: undefined, bodyType: undefined, sort: undefined, page: 1 });

    const list = screen.root.findAll((node) => typeof node.props?.onEndReached === 'function')[0];
    await act(async () => {
      list.props.onEndReached();
    });
    await settle();

    expect(mockListings).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    // The list's own data, rather than the rows drawn: a FlatList draws a
    // window of its rows at a time, and the question is what it holds.
    const data = (screen.root.findAll((node) => typeof node.props?.onEndReached === 'function')[0].props.data as Array<{ id: string }>).map((l) => l.id);
    expect(data).toHaveLength(22);
    expect(new Set(data).size).toBe(22);

    await act(async () => {
      list.props.onEndReached();
    });
    expect(mockListings).toHaveBeenCalledTimes(2);
  });

  it('calls a seller’s PPSR tick hers, not a check ATHENA made', async () => {
    mockListings.mockReturnValue(answered({ listings: [listing('l1')], total: 1, page: 1 }));

    const screen = await renderScreen(<CarListingsScreen />);
    expect(shows(screen, 'Seller says a PPSR check was done')).toBe(true);
  });

  it('shows the saved list from its own route when opened from "Saved listings"', async () => {
    mockParams = { saved: true };
    mockSaved.mockReturnValue(answered([{ ...listing('s1'), saved: true }]));

    const screen = await renderScreen(<CarListingsScreen />);
    expect(mockSaved).toHaveBeenCalled();
    expect(mockListings).not.toHaveBeenCalled();
    expect(shows(screen, 'Listings you have saved')).toBe(true);
  });
});

describe('CarListingDetailScreen', () => {
  const detail = {
    ...listing('l1'),
    description: 'One owner until last year, serviced at the dealer.',
    features: [],
    isOwner: false,
    canOffer: true,
    guide: { guideLow: 21000, guideHigh: 26000, verdict: 'FAIR', words: 'In line with the guide.', assumed: false },
    beforeYouPay: [],
    protection: { inspectionDays: 14, steps: ['Make an offer.'], feePercent: 6 },
    myPurchase: null,
    running: { perWeek: 120, perYear: 6240 },
    finance: { repayment: 450, ratePct: 9.5, deposit: 2400 },
  };

  it('sends an offer of the amount she typed only once she confirms it', async () => {
    mockParams = { listingId: 'l1' };
    mockListing.mockReturnValue(answered(detail));
    mockOffer.mockReturnValue(answered({ id: 'p1', status: 'OFFERED' }));

    const screen = await renderScreen(<CarListingDetailScreen />);
    await press(pressableWithText(screen, 'Make an offer')!);
    await act(async () => {
      byLabel(screen, 'Your offer')?.props.onChangeText('22500');
    });
    await press(pressableWithText(screen, 'Send offer')!);

    expect(mockOffer).not.toHaveBeenCalled();
    const [title, , buttons] = (Alert.alert as unknown as jest.Mock).mock.calls[0] as [string, string, Array<{ text: string; onPress?: () => Promise<void> }>];
    expect(title).toBe('Offer $22,500?');
    await act(async () => {
      await buttons.find((b) => b.text === 'Send offer')?.onPress?.();
    });

    expect(mockOffer).toHaveBeenCalledWith('l1', { amount: 22500 });
  });

  it('says a listing is gone only when the server says so', async () => {
    mockParams = { listingId: 'l1' };
    mockListing.mockRejectedValue({ response: { status: 404 } });

    const screen = await renderScreen(<CarListingDetailScreen />);
    expect(shows(screen, 'This listing is no longer up')).toBe(true);
  });
});
