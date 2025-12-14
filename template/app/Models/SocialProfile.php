<?php

namespace App\Models;

use App\Enums\SocialVerificationStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property string $profileable_type
 * @property int $profileable_id
 * @property int|null $user_id
 * @property string $username
 * @property string $display_name
 * @property string|null $bio
 * @property string|null $avatar
 * @property string|null $cover_photo
 * @property string|null $website
 * @property string|null $profile_video
 * @property string|null $profile_video_thumbnail
 * @property array<array-key, mixed>|null $social_links
 * @property string|null $profile_type
 * @property bool $is_verified
 * @property SocialVerificationStatus $verification_status
 * @property \Illuminate\Support\Carbon|null $verification_submitted_at
 * @property \Illuminate\Support\Carbon|null $verification_reviewed_at
 * @property int|null $verification_reviewer_id
 * @property string|null $verification_notes
 * @property bool $is_private
 * @property string|null $persona_key
 * @property array<array-key, mixed>|null $persona_meta
 * @property array<array-key, mixed>|null $privacy_preferences
 * @property int|null $followers_count
 * @property int|null $following_count
 * @property int|null $posts_count
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\User|null $account
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPost> $activePosts
 * @property int|null active_posts_count
 * @property-read string $avatar_url
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialBlockList> $blockLists
 * @property int|null block_lists_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialComment> $comments
 * @property int|null $comments_count
 * @property-read string $cover_url
 * @property-read \Illuminate\Database\Eloquent\Collection<int, SocialProfile> $followers
 * @property-read \Illuminate\Database\Eloquent\Collection<int, SocialProfile> $following
 * @property-read \App\Models\SocialProfileVerification|null $latestVerificationRequest
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLike> $likes
 * @property int|null $likes_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialLiveStream> $liveBroadcasts
 * @property int|null $live_broadcasts_count
 * @property-read Model|\Eloquent $owner
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostCollection> $postCollections
 * @property int|null $post_collections_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPost> $posts
 * @property-read Model|\Eloquent $profileable
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPost> $savedPosts
 * @property int|null $saved_posts_count
 * @property-read \App\Models\User|null $user
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialProfileVerification> $verificationRequests
 * @property int|null $verification_requests_count
 * @method static \Database\Factories\SocialProfileFactory factory($count = null, $state = [])
 * @method static Builder<static>|SocialProfile newModelQuery()
 * @method static Builder<static>|SocialProfile newQuery()
 * @method static Builder<static>|SocialProfile onlyTrashed()
 * @method static Builder<static>|SocialProfile query()
 * @method static Builder<static>|SocialProfile whereAvatar($value)
 * @method static Builder<static>|SocialProfile whereBio($value)
 * @method static Builder<static>|SocialProfile whereCoverPhoto($value)
 * @method static Builder<static>|SocialProfile whereCreatedAt($value)
 * @method static Builder<static>|SocialProfile whereDeletedAt($value)
 * @method static Builder<static>|SocialProfile whereDisplayName($value)
 * @method static Builder<static>|SocialProfile whereFollowersCount($value)
 * @method static Builder<static>|SocialProfile whereFollowingCount($value)
 * @method static Builder<static>|SocialProfile whereId($value)
 * @method static Builder<static>|SocialProfile whereIdentifier(string $identifier)
 * @method static Builder<static>|SocialProfile whereIsPrivate($value)
 * @method static Builder<static>|SocialProfile whereIsVerified($value)
 * @method static Builder<static>|SocialProfile wherePostsCount($value)
 * @method static Builder<static>|SocialProfile whereProfileType($value)
 * @method static Builder<static>|SocialProfile whereProfileableId($value)
 * @method static Builder<static>|SocialProfile whereProfileableType($value)
 * @method static Builder<static>|SocialProfile whereSocialLinks($value)
 * @method static Builder<static>|SocialProfile whereUpdatedAt($value)
 * @method static Builder<static>|SocialProfile whereUserId($value)
 * @method static Builder<static>|SocialProfile whereUsername($value)
 * @method static Builder<static>|SocialProfile whereVerificationNotes($value)
 * @method static Builder<static>|SocialProfile whereVerificationReviewedAt($value)
 * @method static Builder<static>|SocialProfile whereVerificationReviewerId($value)
 * @method static Builder<static>|SocialProfile whereVerificationStatus($value)
 * @method static Builder<static>|SocialProfile whereVerificationSubmittedAt($value)
 * @method static Builder<static>|SocialProfile whereWebsite($value)
 * @method static Builder<static>|SocialProfile withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|SocialProfile withoutTrashed()
 * @property-read string|null $profile_video_poster_url
 * @property-read string|null $profile_video_url
 * @method static Builder<static>|SocialProfile wherePersonaKey($value)
 * @method static Builder<static>|SocialProfile wherePersonaMeta($value)
 * @method static Builder<static>|SocialProfile wherePrivacyPreferences($value)
 * @method static Builder<static>|SocialProfile whereProfileVideo($value)
 * @method static Builder<static>|SocialProfile whereProfileVideoThumbnail($value)
 * @mixin \Eloquent
 */
final class SocialProfile extends Model
{
	use HasFactory;
	use SoftDeletes;

	protected static ?bool $hasHandleColumn = null;

	protected $fillable = [
		'profileable_type',
		'profileable_id',
		'user_id',
		'username',
		'display_name',
		'bio',
		'avatar',
		'cover_photo',
		'website',
		'profile_video',
		'profile_video_thumbnail',
		'social_links',
		'profile_type',
		'persona_key',
		'persona_meta',
		'privacy_preferences',
		'is_verified',
		'is_private',
		'followers_count',
		'following_count',
		'posts_count',
		'verification_status',
		'verification_submitted_at',
		'verification_reviewed_at',
		'verification_reviewer_id',
		'verification_notes',
	];

	protected $casts = [
		'social_links' => 'array',
		'is_verified' => 'boolean',
		'is_private' => 'boolean',
		'persona_meta' => 'array',
		'privacy_preferences' => 'array',
		'followers_count' => 'integer',
		'following_count' => 'integer',
		'posts_count' => 'integer',
		'verification_status' => SocialVerificationStatus::class,
		'verification_submitted_at' => 'datetime',
		'verification_reviewed_at' => 'datetime',
	];

	protected $appends = [
		'avatar_url',
		'cover_url',
		'profile_video_url',
		'profile_video_poster_url',
	];

	public function profileable(): MorphTo
	{
		return $this->morphTo();
	}

	public function account(): BelongsTo
	{
		return $this->belongsTo(User::class, 'user_id');
	}

	public function user(): BelongsTo
	{
		return $this->account();
	}

	public function owner(): MorphTo
	{
		return $this->profileable();
	}

	public function resolveOwnerUser(): ?User
	{
		if ($this->relationLoaded('account') && $this->account) {
			return $this->account;
		}

		if ($this->user_id) {
			return $this->account()->first();
		}

		$owner = $this->profileable;

		if ($owner instanceof User) {
			return $owner;
		}

		if ($owner instanceof Candidate) {
			return $owner->relationLoaded('user') ? $owner->user : $owner->user()->first();
		}

		if ($owner instanceof Company) {
			return $owner->relationLoaded('user') ? $owner->user : $owner->user()->first();
		}

		return null;
	}

	public function isOwnedByUser(?User $user): bool
	{
		if (! $user) {
			return false;
		}

		$owner = $this->profileable;

		if ($owner instanceof User) {
			return (int) $owner->id === (int) $user->id;
		}

		if ($owner instanceof Profile) {
			return (int) $owner->user_id === (int) $user->id;
		}

		if ($owner instanceof Candidate) {
			return (int) $owner->user_id === (int) $user->id;
		}

		if ($owner instanceof Company) {
			return (int) $owner->user_id === (int) $user->id;
		}

		if ($this->user_id) {
			return (int) $this->user_id === (int) $user->id;
		}

		return false;
	}

	public function posts(): HasMany
	{
		return $this->hasMany(SocialPost::class, 'social_profile_id');
	}

	/**
	 * @psalm-return HasMany<Model, Model>
	 */
	public function activePosts(): HasMany
	{
		return $this->posts()->where(function (Builder $query): void {
			$query->whereNull('expires_at')
				->orWhere('expires_at', '>', now());
		});
	}

	public function followers(): BelongsToMany
	{
		return $this->belongsToMany(
			SocialProfile::class,
			'social_follows',
			'following_id',
			'follower_id'
		)->withPivot(['is_close_friend', 'notifications_enabled', 'followed_at'])
			->withTimestamps();
	}

	public function following(): BelongsToMany
	{
		return $this->belongsToMany(
			SocialProfile::class,
			'social_follows',
			'follower_id',
			'following_id'
		)->withPivot(['is_close_friend', 'notifications_enabled', 'followed_at'])
			->withTimestamps();
	}

	public function comments(): HasMany
	{
		return $this->hasMany(SocialComment::class, 'social_profile_id');
	}

	public function postCollections(): HasMany
	{
		return $this->hasMany(SocialPostCollection::class, 'social_profile_id');
	}

	public function blockLists(): MorphMany
	{
		return $this->morphMany(SocialBlockList::class, 'owner');
	}

	public function liveBroadcasts(): HasManyThrough
	{
		return $this->hasManyThrough(
			SocialLiveStream::class,
			SocialPost::class,
			'social_profile_id',
			'social_post_id'
		);
	}

	public function likes(): HasMany
	{
		return $this->hasMany(SocialLike::class, 'social_profile_id');
	}

	public function savedPosts(): BelongsToMany
	{
		return $this->belongsToMany(
			SocialPost::class,
			'social_post_saves',
			'social_profile_id',
			'social_post_id'
		)->withPivot(['saved_at'])
			->orderByPivot('saved_at', 'desc');
	}

	public function verificationRequests(): HasMany
	{
		return $this->hasMany(SocialProfileVerification::class);
	}

	public function latestVerificationRequest(): HasOne
	{
		return $this->hasOne(SocialProfileVerification::class)->latestOfMany('submitted_at');
	}

	public function updateVerificationState(SocialVerificationStatus $status, ?int $reviewerId = null, ?string $notes = null): void
	{
		$attributes = [
			'verification_status' => $status,
			'is_verified' => $status === SocialVerificationStatus::Approved,
		];

		if ($status === SocialVerificationStatus::Pending) {
			$attributes['verification_submitted_at'] = now();
			$attributes['verification_reviewed_at'] = null;
			$attributes['verification_reviewer_id'] = null;
		} elseif ($status->isFinal() || $status === SocialVerificationStatus::NeedsMoreInfo) {
			$attributes['verification_reviewed_at'] = now();
			$attributes['verification_reviewer_id'] = $reviewerId;
		}

		if ($notes !== null) {
			$attributes['verification_notes'] = $notes;
		}

		$this->forceFill($attributes)->save();
	}

	public function isFollowing(self $profile): bool
	{
		return $this->following()->where('following_id', $profile->id)->exists();
	}

	public function isFollowedBy(self $profile): bool
	{
		return $this->followers()->where('follower_id', $profile->id)->exists();
	}

	public function toggleFollow(self $profile): bool
	{
		if ($this->isFollowing($profile)) {
			$this->following()->detach($profile->id);
			$profile->decrement('followers_count');
			$this->decrement('following_count');

			return false;
		}

		$this->following()->syncWithoutDetaching([
			$profile->id => [
				'is_close_friend' => false,
				'notifications_enabled' => true,
				'followed_at' => now(),
			],
		]);

		$profile->increment('followers_count');
		$this->increment('following_count');

		return true;
	}

	protected function avatarUrl(): Attribute
	{
		return Attribute::get(function (): string {
			if ($this->avatar) {
				return Storage::url($this->avatar);
			}

			return asset('images/default-avatar.png');
		});
	}

	protected function coverUrl(): Attribute
	{
		return Attribute::get(function (): string {
			if ($this->cover_photo) {
				return Storage::url($this->cover_photo);
			}

			return asset('images/default-cover.jpg');
		});
	}

	protected function profileVideoUrl(): Attribute
	{
		return Attribute::get(function (): ?string {
			if (! $this->profile_video) {
				return null;
			}

			return Storage::url($this->profile_video);
		});
	}

	protected function profileVideoPosterUrl(): Attribute
	{
		return Attribute::get(function (): ?string {
			if (! $this->profile_video_thumbnail) {
				return null;
			}

			return Storage::url($this->profile_video_thumbnail);
		});
	}

	public function getFeed(int $limit = 20)
	{
		$followingIds = $this->following()->pluck('following_id')->toArray();
		$followingIds[] = $this->id;

		return SocialPost::whereIn('social_profile_id', $followingIds)
			->where('visibility', 'public')
			->where(function ($query) {
				$query->whereNull('expires_at')
					->orWhere('expires_at', '>', now());
			})
			->orderByDesc('published_at')
			->limit($limit)
			->get();
	}

	public function getRecommendedProfiles(int $limit = 10)
	{
		return self::where('id', '!=', $this->id)
			->where('profile_type', $this->profile_type)
			->whereNotIn('id', $this->following()->pluck('following_id'))
			->orderByDesc('followers_count')
			->limit($limit)
			->get();
	}

	/**
	 * @psalm-return Builder<Model>
	 */
	public function scopeWhereIdentifier(Builder $query, string $identifier): Builder
	{
		return $query->where(function (Builder $subQuery) use ($identifier) {
			$subQuery->where('username', $identifier);

			if (static::hasHandleColumn()) {
				$subQuery->orWhere('handle', $identifier);
			}
		});
	}

	public static function hasHandleColumn(): bool
	{
		if (static::$hasHandleColumn === null) {
			$instance = new static();
			static::$hasHandleColumn = Schema::hasColumn($instance->getTable(), 'handle');
		}

		return static::$hasHandleColumn;
	}
}

