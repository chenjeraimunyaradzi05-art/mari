<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Profile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id','organization_id','type','display_name','handle','bio','avatar_path','banner_path','links_json'
    ];

    protected $casts = [
        'links_json' => 'array',
    ];

    public const TYPES = ['candidate','trainee','provider','sole_trader','company','government'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
    public function posts(): HasMany { return $this->hasMany(Post::class, 'author_id')->where('author_type', self::class); }
}
