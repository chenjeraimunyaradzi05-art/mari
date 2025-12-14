<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $key
 * @property string $name
 * @property string $surface
 * @property string $channel
 * @property string|null $placement
 * @property string $category
 * @property int $priority
 * @property int $max_creatives
 * @property bool $is_active
 * @property bool $review_required
 * @property string $brand_safety_status
 * @property array<array-key, mixed>|null $allowed_formats
 * @property array<array-key, mixed>|null $targeting_rules
 * @property array<array-key, mixed>|null $pacing_rules
 * @property array<array-key, mixed>|null $guardrails
 * @property string|null $review_notes
 * @property \Illuminate\Support\Carbon|null $last_reviewed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read string $brand_safety_label
 * @property-read string $channel_label
 * @property-read string $surface_label
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\AdvertisingSlotRevenueSnapshot> $snapshots
 * @property int|null snapshots_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereAllowedFormats($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereBrandSafetyStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereChannel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereGuardrails($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereLastReviewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereMaxCreatives($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot wherePacingRules($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot wherePlacement($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot wherePriority($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereReviewNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereReviewRequired($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereSurface($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereTargetingRules($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingSlot whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class AdvertisingSlot extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'allowed_formats' => 'array',
        'targeting_rules' => 'array',
        'pacing_rules' => 'array',
        'guardrails' => 'array',
        'is_active' => 'bool',
        'review_required' => 'bool',
        'priority' => 'int',
        'max_creatives' => 'int',
        'last_reviewed_at' => 'datetime',
    ];

    public const BRAND_SAFETY_PENDING = 'pending';

    public const BRAND_SAFETY_APPROVED = 'approved';

    public const BRAND_SAFETY_REJECTED = 'rejected';

    public const BRAND_SAFETY_STATUSES = [
        self::BRAND_SAFETY_PENDING,
        self::BRAND_SAFETY_APPROVED,
        self::BRAND_SAFETY_REJECTED,
    ];

    public function snapshots(): HasMany
    {
        return $this->hasMany(AdvertisingSlotRevenueSnapshot::class, 'slot_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)
            ->where(function ($scope) {
                $scope->where('brand_safety_status', self::BRAND_SAFETY_APPROVED)
                    ->orWhere('review_required', false);
            });
    }

    public function allowsFormat(string $format): bool
    {
        $formats = $this->allowed_formats;

        if (empty($formats)) {
            return true;
        }

        return in_array($format, $formats, true);
    }

    public function preferredIntents(): array
    {
        return $this->normaliseArray(data_get($this->targeting_rules, 'intents', []));
    }

    public function preferredRoles(): array
    {
        return $this->normaliseArray(data_get($this->targeting_rules, 'roles', []));
    }

    public function preferredRegions(): array
    {
        return $this->normaliseArray(data_get($this->targeting_rules, 'regions', []));
    }

    public function guardrail(string $key, ?array $default = null)
    {
        return data_get($this->guardrails, $key, $default);
    }

    public function getBrandSafetyLabelAttribute(): string
    {
        return match ($this->brand_safety_status) {
            self::BRAND_SAFETY_APPROVED => 'Approved',
            self::BRAND_SAFETY_REJECTED => 'Rejected',
            default => 'Pending review',
        };
    }

    public function getChannelLabelAttribute(): string
    {
        return ucfirst(str_replace('_', ' ', (string) $this->channel));
    }

    public function getSurfaceLabelAttribute(): string
    {
        return ucfirst(str_replace(['_', '-'], ' ', (string) $this->surface));
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function normaliseArray($value): array
    {
        $value = is_array($value) ? $value : [$value];

        return collect($value)
            ->filter()
            ->map(fn ($item) => strtolower((string) $item))
            ->unique()
            ->values()
            ->all();
    }
}
