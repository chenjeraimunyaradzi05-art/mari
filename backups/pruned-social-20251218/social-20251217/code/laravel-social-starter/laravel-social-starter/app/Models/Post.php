<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model
{
    use HasFactory;

    protected $fillable = [
        'author_type','author_id','body','media_path','media_type','visibility','ai_caption','ai_tags','is_moderated'
    ];

    protected $casts = [
        'ai_tags' => 'array',
        'is_moderated' => 'boolean',
    ];

    public function author(): MorphTo { return $this->morphTo(); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function reactions(): HasMany { return $this->hasMany(Reaction::class); }
    public function comments(): HasMany { return $this->hasMany(Comment::class)->whereNull('parent_id'); }
}
