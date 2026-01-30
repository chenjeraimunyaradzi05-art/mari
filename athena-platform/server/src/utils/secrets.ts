import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from './logger';

let cachedSecrets: Record<string, string> = {};

export async function loadSecretsFromAWS(secretName: string, region?: string) {
  try {
    const client = new SecretsManagerClient({ region: region || process.env.AWS_REGION || 'us-east-1' });
    const cmd = new GetSecretValueCommand({ SecretId: secretName });
    const resp = await client.send(cmd);
    if (!resp.SecretString) return {};

    const parsed = JSON.parse(resp.SecretString);
    // Flatten into cache
    cachedSecrets = { ...cachedSecrets, ...parsed };
    logger.info('Loaded secrets from AWS Secrets Manager', { secretName });
    return parsed as Record<string, string>;
  } catch (err) {
    logger.error('Failed to load secrets from AWS Secrets Manager', { err });
    throw err;
  }
}

export function getSecret(name: string): string | undefined {
  if (cachedSecrets && name in cachedSecrets) return cachedSecrets[name];
  return process.env[name];
}

export async function loadSecretsIfConfigured() {
  if (process.env.USE_AWS_SECRETS === 'true' && process.env.AWS_SECRET_NAME) {
    try {
      await loadSecretsFromAWS(process.env.AWS_SECRET_NAME, process.env.AWS_REGION);
      // Optionally inject into process.env for existing code
      for (const [k, v] of Object.entries(cachedSecrets)) {
        if (!process.env[k]) process.env[k] = v;
      }
    } catch (err) {
      logger.warn('Continuing without AWS secrets loaded');
    }
  }
}
