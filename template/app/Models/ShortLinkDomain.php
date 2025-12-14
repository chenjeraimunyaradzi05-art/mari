<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @psalm-suppress MissingTemplateParam
 * @extends \Illuminate\Database\Eloquent\Model<\App\Models\ShortLinkDomain>
 * @method static \Database\Factories\ShortLinkDomainFactory factory($count = null, $state = [])
 * @property int $id
 * @property string $domain
 * @property string|null $dns_token
 * @property \Illuminate\Support\Carbon|null $verified_at
 * @property bool $active
 * @property-read \App\Models\Admin|null $creator
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortLinkDomain newModelQuery()
 * @method static \\Illuminate\Database\Eloquent\Builder<static>|ShortLinkDomain newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ShortLinkDomain query()
 * @mixin \Eloquent
 */
final class ShortLinkDomain extends Model
{
    use HasFactory;

    protected $fillable = [
        'domain',
        'dns_token',
        'verified_at',
        'created_by',
        'active',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
        'active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }
}

