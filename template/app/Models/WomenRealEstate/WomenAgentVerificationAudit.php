<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Casts\EncryptedJson;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $agent_id
 * @property int|null $reviewer_id
 * @property string|null $status_before
 * @property string $status_after
 * @property mixed|null $notes
 * @property mixed|null $ai_summary
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenVerifiedAgent $agent
 * @property-read User|null $reviewer
 * @method static \Database\Factories\WomenRealEstate\WomenAgentVerificationAuditFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit whereAgentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit whereAiSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit whereReviewerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit whereStatusAfter($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit whereStatusBefore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentVerificationAudit whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenAgentVerificationAudit extends Model
{
    use HasFactory;

    protected $table = 'women_agent_verification_audits';

    protected $fillable = [
        'agent_id',
        'reviewer_id',
        'status_before',
        'status_after',
        'notes',
        'ai_summary',
    ];

    protected $casts = [
        'notes' => EncryptedJson::class,
        'ai_summary' => EncryptedJson::class,
    ];

    public function agent(): BelongsTo
    {
        return $this->belongsTo(WomenVerifiedAgent::class, 'agent_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}

