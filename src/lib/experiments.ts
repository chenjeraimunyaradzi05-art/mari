import crypto from 'crypto';

export type ExperimentBucket = 'control' | 'heuristic';

const DEFAULT_BUCKET: ExperimentBucket = 'heuristic';

function hashToBucket(experiment: string, subject: string): ExperimentBucket {
  const hash = crypto.createHash('sha256').update(`${experiment}:${subject}`).digest('hex');
  const value = parseInt(hash.slice(0, 8), 16);
  return value % 2 === 0 ? 'control' : 'heuristic';
}

export function assignBucket(
  experiment: string,
  subjectId?: string,
  forced?: ExperimentBucket
): ExperimentBucket {
  if (forced) return forced;
  if (!subjectId) return DEFAULT_BUCKET;
  return hashToBucket(experiment, subjectId);
}

export function isTreatment(bucket: ExperimentBucket) {
  return bucket === 'heuristic';
}
