
export type CreativeStats = {
  id: string;
  impressions: bigint;
  clicks: bigint;
};

/**
 * Selects the best creative using an Epsilon-Greedy strategy.
 * - 10% Exploration: Random creative
 * - 90% Exploitation: Best performing creative (CTR)
 * - New creatives (< 100 impressions) are prioritized for exploration.
 */
export function selectCreative<T extends CreativeStats>(creatives: T[]): T | null {
  if (!creatives || creatives.length === 0) return null;
  if (creatives.length === 1) return creatives[0];

  // 1. Identify "New" creatives (Cold Start)
  const newCreatives = creatives.filter(c => c.impressions < 100n);
  
  // If we have new creatives, prioritize them to gather data
  if (newCreatives.length > 0) {
    const randomIndex = Math.floor(Math.random() * newCreatives.length);
    return newCreatives[randomIndex];
  }

  // 2. Epsilon-Greedy Strategy
  const EPSILON = 0.1; // 10% chance to explore
  const shouldExplore = Math.random() < EPSILON;

  if (shouldExplore) {
    const randomIndex = Math.floor(Math.random() * creatives.length);
    return creatives[randomIndex];
  } else {
    // Exploitation: Find highest CTR
    let bestCreative = creatives[0];
    let bestCtr = -1;

    for (const creative of creatives) {
      const impressions = Number(creative.impressions);
      const clicks = Number(creative.clicks);
      
      const ctr = impressions > 0 ? clicks / impressions : 0;
      
      if (ctr > bestCtr) {
        bestCtr = ctr;
        bestCreative = creative;
      }
    }

    return bestCreative;
  }
}
