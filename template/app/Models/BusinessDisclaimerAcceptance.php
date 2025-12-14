<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string|null $session_id
 * @property string $banner
 * @property \Illuminate\Support\Carbon|null $dismissed_at
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance whereBanner($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance whereDismissedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance whereSessionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessDisclaimerAcceptance whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class BusinessDisclaimerAcceptance extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'session_id',
        'banner',
        'dismissed_at',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'dismissed_at' => 'datetime',
    ];
}
