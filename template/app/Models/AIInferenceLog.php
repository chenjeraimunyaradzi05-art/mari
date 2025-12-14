<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $pipeline
 * @property string|null $provider
 * @property string|null $prompt_version
 * @property string $prompt_hash
 * @property int $tokens_in
 * @property int $tokens_out
 * @property int|null $duration_ms
 * @property numeric|null $confidence
 * @property string $result_status
 * @property bool $cache_hit
 * @property bool $override_flag
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Database\Factories\AIInferenceLogFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereCacheHit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereConfidence($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereDurationMs($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereOverrideFlag($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog wherePipeline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog wherePromptHash($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog wherePromptVersion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereResultStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereTokensIn($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereTokensOut($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIInferenceLog whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class AIInferenceLog extends Model
{
    use HasFactory;

    protected $table = 'ai_inference_logs';

    protected $fillable = [
        'pipeline',
        'provider',
        'prompt_version',
        'prompt_hash',
        'tokens_in',
        'tokens_out',
        'duration_ms',
        'confidence',
        'result_status',
        'cache_hit',
        'override_flag',
        'meta',
    ];

    protected $casts = [
        'tokens_in' => 'int',
        'tokens_out' => 'int',
        'duration_ms' => 'int',
        'confidence' => 'decimal:2',
        'cache_hit' => 'bool',
        'override_flag' => 'bool',
        'meta' => 'array',
    ];
}
