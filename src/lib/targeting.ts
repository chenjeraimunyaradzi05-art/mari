
export type TargetingCriteria = {
  locations?: string[]; // e.g., ["Sydney", "Melbourne"]
  interests?: string[]; // e.g., ["Technology", "Finance"]
  ageRange?: { min: number; max: number };
  gender?: string[]; // e.g., ["FEMALE", "MALE"]
  includedAudiences?: string[];
  excludedAudiences?: string[];
};

export type UserProfile = {
  location?: string;
  interests?: string[];
  age?: number;
  gender?: string;
  audienceIds?: string[];
};

export function calculateRelevanceScore(targeting: TargetingCriteria | null, user: UserProfile): number {
  if (!targeting) return 1.0; // No targeting = broad appeal

  let score = 1.0;

  // Audience Targeting (Hard Constraints)
  if (targeting.excludedAudiences && targeting.excludedAudiences.length > 0) {
    if (user.audienceIds && user.audienceIds.some(id => targeting.excludedAudiences?.includes(id))) {
      return 0; // User is in an excluded audience
    }
  }

  if (targeting.includedAudiences && targeting.includedAudiences.length > 0) {
    if (!user.audienceIds || !user.audienceIds.some(id => targeting.includedAudiences?.includes(id))) {
      return 0; // User is NOT in any required audience
    }
    score *= 2.0; // Boost for audience match
  }

  // Location Matching
  if (targeting.locations && targeting.locations.length > 0) {
    if (user.location && targeting.locations.includes(user.location)) {
      score *= 1.5; // Boost for location match
    } else {
      score *= 0.1; // Penalty for location mismatch
    }
  }

  // Interest Matching
  if (targeting.interests && targeting.interests.length > 0) {
    if (user.interests) {
      const matches = targeting.interests.filter(i => user.interests?.includes(i));
      if (matches.length > 0) {
        score *= (1 + (matches.length * 0.2)); // Boost per interest match
      } else {
        score *= 0.5; // Penalty for no interest match
      }
    }
  }

  // Demographics
  if (targeting.gender && targeting.gender.length > 0) {
    if (user.gender && !targeting.gender.includes(user.gender)) {
      return 0; // Hard exclusion
    }
  }

  return score;
}
