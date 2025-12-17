export const ROLES = [
  'member',
  'company',
  'mentor',
  'tafe',
  'real_estate',
  'business_owner',
  'investor',
  'government',
  'non_profit',
] as const

export type Role = (typeof ROLES)[number]
