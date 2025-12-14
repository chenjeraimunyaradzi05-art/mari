<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $method_type
 * @property string|null $method_identifier
 * @property string|null $encrypted_secret
 * @property bool $is_primary
 * @property bool $is_verified
 * @property \Illuminate\Support\Carbon|null $verified_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereEncryptedSecret($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereIsPrimary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereIsVerified($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereMethodIdentifier($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereMethodType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFAMethod whereVerifiedAt($value)
 *
 * @mixin \Eloquent
 */
final class MFAMethod extends Model
{
    use HasFactory;

    protected $table = 'mfa_methods';

    protected $fillable = [
        'user_id',
        'method_type',
        'method_identifier',
        'encrypted_secret',
        'is_primary',
        'is_verified',
        'verified_at',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'is_verified' => 'boolean',
        'verified_at' => 'datetime',
        'encrypted_secret' => 'encrypted',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
