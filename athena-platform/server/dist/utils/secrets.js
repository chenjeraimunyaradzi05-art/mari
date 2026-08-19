"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSecretsFromAWS = loadSecretsFromAWS;
exports.getSecret = getSecret;
exports.loadSecretsIfConfigured = loadSecretsIfConfigured;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const logger_1 = require("./logger");
let cachedSecrets = {};
async function loadSecretsFromAWS(secretName, region) {
    try {
        const client = new client_secrets_manager_1.SecretsManagerClient({ region: region || process.env.AWS_REGION || 'us-east-1' });
        const cmd = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: secretName });
        const resp = await client.send(cmd);
        if (!resp.SecretString)
            return {};
        const parsed = JSON.parse(resp.SecretString);
        // Flatten into cache
        cachedSecrets = { ...cachedSecrets, ...parsed };
        logger_1.logger.info('Loaded secrets from AWS Secrets Manager', { secretName });
        return parsed;
    }
    catch (err) {
        logger_1.logger.error('Failed to load secrets from AWS Secrets Manager', { err });
        throw err;
    }
}
function getSecret(name) {
    if (cachedSecrets && name in cachedSecrets)
        return cachedSecrets[name];
    return process.env[name];
}
async function loadSecretsIfConfigured() {
    if (process.env.USE_AWS_SECRETS === 'true' && process.env.AWS_SECRET_NAME) {
        try {
            await loadSecretsFromAWS(process.env.AWS_SECRET_NAME, process.env.AWS_REGION);
            // Optionally inject into process.env for existing code
            for (const [k, v] of Object.entries(cachedSecrets)) {
                if (!process.env[k])
                    process.env[k] = v;
            }
        }
        catch (err) {
            logger_1.logger.warn('Continuing without AWS secrets loaded');
        }
    }
}
//# sourceMappingURL=secrets.js.map