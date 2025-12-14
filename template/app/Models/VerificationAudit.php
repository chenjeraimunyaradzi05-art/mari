<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $verification_id
 * @property string $action
 * @property int|null $actor_id
 * @property array<array-key, mixed>|null $notes
 * @property array<array-key, mixed>|null $ai_summary
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Admin|null $actor
 * @property-read \App\Models\ProfileVerification $verification
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit whereActorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit whereAiSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builderfinal <static>|VerificationAudit whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationAudit whereVerificationId($value)
 * @mixin \Eloquent
 */
final class VerificationAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'verification_id',
        'action',
        'actor_id',
        'notes',
        'ai_summary',
    ];

    protected $casts = [
        'notes' => 'array',
        'ai_summary' => 'array',
    ];

    public function verification(): BelongsTo
    {
        return $this->belongsTo(ProfileVerification::class, 'verification_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'actor_id');
    }
}
