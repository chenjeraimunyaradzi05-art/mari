<?php

namespace App\Models;

use App\Models\Admin;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $term
 * @property string $severity
 * @property string|null $replacement
 * @property array<array-key, mixed>|null $tags
 * @property array<array-key, mixed>|null $contexts
 * @property bool $is_active
 * @property int|null $created_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Admin|null $creator
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereContexts($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereCreatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereReplacement($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereSeverity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereTerm($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialSensitiveTerm whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialSensitiveTerm extends Model
{
    use HasFactory;

    protected $fillable = [
        'term',
        'severity',
        'replacement',
        'tags',
        'contexts',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'tags' => 'array',
        'contexts' => 'array',
        'is_active' => 'boolean',
    ];

    public function creator()
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }
}

