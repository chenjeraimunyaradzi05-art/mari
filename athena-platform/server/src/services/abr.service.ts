/**
 * Australian Business Register (ABR) lookups, and the checksums behind an
 * ABN and an ACN.
 *
 * The ABR publishes a JSON web service for ABN details and name search that
 * needs a registered GUID (free, from abr.business.gov.au). With ABR_GUID
 * set, an ABN is looked up live and a proposed business name is checked
 * against names already registered. Without it the platform still checks a
 * number's format and checksum, and says plainly that the live lookup is
 * off.
 *
 * ASIC has no public lookup API. An ACN is checked against its checksum
 * here and the person is pointed at ASIC Connect for the register itself.
 * The ABR record carries a company's ACN, so an ABN lookup covers most of
 * what a formation needs.
 */

import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

const ABR_BASE = 'https://abr.business.gov.au/json';
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const ACN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 1];
const TIMEOUT_MS = 8000;

export const ASIC_CONNECT_SEARCH_URL = 'https://connectonline.asic.gov.au/RegistrySearch/faces/landing/SearchRegisters.jspx';
export const ABR_LOOKUP_URL = 'https://abr.business.gov.au/';

export const digitsOnly = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

/** ABN: 11 digits; subtract 1 from the first, weight, and the sum divides by 89. */
export function isValidAbn(value: unknown): boolean {
  const abn = digitsOnly(value);
  if (abn.length !== 11 || abn[0] === '0') return false;
  const sum = ABN_WEIGHTS.reduce((total, weight, i) => total + weight * (Number(abn[i]) - (i === 0 ? 1 : 0)), 0);
  return sum % 89 === 0;
}

/** ACN: 9 digits; the ninth is a check digit over the first eight. */
export function isValidAcn(value: unknown): boolean {
  const acn = digitsOnly(value);
  if (acn.length !== 9) return false;
  const sum = ACN_WEIGHTS.reduce((total, weight, i) => total + weight * Number(acn[i]), 0);
  return (10 - (sum % 10)) % 10 === Number(acn[8]);
}

export const formatAbn = (abn: string) => digitsOnly(abn).replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4');
export const formatAcn = (acn: string) => digitsOnly(acn).replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');

export const isConfigured = () => Boolean(process.env.ABR_GUID);

export interface AbrEntity {
  abn: string;
  abnStatus: string;
  abnStatusFrom: string | null;
  acn: string | null;
  entityName: string;
  entityType: string;
  gstRegisteredFrom: string | null;
  businessNames: string[];
  state: string | null;
  postcode: string | null;
}

export interface AbrNameMatch {
  abn: string;
  name: string;
  nameType: string;
  abnStatus: string;
  state: string | null;
  postcode: string | null;
  score: number;
}

// The ABR service answers JSONP; the callback wrapper is stripped here.
async function callAbr(endpoint: string, params: Record<string, string>): Promise<any> {
  const guid = process.env.ABR_GUID;
  if (!guid) throw new ApiError(503, 'ABR lookup is not configured on this server');
  const url = new URL(`${ABR_BASE}/${endpoint}`);
  Object.entries({ ...params, callback: 'cb', guid }).forEach(([key, value]) => url.searchParams.set(key, value));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal, headers: { Accept: 'application/json, text/javascript' } });
    if (!response.ok) throw new ApiError(502, `The ABR answered with status ${response.status}`);
    const text = await response.text();
    const wrapped = text.match(/^\s*cb\(([\s\S]*)\)\s*;?\s*$/);
    return JSON.parse(wrapped ? wrapped[1] : text);
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    logger.warn('ABR lookup failed', { endpoint, error: error?.message });
    throw new ApiError(502, error?.name === 'AbortError' ? 'The ABR did not answer in time' : 'The ABR lookup failed');
  } finally {
    clearTimeout(timer);
  }
}

const dateOrNull = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && !text.startsWith('0001-01-01') ? text : null;
};

export async function lookupAbn(value: unknown): Promise<AbrEntity | null> {
  const abn = digitsOnly(value);
  if (!isValidAbn(abn)) throw new ApiError(400, 'That is not a valid ABN');
  const raw = await callAbr('AbnDetails.aspx', { abn });
  if (!raw || !raw.Abn) return null;
  return {
    abn: String(raw.Abn),
    abnStatus: raw.AbnStatus || 'Unknown',
    abnStatusFrom: dateOrNull(raw.AbnStatusEffectiveFrom),
    acn: raw.Acn ? String(raw.Acn) : null,
    entityName: raw.EntityName || '',
    entityType: raw.EntityTypeName || raw.EntityTypeCode || '',
    gstRegisteredFrom: dateOrNull(raw.Gst),
    businessNames: Array.isArray(raw.BusinessName) ? raw.BusinessName.filter(Boolean).map(String) : [],
    state: raw.AddressState || null,
    postcode: raw.AddressPostcode ? String(raw.AddressPostcode) : null,
  };
}

export async function searchNames(name: string, maxResults = 10): Promise<AbrNameMatch[]> {
  const query = String(name || '').trim();
  if (query.length < 2) throw new ApiError(400, 'Give at least two characters of the name');
  const raw = await callAbr('MatchingNames.aspx', { name: query.slice(0, 200), maxResults: String(Math.min(Math.max(maxResults, 1), 20)) });
  const names = Array.isArray(raw?.Names) ? raw.Names : [];
  return names.map((n: any) => ({
    abn: String(n.Abn || ''),
    name: n.Name || '',
    nameType: n.NameType || '',
    abnStatus: n.AbnStatus || '',
    state: n.State || null,
    postcode: n.Postcode ? String(n.Postcode) : null,
    score: Number(n.Score) || 0,
  }));
}
