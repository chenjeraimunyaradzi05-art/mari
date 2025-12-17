<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $admin_id
 * @property string $source
 * @property string|null $timezone
 * @property int|null $offset_minutes
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property \Illuminate\Support\Carbon|null $logged_in_at
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Admin $admin
 */
final class AdminLoginAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'admin_id',
        'source',
        'timezone',
        'offset_minutes',
        'ip_address',
        'user_agent',
        'logged_in_at',
        'meta',
    ];

    protected $casts = [
        'logged_in_at' => 'datetime',
        'meta' => 'array',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class);
    }
}
