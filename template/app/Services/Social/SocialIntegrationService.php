<?php

namespace App\Services\Social;

use App\Models\SocialIntegration;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Http;

final class SocialIntegrationService
{
    public function availableProviders(): array
    {
        return config('social.integrations.providers', []);
    }

    public function providerConfig(?string $provider = null): array
    {
        $providers = $this->availableProviders();

        if ($provider === null) {
            return $providers;
        }

        return $providers[$provider] ?? [];
    }

    /**
     * @psalm-return Collection<array-key, array{provider: string, label: mixed|string, icon: mixed|null, requires_connection: bool, connected: bool, status: string, last_synced_at: string, last_imported_at: string}>
     */
    public function forUser(User $user): Collection
    {
        $providers = collect($this->availableProviders());
        $connections = SocialIntegration::query()
            ->where('user_id', $user->getKey())
            ->get()
            ->keyBy('provider');

        return $providers->map(function (array $config, string $key) use ($connections) {
            $integration = $connections->get($key);

            return [
                'provider' => $key,
                'label' => $config['label'] ?? Str::title($key),
                'icon' => $config['icon'] ?? null,
                'requires_connection' => (bool) ($config['requires_connection'] ?? false),
                'connected' => $integration?->status === 'connected',
                'status' => $integration->status ?? 'disconnected',
                'last_synced_at' => optional($integration?->last_synced_at)->toIso8601String(),
                'last_imported_at' => optional($integration?->last_imported_at)->toIso8601String(),
            ];
        });
    }

    public function connect(User $user, string $provider, array $payload = []): SocialIntegration
    {
        $config = $this->providerConfig($provider);

        if (empty($config)) {
            throw new InvalidArgumentException('Unsupported provider.');
        }

        $tokens = array_filter([
            'access_token' => $payload['access_token'] ?? null,
            'refresh_token' => $payload['refresh_token'] ?? null,
            'expires_at' => $payload['expires_at'] ?? null,
            'handle' => $payload['handle'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');

        $settings = array_filter([
            'auto_share' => (bool) ($payload['auto_share'] ?? false),
        ]);

        return SocialIntegration::updateOrCreate(
            [
                'user_id' => $user->getKey(),
                'provider' => $provider,
            ],
            [
                'status' => 'connected',
                'scopes' => $config['scopes'] ?? [],
                'tokens' => $tokens ?: null,
                'settings' => $settings ?: null,
                'connected_at' => now(),
                'last_error' => null,
            ]
        );
    }

    public function disconnect(User $user, string $provider): void
    {
        SocialIntegration::query()
            ->where('user_id', $user->getKey())
            ->where('provider', $provider)
            ->delete();
    }

    public function ensureConnection(User $user, string $provider): void
    {
        $config = $this->providerConfig($provider);

        if (! ($config['requires_connection'] ?? false)) {
            return;
        }

        $connected = SocialIntegration::query()
            ->where('user_id', $user->getKey())
            ->where('provider', $provider)
            ->where('status', 'connected')
            ->exists();

        if (! $connected) {
            throw ValidationException::withMessages([
                'provider' => __('Connect your :provider account before importing.', ['provider' => $config['label'] ?? Str::title($provider)]),
            ]);
        }
    }

    /**
     * Post content to a connected provider.
     *
     * @param User $user
     * @param string $provider
     * @param array $content ['text' => string, 'media' => array, 'url' => string]
     * @return array ['id' => string, 'url' => string]
     */
    public function postToProvider(User $user, string $provider, array $content): array
    {
        $integration = SocialIntegration::where('user_id', $user->id)
            ->where('provider', $provider)
            ->where('status', 'connected')
            ->first();

        if (!$integration) {
            throw new \Exception("User is not connected to {$provider}");
        }

        // In a real implementation, this would dispatch to provider-specific handlers
        // For now, we'll simulate the API call structure

        return match ($provider) {
            'facebook' => $this->postToFacebook($integration, $content),
            'twitter', 'x' => $this->postToTwitter($integration, $content),
            'instagram' => $this->postToInstagram($integration, $content),
            default => throw new \Exception("Posting to {$provider} is not supported yet."),
        };
    }

    /**
     * @return string[]
     *
     * @psalm-return array{id: string, url: string}
     */
    protected function postToFacebook(SocialIntegration $integration, array $content): array
    {
        // Mock implementation
        // $response = Http::withToken($integration->tokens['access_token'])
        //     ->post("https://graph.facebook.com/v18.0/me/feed", [
        //         'message' => $content['text'],
        //         'link' => $content['url'] ?? null,
        //     ]);

        return [
            'id' => 'fb_' . Str::random(16),
            'url' => 'https://facebook.com/post/' . Str::random(16),
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return array{id: string, url: string}
     */
    protected function postToTwitter(SocialIntegration $integration, array $content): array
    {
        // Mock implementation
        return [
            'id' => 'tw_' . Str::random(16),
            'url' => 'https://x.com/user/status/' . Str::random(16),
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return array{id: string, url: string}
     */
    protected function postToInstagram(SocialIntegration $integration, array $content): array
    {
        // Mock implementation
        return [
            'id' => 'ig_' . Str::random(16),
            'url' => 'https://instagram.com/p/' . Str::random(16),
        ];
    }
}

