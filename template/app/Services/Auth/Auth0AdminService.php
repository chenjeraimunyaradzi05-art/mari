<?php

namespace App\Services\Auth;

use App\Auth\Auth0UserProvider;
use App\Models\Admin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

final class Auth0AdminService
{


    public function startLogin(Request $request, array $overrides = []): RedirectResponse
    {
        $authorizeUrl = $this->buildAuthorizeUrl($request, $overrides);

        return redirect()->away($authorizeUrl);
    }

    public function handleCallback(Request $request): Admin
    {
        $code = (string) $request->input('code');
        $state = (string) $request->input('state');

        $expectedState = (string) $request->session()->pull('auth0.state');
        if ($expectedState === '' || $state !== $expectedState) {
            throw new RuntimeException('Auth0 state mismatch. Please retry login.');
        }

        $tokenResponse = $this->exchangeCode($code);
        $idToken = Arr::get($tokenResponse, 'id_token');
        if (!$idToken) {
            throw new RuntimeException('Auth0 id_token missing from callback.');
        }

        $claims = $this->tokenVerifier->verify($idToken);
        $profile = $this->buildProfilePayload($tokenResponse, $claims);

        $admin = $this->userProvider->syncFromAuth0Profile($profile);

        if (!$admin) {
            throw new RuntimeException('Unable to locate admin account for Auth0 subject.');
        }

        $sessionPayload = $this->buildSessionPayload($tokenResponse, $claims);
        $request->session()->put('auth0', $sessionPayload);

        $admin->markAuth0Login($profile, [
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'mfa_verified' => in_array('mfa', $sessionPayload['amr'], true),
        ]);

        return $admin;
    }

    public function startMfaChallenge(Request $request): RedirectResponse
    {
        return $this->startLogin($request, [
            'prompt' => 'login',
            'acr_values' => 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
            'max_age' => 0,
        ]);
    }

    public function logout(Request $request): string
    {
        $request->session()->forget('auth0');

        $domain = rtrim((string) config('auth0.domain'), '/');
        if ($domain === '') {
            throw new RuntimeException('AUTH0_DOMAIN is not configured.');
        }

        $params = array_filter([
            'client_id' => config('auth0.client_id'),
            'returnTo' => config('auth0.logout_redirect'),
        ]);

        return sprintf('https://%s/v2/logout?%s', $domain, http_build_query($params));
    }

    protected function buildAuthorizeUrl(Request $request, array $overrides = []): string
    {
        $state = Str::random(40);
        $request->session()->put('auth0.state', $state);

        $domain = rtrim((string) config('auth0.domain'), '/');
        $clientId = config('auth0.client_id');
        $redirect = config('auth0.redirect_uri');

        if ($domain === '' || !$clientId || !$redirect) {
            throw new RuntimeException('Auth0 configuration is incomplete.');
        }

        $params = array_filter([
            'response_type' => 'code',
            'client_id' => $clientId,
            'redirect_uri' => $redirect,
            'scope' => config('auth0.scope', 'openid profile email'),
            'audience' => config('auth0.audience'),
            'organization' => config('auth0.organization'),
            'state' => $state,
            'prompt' => 'login',
        ]);

        if (!empty($overrides)) {
            $params = array_merge($params, array_filter($overrides, fn ($value) => $value !== null && $value !== ''));
        }

        return sprintf('https://%s/authorize?%s', $domain, http_build_query($params));
    }

    protected function exchangeCode(string $code): array
    {
        if ($code === '') {
            throw new RuntimeException('Auth0 authorization code missing.');
        }

        $domain = rtrim((string) config('auth0.domain'), '/');
        $clientId = config('auth0.client_id');
        $clientSecret = config('auth0.client_secret');
        $redirect = config('auth0.redirect_uri');

        $response = Http::asForm()
            ->timeout(10)
            ->post(sprintf('https://%s/oauth/token', $domain), [
                'grant_type' => 'authorization_code',
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'redirect_uri' => $redirect,
                'code' => $code,
            ]);

        if (!$response->successful()) {
            throw new RuntimeException('Auth0 token exchange failed: '.$response->body());
        }

        return $response->json();
    }

    /**
     * @psalm-return array{email: mixed, name: mixed,...}
     */
    protected function buildProfilePayload(array $tokenResponse, array $claims): array
    {
        $profile = $claims;
        $profile['email'] = $claims['email'] ?? Arr::get($tokenResponse, 'user.email');
        $profile['name'] = $claims['name'] ?? Arr::get($tokenResponse, 'user.name');

        return $profile;
    }

    /**
     * @return (float|int|mixed|null|string|string[])[]
     *
     * @psalm-return array{sub: mixed|null, amr: array<never, never>|mixed, auth_time: mixed|null, scope: non-empty-list<string>, id_token: mixed, access_token: mixed, refresh_token: mixed, expires_at: float|int|string, validated_at: float|int|string}
     */
    protected function buildSessionPayload(array $tokenResponse, array $claims): array
    {
        $expiresIn = (int) Arr::get($tokenResponse, 'expires_in', config('auth0.session.lifetime', 3600));

        return [
            'sub' => $claims['sub'] ?? null,
            'amr' => $claims['amr'] ?? [],
            'auth_time' => $claims['auth_time'] ?? null,
            'scope' => explode(' ', (string) Arr::get($tokenResponse, 'scope', config('auth0.scope', 'openid profile email'))),
            'id_token' => Arr::get($tokenResponse, 'id_token'),
            'access_token' => Arr::get($tokenResponse, 'access_token'),
            'refresh_token' => Arr::get($tokenResponse, 'refresh_token'),
            'expires_at' => now()->addSeconds($expiresIn)->timestamp,
            'validated_at' => now()->timestamp,
        ];
    }
}

