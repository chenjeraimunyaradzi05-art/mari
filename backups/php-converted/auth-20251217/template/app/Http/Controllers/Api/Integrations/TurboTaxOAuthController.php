<?php

namespace App\Http\Controllers\Api\Integrations;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class TurboTaxOAuthController extends Controller
{
    /**
     * Start an OAuth flow (POC) — returns a redirect URL and a state token.
     * In production this would perform a proper redirect to Intuit's auth URL.
     */
    public function start(Request $request)
    {
        $state = Str::uuid()->toString();

        // Store the state for a short time so callback can validate it (POC only)
        Cache::put('turbotax:oauth_state:' . $state, true, now()->addMinutes(10));

        $authorizeBase = env('INTUIT_OAUTH_AUTHORIZE_URL', 'https://sandbox.intuit.com/app/connect/oauth2');

        $clientId = env('INTUIT_CLIENT_ID', 'MOCK_CLIENT');
        $redirectUri = config('app.url') . '/api/v1/turbotax/oauth/callback';

        $redirectUrl = $authorizeBase . '?client_id=' . urlencode($clientId)
            . '&response_type=code&scope=tax%20openid%20profile&redirect_uri=' . urlencode($redirectUri)
            . '&state=' . urlencode($state);

        return response()->json([
            'ok' => true,
            'redirect' => $redirectUrl,
            'state' => $state,
        ]);
    }

    /**
     * OAuth callback (POC) — Intuit would call back to this endpoint with code+state.
     * For this POC we accept code and state, validate state and then create a mock token.
     */
    public function callback(Request $request)
    {
        $code = $request->query('code');
        $state = $request->query('state');

        if (empty($code) || empty($state)) {
            return response()->json(['ok' => false, 'message' => 'missing code or state'], 400);
        }

        $cacheKey = 'turbotax:oauth_state:' . $state;

        if (!Cache::pull($cacheKey)) {
            return response()->json(['ok' => false, 'message' => 'invalid or expired state'], 400);
        }

        // POC token creation — in production do OAuth token exchange with client credentials
        $token = 'poc_mock_token_' . Str::random(24);

        // For demo purposes, we store token keyed by state (or user) in cache
        Cache::put('turbotax:tokens:' . $state, [
            'access_token' => $token,
            'scope' => 'tax openid profile',
            'expires_in' => 3600,
        ], now()->addHours(1));

        return response()->json(['ok' => true, 'token' => $token, 'state' => $state]);
    }
}
