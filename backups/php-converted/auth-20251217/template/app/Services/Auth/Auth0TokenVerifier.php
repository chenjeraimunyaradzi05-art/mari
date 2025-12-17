<?php

namespace App\Services\Auth;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class Auth0TokenVerifier
{
    private CacheRepository $cache;

    public function __construct(CacheRepository $cache)
    {
        $this->cache = $cache;
    }


    public function verify(string $idToken): array
    {
        $segments = explode('.', $idToken);
        if (count($segments) < 2) {
            throw new RuntimeException('Invalid Auth0 token.');
        }

        $header = json_decode(base64_decode($segments[0]) ?: '{}', true);
        $kid = Arr::get($header, 'kid');
        Arr::get($header, 'alg', 'RS256');

        $key = $this->resolveKey($kid);
        $decoded = (array) JWT::decode($idToken, $key);

        $this->guardClaims($decoded);

        return $decoded;
    }

    protected function resolveKey(?string $kid): Key
    {
        $jwks = $this->jwks();
        $keySet = JWK::parseKeySet($jwks);

        if ($kid && isset($keySet[$kid])) {
            return $keySet[$kid];
        }

        $fallback = reset($keySet);

        if ($fallback instanceof Key) {
            return $fallback;
        }

        throw new RuntimeException('Auth0 signing key not found.');
    }

    protected function jwks(): array
    {
        $ttlSeconds = max(60, (int) config('auth0.session.jwks_ttl', 900));

        return $this->cache->remember('auth0:jwks', $ttlSeconds, function () {
            $domain = rtrim((string) config('auth0.domain'), '/');
            if ($domain === '') {
                throw new RuntimeException('AUTH0_DOMAIN is not configured.');
            }

            $url = sprintf('https://%s/.well-known/jwks.json', $domain);
            $response = Http::timeout(5)->get($url);

            if (!$response->successful()) {
                throw new RuntimeException('Unable to download Auth0 JWKS document.');
            }

            return $response->json();
        });
    }

    protected function guardClaims(array $claims): void
    {
        $issuer = sprintf('https://%s/', rtrim((string) config('auth0.domain'), '/'));
        $audience = config('auth0.audience') ?: config('auth0.client_id');

        if (($claims['iss'] ?? null) !== $issuer) {
            throw new RuntimeException('Auth0 issuer mismatch.');
        }

        $tokenAud = (array) ($claims['aud'] ?? []);
        if (!in_array($audience, $tokenAud, true) && Arr::get($claims, 'aud') !== $audience) {
            throw new RuntimeException('Auth0 audience mismatch.');
        }

        $now = Carbon::now()->timestamp;
        $leeway = (int) config('auth0.session.token_leeway', 60);

        if (isset($claims['nbf']) && ($claims['nbf'] - $leeway) > $now) {
            throw new RuntimeException('Auth0 token not yet valid.');
        }

        if (isset($claims['exp']) && ($claims['exp'] + $leeway) < $now) {
            throw new RuntimeException('Auth0 token expired.');
        }
    }

}

