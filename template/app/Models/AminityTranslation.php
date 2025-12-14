<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * AminityTranslation Model
 *
 * @property int $id
 * @property int $aminity_id
 * @property string $title
 * @property string $lang_code
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AminityTranslation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AminityTranslation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AminityTranslation query()
 *
 * @mixin \Eloquent
 */
final class AminityTranslation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['title'];
}
