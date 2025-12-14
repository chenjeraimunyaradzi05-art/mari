<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @psalm-suppress MissingTemplateParam
 * @extends \Illuminate\Database\Eloquent\Model<\App\Models\ShortLink>
 * @method static \Database\Factories\ShortLinkFactory factory($count = null, $state = [])
 * @property string $token
 * @property int|null $invite_id
 * @property int|null $short_link_domain_id
 * @property string|null $channel
 * @property int|null $clicks_count
 * @property \Illuminate\Support\Carbon|null $last_clicked_at
 * @property-read \App\Models\ShortLinkDomain|null $domain
 * @property-read \App\Models\Invite|null $invite
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortLink newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortLink newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortLink query()
 * @mixin \Eloquent
 */
final class ShortLink extends Model
{
    use HasFactory;

    protected $fillable = [
        'token',
        'short_link_domain_id',
        'invite_id',
        'channel',
        'clicks_count',
        'last_clicked_at',
        'expires_at',
    ];

    protected $casts = [
        'last_clicked_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function invite(): BelongsTo
    {
        return $this->belongsTo(Invite::class, 'invite_id');
    }

    public function domain(): BelongsTo
    {
        return $this->belongsTo(ShortLinkDomain::class, 'short_link_domain_id');
    }
}

