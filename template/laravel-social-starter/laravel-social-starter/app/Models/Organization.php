<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    use HasFactory;

    protected $fillable = [
        'name','type','bio','website','avatar_path','cover_path','owner_id'
    ];

    public const TYPES = ['university','tafe_rto','company','government','sole_trader'];

    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function profiles(): HasMany { return $this->hasMany(Profile::class); }
    public function posts(): HasMany { return $this->hasMany(Post::class, 'author_id')->where('author_type', self::class); }
}
