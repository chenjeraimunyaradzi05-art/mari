# Eloquent Models (5-10% Implementation)

## File: `app/Models/SocialProfile.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SocialProfile extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'profileable_type',
        'profileable_id',
        'username',
        'display_name',
        'bio',
        'avatar',
        'cover_photo',
        'website',
        'social_links',
        'profile_type',
        'is_verified',
        'is_private',
        'followers_count',
        'following_count',
        'posts_count',
    ];

    protected $casts = [
        'social_links' => 'array',
        'is_verified' => 'boolean',
        'is_private' => 'boolean',
    ];

    protected $appends = ['avatar_url', 'cover_url'];

    // Polymorphic relationship
    public function profileable(): MorphTo
    {
        return $this->morphTo();
    }

    // Posts relationship
    public function posts(): HasMany
    {
        return $this->hasMany(SocialPost::class)->orderByDesc('published_at');
    }

    // Active posts (not expired stories)
    public function activePosts(): HasMany
    {
        return $this->posts()
            ->where(function($query) {
                $query->whereNull('expires_at')
                      ->orWhere('expires_at', '>', now());
            });
    }

    // Followers (people following this profile)
    public function followers(): BelongsToMany
    {
        return $this->belongsToMany(
            SocialProfile::class,
            'social_follows',
            'following_id',
            'follower_id'
        )->withTimestamps();
    }

    // Following (profiles this profile follows)
    public function following(): BelongsToMany
    {
        return $this->belongsToMany(
            SocialProfile::class,
            'social_follows',
            'follower_id',
            'following_id'
        )->withTimestamps();
    }

    // Comments
    public function comments(): HasMany
    {
        return $this->hasMany(SocialComment::class);
    }

    // Likes
    public function likes(): HasMany
    {
        return $this->hasMany(SocialLike::class);
    }

    // Check if this profile follows another
    public function isFollowing(SocialProfile $profile): bool
    {
        return $this->following()->where('following_id', $profile->id)->exists();
    }

    // Check if this profile is followed by another
    public function isFollowedBy(SocialProfile $profile): bool
    {
        return $this->followers()->where('follower_id', $profile->id)->exists();
    }

    // Toggle follow/unfollow
    public function toggleFollow(SocialProfile $profile): bool
    {
        if ($this->isFollowing($profile)) {
            $this->following()->detach($profile->id);
            $profile->decrement('followers_count');
            $this->decrement('following_count');
            return false;
        } else {
            $this->following()->attach($profile->id, ['followed_at' => now()]);
            $profile->increment('followers_count');
            $this->increment('following_count');
            return true;
        }
    }

    // Get avatar URL
    public function getAvatarUrlAttribute(): string
    {
        if ($this->avatar) {
            return asset('storage/' . $this->avatar);
        }
        return asset('images/default-avatar.png');
    }

    // Get cover URL
    public function getCoverUrlAttribute(): string
    {
        if ($this->cover_photo) {
            return asset('storage/' . $this->cover_photo);
        }
        return asset('images/default-cover.jpg');
    }

    // Get feed for this profile (posts from followed profiles)
    public function getFeed($limit = 20)
    {
        $followingIds = $this->following()->pluck('following_id')->toArray();
        $followingIds[] = $this->id; // Include own posts

        return SocialPost::whereIn('social_profile_id', $followingIds)
            ->where('visibility', 'public')
            ->whereNull('expires_at')
            ->orWhere('expires_at', '>', now())
            ->orderByDesc('published_at')
            ->limit($limit)
            ->get();
    }

    // Get AI-powered recommendations
    public function getRecommendedProfiles($limit = 10)
    {
        // AI-based recommendations
        // This would integrate with your AI service
        return SocialProfile::where('id', '!=', $this->id)
            ->where('profile_type', $this->profile_type)
            ->whereNotIn('id', $this->following()->pluck('following_id'))
            ->orderByDesc('followers_count')
            ->limit($limit)
            ->get();
    }
}
```

## File: `app/Models/SocialPost.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SocialPost extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'social_profile_id',
        'post_type',
        'caption',
        'media',
        'location',
        'tags',
        'mentions',
        'likes_count',
        'comments_count',
        'shares_count',
        'views_count',
        'is_pinned',
        'comments_disabled',
        'visibility',
        'published_at',
        'expires_at',
        'ai_engagement_score',
        'ai_tags',
    ];

    protected $casts = [
        'media' => 'array',
        'tags' => 'array',
        'mentions' => 'array',
        'ai_tags' => 'array',
        'is_pinned' => 'boolean',
        'comments_disabled' => 'boolean',
        'published_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    protected $appends = ['is_story', 'is_expired', 'formatted_date'];

    // Profile relationship
    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    // Media relationship
    public function mediaFiles(): HasMany
    {
        return $this->hasMany(SocialMedia::class)->orderBy('order');
    }

    // Comments relationship
    public function comments(): HasMany
    {
        return $this->hasMany(SocialComment::class)->whereNull('parent_id')->orderByDesc('created_at');
    }

    // All comments including replies
    public function allComments(): HasMany
    {
        return $this->hasMany(SocialComment::class)->orderByDesc('created_at');
    }

    // Likes relationship
    public function likes(): MorphMany
    {
        return $this->morphMany(SocialLike::class, 'likeable');
    }

    // Check if profile liked this post
    public function isLikedBy(SocialProfile $profile): bool
    {
        return $this->likes()->where('social_profile_id', $profile->id)->exists();
    }

    // Toggle like
    public function toggleLike(SocialProfile $profile): bool
    {
        $existing = $this->likes()->where('social_profile_id', $profile->id)->first();
        
        if ($existing) {
            $existing->delete();
            $this->decrement('likes_count');
            return false;
        } else {
            $this->likes()->create([
                'social_profile_id' => $profile->id,
                'liked_at' => now(),
            ]);
            $this->increment('likes_count');
            return true;
        }
    }

    // Check if this is a story
    public function getIsStoryAttribute(): bool
    {
        return $this->post_type === 'story';
    }

    // Check if story is expired
    public function getIsExpiredAttribute(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    // Formatted date
    public function getFormattedDateAttribute(): string
    {
        if (!$this->published_at) {
            return '';
        }
        
        $diff = now()->diffInHours($this->published_at);
        
        if ($diff < 1) {
            return now()->diffInMinutes($this->published_at) . 'm';
        } elseif ($diff < 24) {
            return $diff . 'h';
        } elseif ($diff < 168) {
            return now()->diffInDays($this->published_at) . 'd';
        } else {
            return $this->published_at->format('M j');
        }
    }

    // Increment view count
    public function incrementViews(): void
    {
        $this->increment('views_count');
    }

    // Scope for public posts
    public function scopePublic($query)
    {
        return $query->where('visibility', 'public');
    }

    // Scope for active posts (not expired)
    public function scopeActive($query)
    {
        return $query->where(function($q) {
            $q->whereNull('expires_at')
              ->orWhere('expires_at', '>', now());
        });
    }
}
```

## File: `app/Models/SocialMedia.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialMedia extends Model
{
    use HasFactory;

    protected $table = 'social_media';

    protected $fillable = [
        'social_post_id',
        'media_type',
        'file_path',
        'thumbnail_path',
        'mime_type',
        'file_size',
        'width',
        'height',
        'duration',
        'order',
        'ai_analysis',
        'filters',
    ];

    protected $casts = [
        'ai_analysis' => 'array',
        'filters' => 'array',
    ];

    protected $appends = ['url', 'thumbnail_url', 'is_video'];

    // Post relationship
    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    // Get media URL
    public function getUrlAttribute(): string
    {
        return asset('storage/' . $this->file_path);
    }

    // Get thumbnail URL
    public function getThumbnailUrlAttribute(): ?string
    {
        if ($this->thumbnail_path) {
            return asset('storage/' . $this->thumbnail_path);
        }
        return null;
    }

    // Check if media is video
    public function getIsVideoAttribute(): bool
    {
        return $this->media_type === 'video';
    }

    // Get formatted file size
    public function getFormattedSizeAttribute(): string
    {
        $size = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB'];
        
        for ($i = 0; $size > 1024 && $i < 3; $i++) {
            $size /= 1024;
        }
        
        return round($size, 2) . ' ' . $units[$i];
    }
}
```

## File: `app/Models/SocialComment.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SocialComment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'social_post_id',
        'social_profile_id',
        'parent_id',
        'comment',
        'mentions',
        'likes_count',
        'replies_count',
        'is_pinned',
        'ai_sentiment',
    ];

    protected $casts = [
        'mentions' => 'array',
        'ai_sentiment' => 'array',
        'is_pinned' => 'boolean',
    ];

    protected $appends = ['formatted_date'];

    // Post relationship
    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    // Profile relationship
    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    // Parent comment (for replies)
    public function parent(): BelongsTo
    {
        return $this->belongsTo(SocialComment::class, 'parent_id');
    }

    // Replies
    public function replies(): HasMany
    {
        return $this->hasMany(SocialComment::class, 'parent_id')->orderBy('created_at');
    }

    // Likes
    public function likes(): MorphMany
    {
        return $this->morphMany(SocialLike::class, 'likeable');
    }

    // Check if liked by profile
    public function isLikedBy(SocialProfile $profile): bool
    {
        return $this->likes()->where('social_profile_id', $profile->id)->exists();
    }

    // Toggle like
    public function toggleLike(SocialProfile $profile): bool
    {
        $existing = $this->likes()->where('social_profile_id', $profile->id)->first();
        
        if ($existing) {
            $existing->delete();
            $this->decrement('likes_count');
            return false;
        } else {
            $this->likes()->create([
                'social_profile_id' => $profile->id,
                'liked_at' => now(),
            ]);
            $this->increment('likes_count');
            return true;
        }
    }

    // Formatted date
    public function getFormattedDateAttribute(): string
    {
        $diff = now()->diffInMinutes($this->created_at);
        
        if ($diff < 1) {
            return 'Just now';
        } elseif ($diff < 60) {
            return $diff . 'm';
        } elseif ($diff < 1440) {
            return floor($diff / 60) . 'h';
        } elseif ($diff < 10080) {
            return floor($diff / 1440) . 'd';
        } else {
            return $this->created_at->format('M j, Y');
        }
    }
}
```

## File: `app/Models/SocialLike.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SocialLike extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'social_profile_id',
        'likeable_type',
        'likeable_id',
        'liked_at',
    ];

    protected $casts = [
        'liked_at' => 'datetime',
    ];

    // Profile relationship
    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    // Polymorphic relationship
    public function likeable(): MorphTo
    {
        return $this->morphTo();
    }
}
```

## File: `app/Models/SocialFollow.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialFollow extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'follower_id',
        'following_id',
        'is_close_friend',
        'notifications_enabled',
        'followed_at',
    ];

    protected $casts = [
        'is_close_friend' => 'boolean',
        'notifications_enabled' => 'boolean',
        'followed_at' => 'datetime',
    ];

    // Follower profile
    public function follower(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'follower_id');
    }

    // Following profile
    public function following(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'following_id');
    }
}
```

## Installation Instructions (5-10%)

### Step 1: Copy Model Files
Place all model files in `app/Models/` directory.

### Step 2: Update Existing Models
Add this trait to your existing User, Company, Candidate, etc. models:

```php
use Illuminate\Database\Eloquent\Relations\MorphOne;

public function socialProfile(): MorphOne
{
    return $this->morphOne(SocialProfile::class, 'profileable');
}
```

### Step 3: Test Models in Tinker
```bash
php artisan tinker
> $profile = SocialProfile::first();
> $profile->posts;
> $profile->followers;
> $profile->following;
```

### Next: Move to 10-15% (Model Observers & Events)
