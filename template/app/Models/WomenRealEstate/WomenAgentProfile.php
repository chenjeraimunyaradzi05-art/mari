<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenPersonaProfile;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $license_number
 * @property string|null $license_region
 * @property \Illuminate\Support\Carbon|null $license_expires_at
 * @property array<array-key, mixed>|null $accomplishments
 * @property array<array-key, mixed>|null $testimonials
 * @property array<array-key, mixed>|null $service_languages
 * @property array<array-key, mixed>|null $availability_slots
 * @property array<array-key, mixed>|null $ai_meta
 * @property array<array-key, mixed>|null $visibility_preferences
 * @property bool $is_public
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read WomenPersonaProfile|null $personaProfile
 * @property-read User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereAccomplishments($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereAiMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereAvailabilitySlots($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereIsPublic($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereLicenseExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereLicenseNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereLicenseRegion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereServiceLanguages($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereTestimonials($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentProfile whereVisibilityPreferences($value)
 * @mixin \Eloquent
 */
final class WomenAgentProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'license_number',
        'license_region',
        'license_expires_at',
        'accomplishments',
        'testimonials',
        'service_languages',
        'availability_slots',
        'ai_meta',
        'visibility_preferences',
        'is_public',
    ];

    protected $casts = [
        'license_expires_at' => 'date',
        'accomplishments' => 'array',
        'testimonials' => 'array',
        'service_languages' => 'array',
        'availability_slots' => 'array',
        'ai_meta' => 'array',
        'visibility_preferences' => 'array',
        'is_public' => 'bool',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function personaProfile(): HasOne
    {
        return $this->hasOne(WomenPersonaProfile::class, 'user_id', 'user_id')
            ->where('persona', WomenPersonaProfile::PERSONA_AGENT);
    }
}

