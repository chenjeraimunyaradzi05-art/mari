<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $contact_hash
 * @property string|null $full_name
 * @property string|null $given_name
 * @property string|null $family_name
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $normalized_email
 * @property string|null $normalized_phone
 * @property string $source
 * @property array<array-key, mixed>|null $tags
 * @property array<array-key, mixed>|null $context
 * @property int $relationship_strength
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $last_interacted_at
 * @property \Illuminate\Support\Carbon|null $last_invited_at
 * @property \Illuminate\Support\Carbon|null $consent_granted_at
 * @property string|null $consent_method
 * @property string|null $consent_scope
 * @property string|null $consent_reference
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Invite> $invites
 * @property int|null invites_count
 * @property-read \App\Models\User $user
 * @method static \Database\Factories\SocialGraphContactFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereConsentGrantedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereConsentMethod($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereConsentReference($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereConsentScope($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereContactHash($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereFamilyName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereFullName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereGivenName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereLastInteractedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereLastInvitedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereNormalizedEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereNormalizedPhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact wherePhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereRelationshipStrength($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialGraphContact whereUserId($value)
 * @mixin \Eloquent
 */
final class SocialGraphContact extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'contact_hash',
        'full_name',
        'given_name',
        'family_name',
        'email',
        'phone',
        'normalized_email',
        'normalized_phone',
        'source',
        'tags',
        'context',
        'relationship_strength',
        'metadata',
        'last_interacted_at',
        'last_invited_at',
        'consent_granted_at',
        'consent_method',
        'consent_scope',
        'consent_reference',
    ];

    protected $casts = [
        'tags' => 'array',
        'context' => 'array',
        'metadata' => 'array',
        'relationship_strength' => 'integer',
        'last_interacted_at' => 'datetime',
        'last_invited_at' => 'datetime',
        'consent_granted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invites(): HasMany
    {
        return $this->hasMany(Invite::class, 'graph_contact_id');
    }

    public function hasReachableChannel(): bool
    {
        return filled($this->email) || filled($this->phone);
    }

    public function displayName(): string|null
    {
        return $this->full_name
            ?: implode(' ', array_filter([$this->given_name, $this->family_name]))
                ?: null;
    }
}

