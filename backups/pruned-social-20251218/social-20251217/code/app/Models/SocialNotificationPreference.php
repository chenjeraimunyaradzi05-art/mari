<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Arr;

/**
 * @property int $id
 * @property int $user_id
 * @property array<array-key, mixed>|null $settings
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialNotificationPreference newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialNotificationPreference newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialNotificationPreference query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialNotificationPreference whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialNotificationPreference whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialNotificationPreference whereSettings($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialNotificationPreference whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialNotificationPreference whereUserId($value)
 * @mixin \Eloquent
 */
final class SocialNotificationPreference extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'settings',
    ];

    protected $casts = [
        'settings' => 'array',
    ];

    public static function defaults(): array
    {
        return config('social.notifications.defaults', [
            'posts' => ['in_app' => true, 'email' => false],
            'comments' => ['in_app' => true, 'email' => false],
            'reactions' => ['in_app' => true, 'email' => false],
            'follows' => ['in_app' => true, 'email' => false],
            'messages' => ['in_app' => true, 'email' => true],
            'invites' => ['in_app' => true, 'email' => true],
        ]);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function mergeSettings(array $settings): array
    {
        $defaults = self::defaults();
        $merged = $defaults;

        foreach ($settings as $category => $channels) {
            $normalizedCategory = is_string($category) ? strtolower($category) : null;
            if (! $normalizedCategory || ! array_key_exists($normalizedCategory, $defaults)) {
                continue;
            }

            foreach ($channels as $channel => $enabled) {
                if (! array_key_exists($channel, $defaults[$normalizedCategory])) {
                    continue;
                }

                $merged[$normalizedCategory][$channel] = (bool) $enabled;
            }
        }

        return $merged;
    }

    public function apply(array $settings): void
    {
        $this->settings = $this->mergeSettings($settings);
        $this->save();
    }

    public function channelEnabled(string $category, string $channel): bool
    {
        $category = strtolower($category);
        return (bool) Arr::get($this->settings, sprintf('%s.%s', $category, $channel), Arr::get(self::defaults(), sprintf('%s.%s', $category, $channel), true));
    }
}

