<?php

$autoEnabled = (bool) (env('AUTH0_DOMAIN') && env('AUTH0_CLIENT_ID') && env('AUTH0_REDIRECT_URI'));
$override = env('AUTH0_ENABLED');

if (is_string($override)) {
    $normalized = strtolower($override);
    if (in_array($normalized, ['1', 'true', 'on', 'yes'], true)) {
        $enabled = true;
    } elseif (in_array($normalized, ['0', 'false', 'off', 'no'], true)) {
        $enabled = false;
    } else {
        $enabled = $autoEnabled;
    }
} elseif (is_bool($override)) {
    $enabled = $override;
} elseif ($override === null) {
    $enabled = $autoEnabled;
} else {
    $enabled = (bool) $override;
}

return [
    'domain' => env('AUTH0_DOMAIN'),
    'client_id' => env('AUTH0_CLIENT_ID'),
    'client_secret' => env('AUTH0_CLIENT_SECRET'),
    'audience' => env('AUTH0_AUDIENCE'),
    'organization' => env('AUTH0_ORGANIZATION'),
    'management_token' => env('AUTH0_MANAGEMENT_TOKEN'),
    'redirect_uri' => env('AUTH0_REDIRECT_URI', rtrim(env('APP_URL', ''), '/').'/admin/auth0/callback'),
    'logout_redirect' => env('AUTH0_LOGOUT_REDIRECT', rtrim(env('APP_URL', ''), '/').'/admin/mutiro/login'),
    'cookie_secret' => env('AUTH0_COOKIE_SECRET'),
    'scope' => env('AUTH0_SCOPE', 'openid profile email offline_access'),
    'session' => [
        'lifetime' => (int) env('AUTH0_SESSION_LIFETIME', 3600),
        'token_leeway' => (int) env('AUTH0_TOKEN_LEEWAY', 60),
        'jwks_ttl' => (int) env('AUTH0_JWKS_CACHE_TTL', 900),
    ],
    'required_scopes' => array_filter(array_map('trim', explode(' ', env('AUTH0_SCOPE', 'openid profile email')))),
    'mfa' => [
        'enforced' => env('AUTH0_MFA_ENFORCED', true),
        'allowed_grace_seconds' => (int) env('AUTH0_MFA_GRACE_SECONDS', 120),
        'adaptive' => [
            'session_risk' => env('AUTH0_MFA_ADAPTIVE_SESSION_RISK', true),
        ],
        'routes' => [
            'admin.moderation.*',
            'admin.analytics',
            'admin.analytics.*',
        ],
    ],
    'enabled' => $enabled,
    'auto_enabled' => $autoEnabled,
];
