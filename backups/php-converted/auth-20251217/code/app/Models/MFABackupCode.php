<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $code
 * @property \Illuminate\Support\Carbon|null $used_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFABackupCode newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFABackupCode newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFABackupCode query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFABackupCode whereCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFABackupCode whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFABackupCode whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFABackupCode whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFABackupCode whereUsedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MFABackupCode whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class MFABackupCode extends Model
{
    use HasFactory;

    protected $table = 'mfa_backup_codes';

    protected $fillable = [
        'user_id',
        'code',
        'used_at',
    ];

    protected $casts = [
        'used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
