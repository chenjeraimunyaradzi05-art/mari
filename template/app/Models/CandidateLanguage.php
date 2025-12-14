<?php

/**
 * CandidateLanguage Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $candidate_id
 * @property int $language_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Language|null $language
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLanguage newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLanguage newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLanguage query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLanguage whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLanguage whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLanguage whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLanguage whereLanguageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CandidateLanguage whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CandidateLanguage extends Model
{
    use HasFactory;

    public function language(): BelongsTo
    {
        return $this->belongsTo(Language::class, 'language_id', 'id');
    }
}
