/**
 * The automotive area's vocabulary and reference content: body and fuel
 * types, the safety features explained in plain words, how ANCAP ratings
 * work, the maintenance guide, the service kinds a workshop offers, the
 * inspection checklist, buyer protection, the finance glossary, the
 * insurance guide, the sources to check, and the starter catalogue.
 *
 * Everything with a number carries an "as at". The catalogue is platform
 * content: indicative list prices and published figures for the models
 * most Australians actually buy, kept so a rating is never shown without
 * the year it was given. ANCAP ratings expire six years after the year of
 * test, and the pages say so rather than quoting an old star as current.
 */

export const AUTOMOTIVE_AS_AT = '2025-26';
export const CATALOGUE_AS_AT = '2025 model year, indicative list prices before on-road costs';

/** ANCAP ratings carry a date stamp and lapse six years after the year of test. */
export const ANCAP_VALID_YEARS = 6;

export const AU_STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
export type AuState = (typeof AU_STATES)[number];

export const BODY_TYPES = [
  { key: 'HATCH', label: 'Hatch', blurb: 'Small, easy to park, cheapest to run' },
  { key: 'SEDAN', label: 'Sedan', blurb: 'A separate boot and a quieter ride' },
  { key: 'WAGON', label: 'Wagon', blurb: 'Sedan comfort with a boot that takes the pram' },
  { key: 'SUV', label: 'SUV', blurb: 'Higher seat, bigger boot, the family default' },
  { key: 'UTE', label: 'Ute', blurb: 'A tray or tub; work and weekends' },
  { key: 'VAN', label: 'Van', blurb: 'For a business, or a camper' },
  { key: 'PEOPLE_MOVER', label: 'People mover', blurb: 'Seven or eight seats you can actually use' },
  { key: 'COUPE', label: 'Coupe', blurb: 'Two doors, for the joy of it' },
  { key: 'CONVERTIBLE', label: 'Convertible', blurb: 'The roof comes off' },
] as const;
export type BodyKey = (typeof BODY_TYPES)[number]['key'];

export const FUEL_TYPES = [
  { key: 'PETROL', label: 'Petrol', blurb: 'Cheapest to buy, most to run' },
  { key: 'DIESEL', label: 'Diesel', blurb: 'Towing and long distances' },
  { key: 'HYBRID', label: 'Hybrid', blurb: 'Petrol with a battery that halves city fuel use; nothing to plug in' },
  { key: 'PLUG_IN_HYBRID', label: 'Plug-in hybrid', blurb: 'Fifty to a hundred electric kilometres, then petrol' },
  { key: 'ELECTRIC', label: 'Electric', blurb: 'No fuel, little servicing, charging at home if you can' },
] as const;
export type FuelKey = (typeof FUEL_TYPES)[number]['key'];

export const TRANSMISSIONS = [{ key: 'AUTOMATIC', label: 'Automatic' }, { key: 'MANUAL', label: 'Manual' }] as const;

export const MAKES = [
  'Audi', 'BMW', 'BYD', 'Chery', 'Ford', 'GWM', 'Honda', 'Hyundai', 'Isuzu', 'Jeep', 'Kia', 'Land Rover', 'LDV', 'Lexus', 'Mazda',
  'Mercedes-Benz', 'MG', 'Mini', 'Mitsubishi', 'Nissan', 'Peugeot', 'Polestar', 'Renault', 'Skoda', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo', 'Other',
];

export const CAR_CONDITIONS = [
  { key: 'EXCELLENT', label: 'Excellent', blurb: 'No marks, full service history, tyres and brakes recent' },
  { key: 'GOOD', label: 'Good', blurb: 'The odd stone chip, serviced on time, nothing outstanding' },
  { key: 'FAIR', label: 'Fair', blurb: 'Some dents or scuffs, a service overdue, wear on the way' },
  { key: 'POOR', label: 'Poor', blurb: 'Damage, warning lights, or work needed before it is safe' },
] as const;
export type ConditionKey = (typeof CAR_CONDITIONS)[number]['key'];

// ------------------------------------------------------------ safety, explained

export interface SafetyFeature {
  key: string;
  name: string;
  what: string;
  why: string;
  lookFor: string;
}

export const SAFETY_FEATURES: SafetyFeature[] = [
  { key: 'aeb', name: 'Autonomous emergency braking (AEB)', what: 'The car watches the road ahead and brakes on its own if you have not reacted to a car, a pedestrian or a cyclist in your path.', why: 'It takes the sting out of the most common crash there is, the low-speed nose-to-tail, and the better systems work at night and see people and bikes.', lookFor: 'AEB that covers pedestrians and cyclists, and works at junctions (turning across traffic), not just in a straight line.' },
  { key: 'lane_keep', name: 'Lane keeping assist', what: 'Gentle steering back into the lane if you drift over the line without indicating.', why: 'Run-off-road and head-on crashes are the ones that kill on country roads, and they start with a drift.', lookFor: 'Assist that nudges rather than fights you, and that you can switch off for a narrow road.' },
  { key: 'blind_spot', name: 'Blind spot monitoring', what: 'A light in the mirror when a car is sitting where you cannot see it.', why: 'Lane changes on a motorway are where a quick glance is not enough.', lookFor: 'Ideally paired with rear cross-traffic alert.' },
  { key: 'rear_cross_traffic', name: 'Rear cross-traffic alert', what: 'Warns, and on newer cars brakes, when you are reversing out and something is coming along behind.', why: 'Shopping centre car parks. Anyone with a pram or a toddler knows the moment.', lookFor: 'The version that brakes, not only beeps.' },
  { key: 'adaptive_cruise', name: 'Adaptive cruise control', what: 'Cruise control that keeps a gap to the car in front, slowing and speeding up with the traffic.', why: 'Long drives are less tiring, and a tired driver is a slower one.', lookFor: 'Stop-and-go capability if you sit in city traffic.' },
  { key: 'driver_attention', name: 'Driver attention monitoring', what: 'Watches your steering (or your eyes) and suggests a break when it sees fatigue or distraction.', why: 'Fatigue is a factor in about one in five fatal crashes.', lookFor: 'A camera-based system reads more reliably than one that only watches the steering.' },
  { key: 'speed_sign', name: 'Speed sign recognition', what: 'Reads the limit from the signs and shows it on the dash; some cars can set the cruise to it.', why: 'School zones and roadworks change the limit on you.', lookFor: 'One that can be silenced if the chime annoys you; some are relentless.' },
  { key: 'reversing_camera', name: 'Reversing camera and sensors', what: 'A view behind you when reversing, with sensors that beep as you close in.', why: 'Small children are invisible behind a tall car. A camera is the single most useful thing for a driveway.', lookFor: 'A 360-degree view on a large SUV or ute.' },
  { key: 'isofix', name: 'ISOFIX and top tether points', what: 'Anchor points that a child seat clicks straight into.', why: 'A seat fitted properly is what protects a child; ISOFIX makes a proper fit far more likely.', lookFor: 'Points in the outboard rear seats (Australia requires top tethers; ISOFIX is on most new cars) and whether three seats fit across.' },
  { key: 'curtain_airbags', name: 'Curtain airbags to the third row', what: 'Airbags that drop from the roof lining along the windows.', why: 'They protect heads in side impacts and rollovers. On a seven-seater, check they reach the back row.', lookFor: 'Full-length curtains if you carry children in the back.' },
  { key: 'centre_airbag', name: 'Centre airbag', what: 'An airbag between the front seats.', why: 'It stops the driver and front passenger hitting each other in a side impact; ANCAP has scored it since 2020.', lookFor: 'Newer designs have it; older ones usually do not.' },
  { key: 'esc', name: 'Electronic stability control (ESC)', what: 'Brakes individual wheels to stop a skid before you feel it.', why: 'Mandatory on every new passenger car sold in Australia since 2013, and one of the biggest life-savers ever fitted to cars.', lookFor: 'Any used car from 2011 on should have it; check a cheaper older car.' },
  { key: 'tyre_pressure', name: 'Tyre pressure monitoring', what: 'Warns when a tyre is going down.', why: 'An under-inflated tyre grips less, wears faster and uses more fuel, and a slow puncture is invisible.', lookFor: 'Direct sensors in each wheel give a reading; indirect systems only warn.' },
];

export const ANCAP_EXPLAINED = {
  what: 'ANCAP crash-tests new cars and rates them from zero to five stars across adult protection, child protection, vulnerable road users (pedestrians and cyclists) and safety assist (the systems that avoid the crash in the first place).',
  dateStamp: 'Every rating carries the year of the test. The tests get harder every few years, so a five-star car from 2018 was not held to the same standard as one from 2024.',
  expiry: 'Since December 2022, ratings lapse six years after the test year. An expired rating does not mean the car became unsafe; it means the score is no longer comparable with current cars.',
  unrated: 'Some makers do not submit a model for testing. Unrated is not zero stars, but it does mean nobody independent has checked.',
  url: 'https://www.ancap.com.au',
};

// ------------------------------------------------------------- maintenance

export interface MaintenanceItem {
  key: string;
  title: string;
  every: string;
  what: string;
  cost: string;
  ev?: 'same' | 'none' | 'different';
}

export const MAINTENANCE_GUIDE: MaintenanceItem[] = [
  { key: 'logbook', title: 'Logbook service', every: 'Whatever the maker says, usually every 10,000 to 15,000 km or twelve months, whichever comes first', what: 'Oil and filter, a look over brakes, tyres, belts, fluids and lights, and the software. Stamped in the book, which is what a buyer looks for later.', cost: '$250 to $550 at a capped-price dealer; independents are often less', ev: 'different' },
  { key: 'oil', title: 'Engine oil and filter', every: '10,000 to 15,000 km, or as the logbook says', what: 'Old oil stops protecting the engine. Modern engines are fussy about grade; use the one on the cap.', cost: '$150 to $300', ev: 'none' },
  { key: 'tyres', title: 'Tyres', every: 'Check pressure monthly; rotate every 10,000 km; replace at 1.6 mm tread (the wear bars) or by five to six years', what: 'The only part touching the road. Pressures are on a sticker inside the driver door.', cost: '$150 to $400 a tyre; rotation $50 to $100', ev: 'same' },
  { key: 'brakes', title: 'Brake pads and discs', every: 'Inspected at every service; pads typically last 40,000 to 80,000 km', what: 'A squeal, a grinding sound, or a longer pedal means look now. Discs are replaced less often than pads.', cost: '$250 to $600 an axle for pads; more with discs', ev: 'same' },
  { key: 'brake_fluid', title: 'Brake fluid', every: 'Every two years', what: 'It absorbs water over time and then boils under hard braking. Cheap to do, easy to forget.', cost: '$100 to $200', ev: 'same' },
  { key: 'battery', title: '12-volt battery', every: 'Three to five years', what: 'A slow crank on a cold morning is the warning. Electric cars have one too, for the locks and the computers.', cost: '$200 to $450 fitted', ev: 'same' },
  { key: 'coolant', title: 'Coolant', every: 'Every five years or as specified', what: 'Keeps the engine (or the battery pack) at temperature. Never top up with plain water for long.', cost: '$150 to $300', ev: 'same' },
  { key: 'filters', title: 'Air and cabin filters', every: 'Every 12 to 24 months; sooner on dusty roads', what: 'The cabin filter is what stops the hay fever; the engine filter protects the engine.', cost: '$50 to $150 each', ev: 'same' },
  { key: 'wipers', title: 'Wiper blades', every: 'Every twelve months', what: 'When they smear or judder. A five-minute job you can do in the car park of the parts shop.', cost: '$30 to $80 a pair', ev: 'same' },
  { key: 'timing', title: 'Timing belt', every: 'Around 100,000 km, only on engines that have a belt rather than a chain', what: 'If it breaks the engine can be destroyed. Ask whether your engine has one and when it was last done.', cost: '$600 to $1,500', ev: 'none' },
  { key: 'transmission', title: 'Transmission fluid', every: '60,000 to 100,000 km, unless the maker says sealed for life', what: 'A "sealed" transmission still benefits from a fluid change at high kilometres. Ask an independent.', cost: '$250 to $500', ev: 'none' },
  { key: 'aircon', title: 'Air-conditioning', every: 'Regas when it stops blowing cold, typically every few years', what: 'A regas needs a licensed technician. A musty smell is the cabin filter or the evaporator.', cost: '$150 to $350', ev: 'same' },
  { key: 'ev_pack', title: 'Electric: the battery pack', every: 'Nothing to service; a health check at a service', what: 'Keep the charge between roughly twenty and eighty percent day to day and fast-charge when you need to, not every night. Most packs carry an eight-year warranty.', cost: 'Included in a service', ev: 'different' },
];

// -------------------------------------------------------------- workshops

export interface ServiceKind {
  key: string;
  label: string;
  from: number;
  to: number;
  minutes: number;
  blurb: string;
}

export const SERVICE_KINDS: ServiceKind[] = [
  { key: 'logbook', label: 'Logbook service', from: 250, to: 550, minutes: 120, blurb: 'The scheduled service, stamped' },
  { key: 'oil', label: 'Oil and filter change', from: 150, to: 300, minutes: 60, blurb: 'Between logbook services' },
  { key: 'tyres', label: 'Tyres, rotation and balance', from: 50, to: 120, minutes: 45, blurb: 'Rotation, balance, or new tyres fitted' },
  { key: 'wheel_alignment', label: 'Wheel alignment', from: 90, to: 180, minutes: 45, blurb: 'If it pulls to one side or the tyres wear unevenly' },
  { key: 'brakes', label: 'Brakes', from: 250, to: 800, minutes: 120, blurb: 'Pads, discs, fluid' },
  { key: 'battery', label: 'Battery test or replacement', from: 40, to: 450, minutes: 30, blurb: 'The twelve-volt battery' },
  { key: 'aircon', label: 'Air-conditioning', from: 150, to: 350, minutes: 60, blurb: 'Regas, or find the smell' },
  { key: 'diagnostics', label: 'Diagnostics', from: 100, to: 220, minutes: 60, blurb: 'A warning light, a noise, a feeling' },
  { key: 'safety_certificate', label: 'Safety certificate or roadworthy', from: 80, to: 200, minutes: 60, blurb: 'Needed to sell or re-register in most states' },
  { key: 'pre_purchase', label: 'Pre-purchase inspection', from: 200, to: 350, minutes: 90, blurb: 'Before you hand over money for a used car' },
  { key: 'suspension', label: 'Suspension and steering', from: 300, to: 1500, minutes: 180, blurb: 'Shocks, bushes, ball joints' },
  { key: 'timing', label: 'Timing belt', from: 600, to: 1500, minutes: 240, blurb: 'The big one on belt engines' },
  { key: 'windscreen', label: 'Windscreen', from: 90, to: 600, minutes: 90, blurb: 'A chip repaired or a screen replaced' },
  { key: 'ev_service', label: 'Electric or hybrid service', from: 200, to: 450, minutes: 90, blurb: 'Pack health check, brake fluid, cabin filter, tyres' },
  { key: 'repair', label: 'General repair', from: 150, to: 2000, minutes: 180, blurb: 'Describe it and get a quote first' },
];

export const INSPECTION_SECTIONS = [
  { key: 'body', label: 'Body and paint', items: ['Panel gaps even', 'Paint match and overspray', 'Rust in sills, boot floor, under carpets', 'Glass and lights', 'Signs of repair (new bolts, filler)'] },
  { key: 'tyres', label: 'Tyres and wheels', items: ['Tread depth all four and spare', 'Even wear (alignment)', 'Age from the sidewall date code', 'Wheel damage', 'Jack and tools present'] },
  { key: 'engine', label: 'Under the bonnet', items: ['Oil level and colour', 'Coolant level and colour', 'Leaks under the car', 'Belts and hoses', 'Battery terminals and date', 'Cold start and idle'] },
  { key: 'underbody', label: 'Underbody and suspension', items: ['Shocks, bushes, ball joints', 'Exhaust condition', 'Drive shafts and boots', 'Brake lines and hoses', 'Chassis straightness'] },
  { key: 'interior', label: 'Interior and electrics', items: ['Every switch, window and light', 'Warning lights on start-up then off', 'Air-conditioning cold', 'Seat belts and ISOFIX points', 'Odometer against service history', 'Smell of damp or smoke'] },
  { key: 'road_test', label: 'Road test', items: ['Starts, idles, pulls cleanly', 'Gear changes smooth', 'Brakes straight without judder', 'Steering centred, no pull', 'Noises over bumps', 'Cruise and driver aids work'] },
  { key: 'documents', label: 'Papers', items: ['Registration matches the plates and VIN', 'PPSR certificate (no money owing, not written off, not stolen)', 'Service book stamped', 'Safety certificate if required', 'Seller matches the registered owner'] },
] as const;

export const BUYER_PROTECTION = {
  inspectionDays: 14,
  steps: [
    'Make an offer. The seller accepts, and the price is agreed.',
    'Pay through ATHENA. The money is held, not sent to the seller.',
    'Collect the car and confirm you have it. The inspection period starts.',
    'Fourteen days to drive it, get it looked at, and check the papers.',
    'Release the money, or open a dispute. Nothing moves until you do, or the period ends.',
  ],
  covers: ['The car is not as described (damage, kilometres, history, a warning light that was hidden)', 'The papers do not match (VIN, registration, money owing)', 'The seller does not hand it over'],
  doesNotCover: ['Changing your mind about a car that matches its listing', 'Wear and tear consistent with the age and kilometres', 'Damage after you took delivery'],
  note: 'A card authorisation holds funds for a limited time; where a bank will not hold for the full period ATHENA asks the buyer to re-authorise rather than releasing early.',
};

export const FRAUD_SIGNS = [
  'A price well under the guide for the year and kilometres',
  'A seller who cannot meet in person, is overseas, or wants a deposit to "hold" the car',
  'Payment asked for outside ATHENA, by transfer, gift card or a "shipping agent"',
  'No VIN, or a VIN the seller will not give you before you meet',
  'Photos that look like a brochure or another advertisement',
  'Kilometres that do not fit the age, or a service book with gaps',
  'A registration check that shows a different make, colour or owner',
];

// ---------------------------------------------------------------- finance

export const FINANCE_DEFAULTS = {
  asAt: 'indicative advertised rates, 2025-26',
  newCarSecured: { low: 6.49, typical: 7.99, high: 11.99 },
  usedCarSecured: { low: 7.49, typical: 9.49, high: 14.99 },
  unsecured: { low: 9.99, typical: 12.99, high: 19.99 },
  greenDiscountPct: 0.5,
  typicalTermMonths: 60,
  maxUsedCarAgeAtEnd: 12,
  comparisonNote: 'The comparison rate folds the fees into the rate over a standard loan ($30,000 over five years); it is the number to compare between lenders.',
};

export const FINANCE_GLOSSARY = [
  { term: 'Comparison rate', plain: 'The interest rate with the fees added in, worked out on a standard loan so lenders can be compared. Lower is cheaper, all else equal.' },
  { term: 'Secured loan', plain: 'The car is the security. If you stop paying, the lender can take it. In exchange the rate is lower than an unsecured loan.' },
  { term: 'Balloon (residual)', plain: 'A lump sum left at the end, so the monthly repayments are smaller. You still owe it, and by then the car is worth less. Say no unless you have a plan for it.' },
  { term: 'Fixed and variable', plain: 'Fixed means the repayment never changes. Most car loans are fixed; check the fee for paying it out early.' },
  { term: 'Establishment and monthly fees', plain: 'A fee to set the loan up and sometimes one every month. Small numbers that add up over five years; the comparison rate captures them.' },
  { term: 'Pre-approval', plain: 'A lender agrees in principle to an amount before you have chosen the car, usually good for 60 to 90 days. It lets you negotiate like a cash buyer. Only a lender or a licensed credit broker can give you one, and it follows a credit check; ATHENA is neither and cannot. What ATHENA gives you is its own estimate of what you could carry, which is a different thing and worth having before you go.' },
  { term: 'Dealer finance', plain: 'Arranged at the dealership through a lender the dealer works with. Convenient, sometimes competitive, often not; bring a pre-approval to compare against.' },
  { term: 'Novated lease', plain: 'Your employer pays the lease from your salary before tax. Can suit a higher income and a new car, especially an electric one under the FBT exemption; ask a tax agent.' },
  { term: 'Loan-to-value (LVR)', plain: 'The loan as a share of the car\'s value. Over 100 percent (fees rolled in, no deposit) means owing more than the car is worth for the first years.' },
  { term: 'Hardship', plain: 'If you cannot pay, tell the lender before you miss a payment. Every lender has a hardship team by law, and a paused loan is better than a repossessed car.' },
];

export const LENDER_CHECKS = [
  'Income: payslips (three months), or two years of tax returns if self-employed',
  'Expenses: a lender reads your last three months of statements',
  'Other debts: cards (the limit counts, not the balance), buy-now-pay-later, HELP does not usually count against you but reduces take-home pay',
  'Employment: six months in the job is the usual line, twelve for casual work',
  'Credit report: defaults and late payments in the last five years',
  'Deposit: ten percent or more lifts the odds and lowers the rate',
  'Residency: citizen, permanent resident, or a visa with more time on it than the loan',
  'Identity: licence or passport and a Medicare card',
];

export const EMPLOYMENT_KINDS = [
  { key: 'FULL_TIME', label: 'Full time' }, { key: 'PART_TIME', label: 'Part time' }, { key: 'CASUAL', label: 'Casual' },
  { key: 'SELF_EMPLOYED', label: 'Self-employed' }, { key: 'CONTRACT', label: 'Contract' }, { key: 'PARENTAL_LEAVE', label: 'On parental leave' }, { key: 'NOT_WORKING', label: 'Not working right now' },
] as const;

// -------------------------------------------------------------- insurance

export const COVER_TYPES = [
  { key: 'COMPREHENSIVE', label: 'Comprehensive', covers: 'Your car and theirs, whoever is at fault, plus theft, fire, storm and hail. Usually a hire car after a not-at-fault crash.', suits: 'Any car you could not afford to replace tomorrow, and anything under finance (the lender will insist).' },
  { key: 'TPFT', label: 'Third party, fire and theft', covers: 'Damage you do to other people\'s cars and property, and your own car if it is stolen or burns. Not your own car in a crash.', suits: 'An older car worth a few thousand that you would rather not lose to theft.' },
  { key: 'TPP', label: 'Third party property', covers: 'Only the damage you do to other people\'s cars and property. Nothing for your own car.', suits: 'A car worth less than the premium difference; you carry the risk of your own repairs.' },
  { key: 'CTP', label: 'Compulsory third party (CTP)', covers: 'Injuries to people in a crash you cause. Not any car. Compulsory everywhere; in most states it is paid with registration, in New South Wales you buy the Green Slip separately, in Queensland you choose the insurer at registration.', suits: 'Everyone. It is the law.' },
] as const;
export type CoverKey = (typeof COVER_TYPES)[number]['key'];

export const PREMIUM_FACTORS = [
  { key: 'age', label: 'Your age and experience', how: 'Under 25 pays the most; a clean record over years brings it down.' },
  { key: 'value', label: 'The car\'s value and type', how: 'A dearer car costs more to repair; some models are stolen more often; performance and electric cars cost more to fix.' },
  { key: 'postcode', label: 'Where it lives', how: 'Postcodes with more theft, more crashes and more hail cost more.' },
  { key: 'garaging', label: 'Where it sleeps', how: 'A locked garage beats a carport beats the street.' },
  { key: 'km', label: 'How far you drive', how: 'Fewer kilometres, fewer chances of a crash. Say so; many insurers price it.' },
  { key: 'excess', label: 'The excess you choose', how: 'A higher excess (what you pay on a claim) lowers the premium. Pick one you could actually pay next week.' },
  { key: 'drivers', label: 'Who else drives it', how: 'Listing a young driver raises it; an unlisted driver crashing can void the claim.' },
  { key: 'multi', label: 'Other policies', how: 'Home and contents with the same insurer usually earns ten percent or so off each.' },
];

export const CLAIMS_GUIDE = [
  'Make sure everyone is safe. Call 000 if anyone is hurt or the road is blocked.',
  'Exchange names, phone numbers, registration numbers and licence details. Photograph everything, including the other car\'s plates and the scene.',
  'Do not admit fault at the roadside; describe what happened, not whose fault it was.',
  'Report it to police if anyone is injured, a car needs towing, or the other driver leaves.',
  'Lodge the claim with your insurer that day, online or by phone. Have your policy number, the photos and the other party\'s details.',
  'Choice of repairer: if your policy has it, you pick the workshop; if not, the insurer does. Ask for a lifetime guarantee on the repair either way.',
  'A hire car: comprehensive policies often include one after a not-at-fault crash; ask before you book your own.',
  'If the claim is refused or the settlement seems low, ask for the decision in writing, then go to the insurer\'s internal dispute team, then to AFCA (free) if it is still not right.',
];

export const WOMEN_AND_INSURANCE = [
  'Ask for the price on your own name and history. Cover held in a partner\'s name builds no record for you; a no-claim history is worth money at the next quote.',
  'Australian insurers are allowed to use gender in pricing where actuarial data supports it. Compare at least three quotes; the spread between insurers is usually wider than any gender difference.',
  'A career break or parental leave does not raise a premium, but a lapsed policy does: keep continuous cover, even third party, between cars.',
  'If you are leaving a violent relationship, an insurer can move the policy into your name alone and send correspondence to a safe address. Ask for the family violence team; the industry code requires one.',
  'Add-ons worth a look: choice of repairer, a hire car for any claim, and roadside assistance if you drive alone at night.',
];

// ------------------------------------------------- warranties and fleets

/** Extended warranties, and the consumer guarantees that sit under them whatever the brochure says. */
export const EXTENDED_WARRANTY = {
  what: 'A contract, usually sold at the dealership, that pays for some repairs after the maker\'s warranty ends. Most are insurance products underwritten by someone else, so the product disclosure statement, not the salesperson, says what is covered.',
  covers: ['Named mechanical and electrical parts, listed in the policy', 'A claim limit per repair and usually a total limit; some pay the workshop directly, some pay you back', 'Sometimes roadside assistance or a hire car while the car is off the road'],
  doesNotCover: ['Servicing, tyres, brakes, wipers, batteries and anything called wear and tear', 'A fault that was there before the policy started, or one an inspection would have found', 'A car serviced outside the schedule, or by a workshop the policy does not allow'],
  costRange: { low: 800, high: 3000 },
  worthIt: [
    'Under Australian Consumer Law a car bought from a dealer has to be of acceptable quality for a reasonable time given its age, price and kilometres. That guarantee is free, cannot be signed away, and is often stronger than the warranty being sold on top of it.',
    'A private sale carries no consumer guarantee. That is where an extended warranty, or a pre-purchase inspection, earns its keep.',
    'Weigh the price against the repairs it would realistically cover. On a well-kept car with a full history, the same money in a savings account usually does the same job.',
    'You do not have to buy it on the day. A dealer can sell it later, an insurer can sell one directly, and the price is negotiable.',
  ],
  rights: 'If a dealer says a repair is not covered, ask in writing whether the consumer guarantee applies before you pay. The ACCC and your state fair-trading office take complaints; AFCA takes disputes with the insurer behind the policy.',
};

/** The fleet programme: one account for a business with several vehicles, run through the workshops in the directory. */
export const FLEET_PROGRAMME = {
  what: 'For a business with a handful of cars, vans or utes and nobody whose job it is to look after them.',
  includes: [
    'One account for every vehicle, with the service, registration and insurance reminders for each',
    'Bookings across the directory\'s workshops at the fleet rate each workshop has agreed',
    'One monthly statement instead of a receipt in every glovebox',
    'Priority slots, and a loan car where the workshop offers one',
    'Pre-purchase inspections and a trade-in guide when a vehicle is added or retired',
  ],
  suits: 'Between two and fifty vehicles. A larger fleet is quoted separately.',
  note: 'ATHENA is paid by the workshop out of the booking commission, not by an extra charge on the business.',
};

/**
 * What ATHENA is paid when it introduces a member to a partner, as the
 * blueprint sets it out. The member does not pay these; the partner does,
 * and the figures are published so the introduction is never a secret.
 *
 * This is a published rate card, not a record of money coming in. Finance
 * and insurance have no partner signed, so nothing is charged on either:
 * the finance line in particular used to say a lender paid "after a
 * pre-approval arranged here", which described both a lender and a
 * pre-approval that do not exist. A fee is only ever written to the ledger
 * for an introduction that really happened, by hand, with the partner
 * named.
 */
export const REFERRAL_FEES = {
  dealerSale: { percent: 1, min: 200, max: 500, words: 'A dealership pays between $200 and $500 when a test drive booked here becomes a sale.' },
  finance: { percent: 1, words: 'If ATHENA ever introduces you to a lender, that lender would pay about one percent of a loan that settles. No lender is on the panel today, ATHENA is not a licensed credit broker, and nothing is charged on finance.' },
  insurance: { percent: 15, words: 'If ATHENA ever introduces you to an insurer, that insurer would pay a share of the first year\'s premium, around fifteen percent. No insurer is on the panel today; the estimates here come from no insurer\'s rates and earn nothing.' },
  warranty: { percent: 10, words: 'A warranty provider pays a share of the price of an extended warranty sold through an introduction here.' },
  parts: { percent: 5, words: 'A parts supplier pays a share of the parts ordered through a workshop booking here.' },
  fleet: { percent: 0, words: 'A fleet programme is paid from the workshop\'s booking commission; nothing extra.' },
};

// --------------------------------------------------------------- emissions

/** Grams of CO2 from a litre burnt, the factors the Green Vehicle Guide uses. */
const CO2_PER_LITRE = { PETROL: 2310, DIESEL: 2680 } as const;
/** The share of a plug-in hybrid's kilometres that run on petrol once the battery is used. */
const PHEV_PETROL_SHARE = 0.4;
/** The line under which the catalogue calls a car low-emission: a small hybrid or better. */
export const LOW_EMISSIONS_G_KM = 120;

/**
 * Tailpipe CO2 in grams a kilometre: the official figure when the catalogue
 * carries one, otherwise worked out from the published consumption.
 * Electricity is not counted, which is why the label says "tailpipe": an
 * electric car's emissions depend on the grid or the roof it charges from.
 */
export function co2ForCar(fuelType: string, fuelPer100: number | null | undefined, stored?: number | null): { gramsKm: number | null; label: string } {
  if (stored !== null && stored !== undefined) return { gramsKm: stored, label: `${stored} g/km tailpipe, the official figure` };
  if (fuelType === 'ELECTRIC') return { gramsKm: 0, label: 'No tailpipe emissions; the grid or your roof decides the rest' };
  if (!fuelPer100 || fuelPer100 <= 0) return { gramsKm: null, label: 'Not published' };
  const perLitre = fuelType === 'DIESEL' ? CO2_PER_LITRE.DIESEL : CO2_PER_LITRE.PETROL;
  const share = fuelType === 'PLUG_IN_HYBRID' ? PHEV_PETROL_SHARE : 1;
  const grams = Math.round((fuelPer100 / 100) * perLitre * share);
  return { gramsKm: grams, label: `about ${grams} g/km tailpipe${fuelType === 'PLUG_IN_HYBRID' ? ', for the kilometres past the battery' : ', from the published consumption'}` };
}

// ---------------------------------------------------------------- sources

export const SOURCES = [
  { key: 'ancap', name: 'ANCAP safety ratings', url: 'https://www.ancap.com.au', what: 'The star rating, its year, and the detailed scores for any tested car.' },
  { key: 'gvg', name: 'Green Vehicle Guide', url: 'https://www.greenvehicleguide.gov.au', what: 'Official fuel consumption, energy use and emissions for cars sold in Australia.' },
  { key: 'ppsr', name: 'PPSR check', url: 'https://www.ppsr.gov.au', what: 'For two dollars: money owing, written-off, or stolen, by VIN. Do it before you pay for any used car.' },
  { key: 'moneysmart', name: 'Moneysmart', url: 'https://moneysmart.gov.au/car-loans', what: 'ASIC\'s guide to car loans and its calculator, with no lender behind it.' },
  { key: 'accc', name: 'ACCC on buying a car', url: 'https://www.accc.gov.au/consumers/buying-products-and-services/cars', what: 'Your consumer guarantees when a dealer sells you a car, new or used.' },
  { key: 'afca', name: 'AFCA', url: 'https://www.afca.org.au', what: 'Free, independent disputes with an insurer or a lender.' },
  { key: 'ev_council', name: 'Electric Vehicle Council', url: 'https://electricvehiclecouncil.com.au', what: 'State incentives for electric cars and the public charging map.' },
];

export const REGO_CHECKS: Record<AuState, { name: string; url: string }> = {
  QLD: { name: 'Queensland registration check', url: 'https://www.service.transport.qld.gov.au/checkrego' },
  NSW: { name: 'Service NSW registration check', url: 'https://www.service.nsw.gov.au/transaction/check-vehicle-registration' },
  VIC: { name: 'VicRoads registration check', url: 'https://www.vicroads.vic.gov.au/registration/buy-sell-or-transfer-a-vehicle/check-vehicle-registration' },
  WA: { name: 'WA vehicle licence check', url: 'https://online.transport.wa.gov.au/webExternal/registration/' },
  SA: { name: 'SA registration check', url: 'https://account.ezyreg.sa.gov.au/account/check-registration.htm' },
  TAS: { name: 'Tasmania registration check', url: 'https://www.transport.tas.gov.au/MRSWebInterface/public/regoLookup/registrationLookup.jsf' },
  ACT: { name: 'ACT registration check', url: 'https://rego.act.gov.au/regosoawicket/public/reg/FindRegistrationPage' },
  NT: { name: 'NT registration check', url: 'https://nt.gov.au/driving/rego/check-registration' },
};

/** Indicative annual registration and CTP, a passenger car, by state. */
export const REGO_AND_CTP: Record<AuState, number> = { QLD: 900, NSW: 1050, VIC: 900, WA: 800, SA: 850, TAS: 750, ACT: 1100, NT: 800 };

// --------------------------------------------------------------- catalogue

export interface CarSeed {
  slug: string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  bodyType: BodyKey;
  fuelType: FuelKey;
  transmission?: 'AUTOMATIC' | 'MANUAL';
  seats?: number;
  priceFrom: number;
  ancapStars?: number;
  ancapYear?: number;
  fuelPer100?: number;
  kwhPer100?: number;
  rangeKm?: number;
  warrantyYears: number;
  /** Null means unlimited kilometres. */
  warrantyKm: number | null;
  serviceIntervalMonths: number;
  serviceIntervalKm: number;
  servicingCostYear?: number;
  safetyFeatures: string[];
  highlights: string[];
}

const COMMON = ['aeb', 'lane_keep', 'reversing_camera', 'isofix', 'curtain_airbags', 'esc'];
const COMMON_PLUS = [...COMMON, 'adaptive_cruise', 'blind_spot', 'rear_cross_traffic', 'speed_sign', 'driver_attention'];

/**
 * The models most Australians buy, with the published figures for the entry
 * grade. Safety features are the ones typically standard across the range;
 * the spec sheet decides for a particular grade. Warranty terms are the
 * maker's private-buyer terms.
 */
export const CAR_SEEDS: CarSeed[] = [
  { slug: 'toyota-corolla-hybrid', make: 'Toyota', model: 'Corolla', variant: 'Ascent Sport hybrid hatch', year: 2025, bodyType: 'HATCH', fuelType: 'HYBRID', priceFrom: 32000, ancapStars: 5, ancapYear: 2018, fuelPer100: 4.0, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 260, safetyFeatures: [...COMMON, 'adaptive_cruise', 'speed_sign', 'centre_airbag'], highlights: ['Cheapest hybrid to run in its class', 'Capped-price servicing among the lowest', 'Holds its value'] },
  { slug: 'toyota-yaris-cross-hybrid', make: 'Toyota', model: 'Yaris Cross', variant: 'GX hybrid', year: 2025, bodyType: 'SUV', fuelType: 'HYBRID', priceFrom: 30000, ancapStars: 5, ancapYear: 2020, fuelPer100: 3.8, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 260, safetyFeatures: [...COMMON, 'adaptive_cruise', 'speed_sign', 'centre_airbag'], highlights: ['Small SUV with hatch running costs', 'Eight airbags including a centre bag', 'Easy to park'] },
  { slug: 'toyota-rav4-hybrid', make: 'Toyota', model: 'RAV4', variant: 'GX hybrid 2WD', year: 2025, bodyType: 'SUV', fuelType: 'HYBRID', priceFrom: 42000, ancapStars: 5, ancapYear: 2019, fuelPer100: 4.7, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 260, safetyFeatures: [...COMMON, 'adaptive_cruise', 'speed_sign', 'blind_spot', 'rear_cross_traffic'], highlights: ['Australia\'s best-selling SUV for a reason', 'Hybrid across the range', 'Big boot, sensible cabin'] },
  { slug: 'toyota-camry-hybrid', make: 'Toyota', model: 'Camry', variant: 'Ascent hybrid', year: 2025, bodyType: 'SEDAN', fuelType: 'HYBRID', priceFrom: 40000, fuelPer100: 4.0, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 260, safetyFeatures: COMMON_PLUS, highlights: ['Quiet, roomy, and frugal', 'Hybrid only from 2025', 'A favourite with rideshare drivers, which says something about durability'] },
  { slug: 'toyota-kluger-hybrid', make: 'Toyota', model: 'Kluger', variant: 'GX hybrid 2WD', year: 2025, bodyType: 'SUV', fuelType: 'HYBRID', seats: 7, priceFrom: 60000, ancapStars: 5, ancapYear: 2021, fuelPer100: 5.6, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 300, safetyFeatures: COMMON_PLUS, highlights: ['Seven seats with a hybrid', 'Curtain airbags to the third row', 'Tows 2,000 kg'] },
  { slug: 'toyota-hilux', make: 'Toyota', model: 'HiLux', variant: 'SR 4x4 dual cab', year: 2025, bodyType: 'UTE', fuelType: 'DIESEL', priceFrom: 48000, ancapStars: 5, ancapYear: 2019, fuelPer100: 7.9, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 6, serviceIntervalKm: 10000, servicingCostYear: 600, safetyFeatures: [...COMMON, 'adaptive_cruise', 'speed_sign'], highlights: ['Six-month service intervals: budget for two a year', 'Resale is the strongest of any ute', 'A work truck first'] },
  { slug: 'toyota-prado', make: 'Toyota', model: 'LandCruiser Prado', variant: 'GX', year: 2025, bodyType: 'SUV', fuelType: 'DIESEL', seats: 5, priceFrom: 72500, ancapStars: 5, ancapYear: 2024, fuelPer100: 7.6, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 6, serviceIntervalKm: 10000, servicingCostYear: 800, safetyFeatures: COMMON_PLUS, highlights: ['Genuine off-road ability', 'Tows 3,500 kg', 'Mild-hybrid diesel'] },
  { slug: 'mazda-3', make: 'Mazda', model: 'Mazda3', variant: 'G20 Pure hatch', year: 2025, bodyType: 'HATCH', fuelType: 'PETROL', priceFrom: 30000, ancapStars: 5, ancapYear: 2019, fuelPer100: 5.8, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 450, safetyFeatures: COMMON_PLUS, highlights: ['The nicest cabin under $35,000', 'Quiet and composed', 'Smaller boot than the Corolla'] },
  { slug: 'mazda-cx-30', make: 'Mazda', model: 'CX-30', variant: 'G20 Pure', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 34000, ancapStars: 5, ancapYear: 2019, fuelPer100: 6.3, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 450, safetyFeatures: COMMON_PLUS, highlights: ['A Mazda3 with a higher seat', 'Blind spot monitoring standard', 'Tight rear seat for tall teenagers'] },
  { slug: 'mazda-cx-5', make: 'Mazda', model: 'CX-5', variant: 'Maxx 2WD', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 37000, ancapStars: 5, ancapYear: 2017, fuelPer100: 6.9, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 480, safetyFeatures: COMMON_PLUS, highlights: ['The family SUV that drives like a car', 'Well finished at every grade', 'No hybrid yet; fuel use is the trade-off'] },
  { slug: 'mazda-bt-50', make: 'Mazda', model: 'BT-50', variant: 'XT 4x4 dual cab', year: 2025, bodyType: 'UTE', fuelType: 'DIESEL', priceFrom: 45000, ancapStars: 5, ancapYear: 2022, fuelPer100: 8.0, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 500, safetyFeatures: COMMON_PLUS, highlights: ['Shares its bones with the Isuzu D-Max', 'Twelve-month services, unlike the HiLux', 'Tows 3,500 kg'] },
  { slug: 'hyundai-i30-hatch', make: 'Hyundai', model: 'i30', variant: 'hatch', year: 2025, bodyType: 'HATCH', fuelType: 'PETROL', priceFrom: 27000, ancapStars: 5, ancapYear: 2017, fuelPer100: 7.4, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 400, safetyFeatures: [...COMMON, 'adaptive_cruise', 'driver_attention'], highlights: ['A roomy small hatch', 'Sat-nav service updates included', 'The 2017 rating has lapsed; compare on features'] },
  { slug: 'hyundai-kona', make: 'Hyundai', model: 'Kona', variant: '2.0 petrol', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 33000, ancapStars: 4, ancapYear: 2023, fuelPer100: 6.6, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 400, safetyFeatures: COMMON_PLUS, highlights: ['Bigger than the old one, with a proper back seat', 'Hybrid and electric versions of the same car', 'Four stars in 2023: read the detailed scores'] },
  { slug: 'hyundai-tucson', make: 'Hyundai', model: 'Tucson', variant: '2.0 petrol 2WD', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 39000, ancapStars: 5, ancapYear: 2021, fuelPer100: 8.1, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 420, safetyFeatures: COMMON_PLUS, highlights: ['One of the biggest back seats in the class', 'Hybrid available from 2024', 'Base petrol is thirsty'] },
  { slug: 'hyundai-ioniq-5', make: 'Hyundai', model: 'IONIQ 5', variant: 'RWD', year: 2025, bodyType: 'SUV', fuelType: 'ELECTRIC', priceFrom: 70000, ancapStars: 5, ancapYear: 2021, kwhPer100: 17.9, rangeKm: 440, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 24, serviceIntervalKm: 30000, servicingCostYear: 300, safetyFeatures: COMMON_PLUS, highlights: ['Charges from ten to eighty percent in under twenty minutes on a fast charger', 'Flat floor, huge cabin', 'Eight-year battery warranty'] },
  { slug: 'kia-sportage', make: 'Kia', model: 'Sportage', variant: 'S 2.0 petrol 2WD', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 33000, ancapStars: 5, ancapYear: 2022, fuelPer100: 8.1, warrantyYears: 7, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 450, safetyFeatures: COMMON_PLUS, highlights: ['Seven-year warranty', 'Shares its platform with the Tucson', 'Hybrid from 2025'] },
  { slug: 'kia-carnival', make: 'Kia', model: 'Carnival', variant: 'S diesel', year: 2025, bodyType: 'PEOPLE_MOVER', fuelType: 'DIESEL', seats: 8, priceFrom: 51000, ancapStars: 5, ancapYear: 2021, fuelPer100: 6.5, warrantyYears: 7, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 550, safetyFeatures: COMMON_PLUS, highlights: ['Eight seats, and the third row is real', 'Sliding doors in a tight car park', 'Hybrid arrived in 2025'] },
  { slug: 'kia-ev5', make: 'Kia', model: 'EV5', variant: 'Air Standard Range', year: 2025, bodyType: 'SUV', fuelType: 'ELECTRIC', priceFrom: 57000, kwhPer100: 18.1, rangeKm: 400, warrantyYears: 7, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 300, safetyFeatures: COMMON_PLUS, highlights: ['A family-sized electric SUV for Sportage money', 'Seven-year warranty', 'Slower fast-charging than the EV6'] },
  { slug: 'kia-ev6', make: 'Kia', model: 'EV6', variant: 'Air RWD', year: 2025, bodyType: 'SUV', fuelType: 'ELECTRIC', priceFrom: 73000, ancapStars: 5, ancapYear: 2022, kwhPer100: 16.5, rangeKm: 528, warrantyYears: 7, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 300, safetyFeatures: COMMON_PLUS, highlights: ['Over 500 km of range', 'The fastest charging in its price band', 'Low roof; check the boot for a pram'] },
  { slug: 'mg-4', make: 'MG', model: 'MG4', variant: 'Excite 51', year: 2025, bodyType: 'HATCH', fuelType: 'ELECTRIC', priceFrom: 38000, ancapStars: 5, ancapYear: 2022, kwhPer100: 16.0, rangeKm: 350, warrantyYears: 10, warrantyKm: 250000, serviceIntervalMonths: 24, serviceIntervalKm: 40000, servicingCostYear: 300, safetyFeatures: COMMON_PLUS, highlights: ['The cheapest well-rated electric car', 'Ten-year warranty for private buyers', 'Rear-wheel drive, fun to drive'] },
  { slug: 'mg-zs-hybrid', make: 'MG', model: 'ZS Hybrid+', variant: 'Excite', year: 2025, bodyType: 'SUV', fuelType: 'HYBRID', priceFrom: 33000, fuelPer100: 4.7, warrantyYears: 10, warrantyKm: 250000, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 350, safetyFeatures: COMMON_PLUS, highlights: ['A hybrid small SUV under the Toyota price', 'Ten-year warranty', 'Newer than its rating: check ANCAP'] },
  { slug: 'tesla-model-3', make: 'Tesla', model: 'Model 3', variant: 'RWD', year: 2025, bodyType: 'SEDAN', fuelType: 'ELECTRIC', priceFrom: 55000, ancapStars: 5, ancapYear: 2019, kwhPer100: 13.2, rangeKm: 513, warrantyYears: 4, warrantyKm: 80000, serviceIntervalMonths: 24, serviceIntervalKm: 40000, servicingCostYear: 150, safetyFeatures: COMMON_PLUS, highlights: ['The most efficient car on this list', 'Supercharger network', 'Shortest new-car warranty here; the battery has its own eight years'] },
  { slug: 'tesla-model-y', make: 'Tesla', model: 'Model Y', variant: 'RWD', year: 2025, bodyType: 'SUV', fuelType: 'ELECTRIC', priceFrom: 59000, ancapStars: 5, ancapYear: 2022, kwhPer100: 15.6, rangeKm: 455, warrantyYears: 4, warrantyKm: 80000, serviceIntervalMonths: 24, serviceIntervalKm: 40000, servicingCostYear: 150, safetyFeatures: COMMON_PLUS, highlights: ['Australia\'s best-selling electric car', 'Cavernous boot and frunk', 'Insurance and repair costs run higher than average'] },
  { slug: 'byd-dolphin', make: 'BYD', model: 'Dolphin', variant: 'Essential', year: 2025, bodyType: 'HATCH', fuelType: 'ELECTRIC', priceFrom: 30000, ancapStars: 5, ancapYear: 2023, kwhPer100: 15.9, rangeKm: 340, warrantyYears: 6, warrantyKm: 150000, serviceIntervalMonths: 12, serviceIntervalKm: 20000, servicingCostYear: 350, safetyFeatures: COMMON_PLUS, highlights: ['The cheapest new electric car in Australia', 'Five stars in 2023', 'Modest range suits a city'] },
  { slug: 'byd-atto-3', make: 'BYD', model: 'Atto 3', variant: 'Essential', year: 2025, bodyType: 'SUV', fuelType: 'ELECTRIC', priceFrom: 40000, ancapStars: 5, ancapYear: 2022, kwhPer100: 16.0, rangeKm: 410, warrantyYears: 6, warrantyKm: 150000, serviceIntervalMonths: 12, serviceIntervalKm: 20000, servicingCostYear: 350, safetyFeatures: COMMON_PLUS, highlights: ['Vehicle-to-load: it can power a campsite', 'Roomy for the money', 'Lane-keeping can be intrusive; drive one first'] },
  { slug: 'byd-seal', make: 'BYD', model: 'Seal', variant: 'Dynamic', year: 2025, bodyType: 'SEDAN', fuelType: 'ELECTRIC', priceFrom: 46000, ancapStars: 5, ancapYear: 2023, kwhPer100: 15.0, rangeKm: 460, warrantyYears: 6, warrantyKm: 150000, serviceIntervalMonths: 12, serviceIntervalKm: 20000, servicingCostYear: 350, safetyFeatures: COMMON_PLUS, highlights: ['A Model 3 rival for less', 'Quiet and quick', 'Low roofline'] },
  { slug: 'byd-sealion-6', make: 'BYD', model: 'Sealion 6', variant: 'Dynamic', year: 2025, bodyType: 'SUV', fuelType: 'PLUG_IN_HYBRID', priceFrom: 43000, ancapStars: 5, ancapYear: 2024, fuelPer100: 1.1, rangeKm: 92, warrantyYears: 6, warrantyKm: 150000, serviceIntervalMonths: 12, serviceIntervalKm: 20000, servicingCostYear: 350, safetyFeatures: COMMON_PLUS, highlights: ['Around 90 km electric, then a petrol engine', 'The plug-in that made the segment mainstream here', 'Needs a plug at home to make sense'] },
  { slug: 'mitsubishi-outlander', make: 'Mitsubishi', model: 'Outlander', variant: 'ES 2WD', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', seats: 7, priceFrom: 39000, ancapStars: 5, ancapYear: 2022, fuelPer100: 7.5, warrantyYears: 10, warrantyKm: 200000, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 350, safetyFeatures: COMMON_PLUS, highlights: ['Seven seats (the last two are small) at a five-seat price', 'Ten-year warranty if serviced at Mitsubishi', 'Plug-in hybrid version available'] },
  { slug: 'mitsubishi-outlander-phev', make: 'Mitsubishi', model: 'Outlander PHEV', variant: 'ES', year: 2025, bodyType: 'SUV', fuelType: 'PLUG_IN_HYBRID', priceFrom: 57000, ancapStars: 5, ancapYear: 2022, fuelPer100: 1.5, rangeKm: 84, warrantyYears: 10, warrantyKm: 200000, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 350, safetyFeatures: COMMON_PLUS, highlights: ['Around 80 km electric, all-wheel drive', 'Can power the house in a blackout', 'Heavy; tyres wear faster'] },
  { slug: 'ford-ranger', make: 'Ford', model: 'Ranger', variant: 'XL 4x4 dual cab', year: 2025, bodyType: 'UTE', fuelType: 'DIESEL', priceFrom: 44000, ancapStars: 5, ancapYear: 2022, fuelPer100: 7.6, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 380, safetyFeatures: COMMON_PLUS, highlights: ['Australia\'s best-selling vehicle', 'Drives more like an SUV than any other ute', 'Plug-in hybrid version from 2025'] },
  { slug: 'isuzu-d-max', make: 'Isuzu', model: 'D-MAX', variant: 'SX 4x4 crew cab', year: 2025, bodyType: 'UTE', fuelType: 'DIESEL', priceFrom: 40000, ancapStars: 5, ancapYear: 2022, fuelPer100: 8.0, warrantyYears: 6, warrantyKm: 150000, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 450, safetyFeatures: COMMON_PLUS, highlights: ['A reputation for durability', 'Six-year warranty', 'Firm ride unladen'] },
  { slug: 'nissan-x-trail', make: 'Nissan', model: 'X-TRAIL', variant: 'ST 2WD', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 38000, ancapStars: 5, ancapYear: 2022, fuelPer100: 7.8, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 10000, servicingCostYear: 450, safetyFeatures: COMMON_PLUS, highlights: ['Optional third row', 'e-POWER hybrid on higher grades', 'Ten-thousand-kilometre service intervals: budget for it'] },
  { slug: 'nissan-qashqai', make: 'Nissan', model: 'QASHQAI', variant: 'ST', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 35000, ancapStars: 5, ancapYear: 2021, fuelPer100: 6.1, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 10000, servicingCostYear: 450, safetyFeatures: COMMON_PLUS, highlights: ['A small SUV with a good back seat', 'Centre airbag standard', 'Firm ride on the big wheels'] },
  { slug: 'volkswagen-golf', make: 'Volkswagen', model: 'Golf', variant: 'Life', year: 2025, bodyType: 'HATCH', fuelType: 'PETROL', priceFrom: 40000, ancapStars: 5, ancapYear: 2019, fuelPer100: 5.9, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 600, safetyFeatures: COMMON_PLUS, highlights: ['Refined and grown-up', 'Servicing costs more than the Japanese rivals', 'Prepaid service packs bring it down'] },
  { slug: 'volkswagen-tiguan', make: 'Volkswagen', model: 'Tiguan', variant: '110TSI Life', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 45000, ancapStars: 5, ancapYear: 2024, fuelPer100: 7.0, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 650, safetyFeatures: COMMON_PLUS, highlights: ['All-new in 2024 with a fresh five-star rating', 'Sliding rear seat', 'The dearest to service here'] },
  { slug: 'suzuki-swift-hybrid', make: 'Suzuki', model: 'Swift', variant: 'Hybrid', year: 2025, bodyType: 'HATCH', fuelType: 'HYBRID', priceFrom: 25000, ancapStars: 1, ancapYear: 2025, fuelPer100: 4.0, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 350, safetyFeatures: [...COMMON, 'adaptive_cruise'], highlights: ['Cheap to buy and to run', 'A mild hybrid, not a Toyota-style one', 'One star from ANCAP in 2025: read the report before you decide'] },
  { slug: 'gwm-haval-jolion', make: 'GWM', model: 'Haval Jolion', variant: 'Premium', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 27000, ancapStars: 5, ancapYear: 2021, fuelPer100: 8.1, warrantyYears: 7, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 350, safetyFeatures: COMMON_PLUS, highlights: ['A lot of car for the money', 'Seven-year warranty', 'Thirsty for its size; the hybrid fixes that'] },
  { slug: 'gwm-haval-h6', make: 'GWM', model: 'Haval H6', variant: 'Premium', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 34000, ancapStars: 5, ancapYear: 2021, fuelPer100: 7.4, warrantyYears: 7, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 350, safetyFeatures: COMMON_PLUS, highlights: ['Mid-size SUV space at small-SUV money', 'Hybrid and plug-in versions', 'Driver aids can nag; try before you buy'] },
  { slug: 'subaru-forester', make: 'Subaru', model: 'Forester', variant: '2.5i AWD', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 43000, fuelPer100: 7.4, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 500, safetyFeatures: COMMON_PLUS, highlights: ['All-wheel drive standard', 'Enormous windows; the best visibility in the class', 'All-new for 2025; check ANCAP for the current rating'] },
  { slug: 'subaru-outback', make: 'Subaru', model: 'Outback', variant: 'AWD', year: 2025, bodyType: 'WAGON', fuelType: 'PETROL', priceFrom: 44000, ancapStars: 5, ancapYear: 2021, fuelPer100: 7.3, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 500, safetyFeatures: COMMON_PLUS, highlights: ['A wagon that does most of what an SUV does', 'Driver monitoring camera standard', 'Comfortable on a long trip'] },
  { slug: 'volvo-ex30', make: 'Volvo', model: 'EX30', variant: 'Single Motor Extended Range', year: 2025, bodyType: 'SUV', fuelType: 'ELECTRIC', priceFrom: 60000, ancapStars: 5, ancapYear: 2024, kwhPer100: 17.0, rangeKm: 480, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 24, serviceIntervalKm: 30000, servicingCostYear: 300, safetyFeatures: COMMON_PLUS, highlights: ['The cheapest Volvo, and electric', 'Recycled materials done well', 'Almost everything is on the screen; try it first'] },
  { slug: 'volvo-xc40', make: 'Volvo', model: 'XC40', variant: 'B4 Plus', year: 2025, bodyType: 'SUV', fuelType: 'PETROL', priceFrom: 55000, ancapStars: 5, ancapYear: 2018, fuelPer100: 7.3, warrantyYears: 5, warrantyKm: null, serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 600, safetyFeatures: COMMON_PLUS, highlights: ['Volvo\'s safety reputation in a small package', 'Mild hybrid', 'The 2018 rating has lapsed'] },
];

/** ANCAP status for a catalogue row or a used car with a known rating year. */
export function ancapStatus(stars: number | null | undefined, year: number | null | undefined, now = new Date()): { status: 'current' | 'expired' | 'unrated'; label: string } {
  if (!stars || !year) return { status: 'unrated', label: 'Not rated by ANCAP' };
  if (now.getFullYear() - year >= ANCAP_VALID_YEARS) return { status: 'expired', label: `${stars} stars in ${year}, rating lapsed` };
  return { status: 'current', label: `${stars} stars, tested ${year}` };
}

export function bodyLabel(key: string): string { return BODY_TYPES.find((b) => b.key === key)?.label ?? key; }
export function fuelLabel(key: string): string { return FUEL_TYPES.find((f) => f.key === key)?.label ?? key; }
export function serviceKind(key: string): ServiceKind | undefined { return SERVICE_KINDS.find((s) => s.key === key); }
