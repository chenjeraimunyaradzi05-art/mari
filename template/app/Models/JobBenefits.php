<?php

/**
 * JobBenefits Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $job_id
 * @property int $benefit_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Benefits|null $benefit
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBenefits newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBenefits newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBenefits query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBenefits whereBenefitId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBenefits whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBenefits whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBenefits whereJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBenefits whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class JobBenefits extends Model
{
    use HasFactory;

    public function benefit(): BelongsTo
    {
        return $this->belongsTo(Benefits::class, 'benefit_id', 'id');
    }
}
