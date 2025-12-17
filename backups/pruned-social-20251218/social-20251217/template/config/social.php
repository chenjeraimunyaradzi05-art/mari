<?php

return [
	'media' => [
		'disk' => env('SOCIAL_MEDIA_DISK', env('FILESYSTEM_DISK', 'public')),
		'visibility' => env('SOCIAL_MEDIA_VISIBILITY', 'public'),
		'root' => env('SOCIAL_MEDIA_ROOT', 'social'),
		'paths' => [
			'avatars' => env('SOCIAL_MEDIA_AVATAR_DIR', 'avatars'),
			'covers' => env('SOCIAL_MEDIA_COVER_DIR', 'covers'),
			'images' => env('SOCIAL_MEDIA_IMAGES_DIR', 'posts/images'),
			'videos' => env('SOCIAL_MEDIA_VIDEOS_DIR', 'posts/videos'),
			'profile_videos' => env('SOCIAL_MEDIA_PROFILE_VIDEO_DIR', 'profiles/videos'),
			'thumbnails' => env('SOCIAL_MEDIA_THUMB_DIR', 'posts/thumbnails'),
			'profile_video_thumbnails' => env('SOCIAL_MEDIA_PROFILE_VIDEO_THUMB_DIR', 'profiles/thumbnails'),
			'captions' => env('SOCIAL_MEDIA_CAPTIONS_DIR', 'posts/captions'),
		],
		'image' => [
			'avatar' => [
				'width' => (int) env('SOCIAL_MEDIA_AVATAR_WIDTH', 400),
				'height' => (int) env('SOCIAL_MEDIA_AVATAR_HEIGHT', 400),
			],
			'cover' => [
				'width' => (int) env('SOCIAL_MEDIA_COVER_WIDTH', 1500),
				'height' => (int) env('SOCIAL_MEDIA_COVER_HEIGHT', 500),
			],
			'max_dimension' => (int) env('SOCIAL_MEDIA_IMAGE_MAX_DIMENSION', 1080),
		],
		'quality' => [
			'avatar' => (int) env('SOCIAL_MEDIA_AVATAR_QUALITY', 85),
			'cover' => (int) env('SOCIAL_MEDIA_COVER_QUALITY', 85),
			'post' => (int) env('SOCIAL_MEDIA_IMAGE_QUALITY', 85),
		],
		'processing' => [
			'ffmpeg' => env('SOCIAL_MEDIA_FFMPEG', 'ffmpeg'),
			'ffprobe' => env('SOCIAL_MEDIA_FFPROBE', 'ffprobe'),
			'thumbnail_width' => (int) env('SOCIAL_MEDIA_THUMB_WIDTH', 720),
			'thumbnail_height' => (int) env('SOCIAL_MEDIA_THUMB_HEIGHT', 720),
		],
 	],
	'feed' => [
		'trending_cache_ttl' => (int) env('SOCIAL_FEED_TRENDING_TTL', 3600),
		'trending_limit' => (int) env('SOCIAL_FEED_TRENDING_LIMIT', 30),
		'personalized_cache_ttl' => (int) env('SOCIAL_FEED_PERSONALIZED_TTL', 60),
		'composer' => [
			'max_media' => (int) env('SOCIAL_FEED_COMPOSER_MAX_MEDIA', 0),
			'max_file_size_mb' => (int) env('SOCIAL_FEED_COMPOSER_MAX_FILE_SIZE_MB', 12),
			'accepted_types' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_FEED_COMPOSER_ACCEPTED_TYPES', 'image/jpeg,image/png,image/gif,video/mp4,video/webm'))))),
		],
		'for_you' => [
			'proportion_following' => (float) env('SOCIAL_FEED_FOR_YOU_FOLLOWING_WEIGHT', 0.4),
			'min_ai_score' => (float) env('SOCIAL_FEED_FOR_YOU_MIN_AI', 0.35),
			'editorial_boost_hours' => (int) env('SOCIAL_FEED_EDITORIAL_BOOST_HOURS', 72),
			'pinned_limit' => (int) env('SOCIAL_FEED_PINNED_LIMIT', 4),
			'pinned_cache_ttl' => (int) env('SOCIAL_FEED_PINNED_TTL', 300),
		],
		'trending_topics' => [
			'window_hours' => (int) env('SOCIAL_FEED_TRENDING_WINDOW_HOURS', 24),
			'cache_ttl' => (int) env('SOCIAL_FEED_TRENDING_TOPICS_TTL', 300),
		],
		'quality_categories' => [
			'candidates' => [
				'keywords' => ['candidate', 'women', 'return', 'career change', 'student', 'apprentice'],
				'tags' => ['womenintech', 'womeninfinance', 'careerchange', 'returntowork'],
				'topics' => ['candidates', 'career_returners'],
			],
			'employers' => [
				'keywords' => ['hire', 'role', 'opportunity', 'opening', 'employer', 'recruiting'],
				'tags' => ['jobs', 'hiring', 'opportunities'],
				'topics' => ['employers', 'hiring'],
			],
			'education' => [
				'keywords' => ['course', 'learning', 'bootcamp', 'certified', 'study', 'tafe', 'rto', 'apprenticeship'],
				'tags' => ['learning', 'education', 'apprenticeships'],
				'topics' => ['education', 'apprenticeships'],
			],
			'mentorship' => [
				'keywords' => ['mentor', 'mentorship', 'advice', 'coaching'],
				'tags' => ['mentorship', 'mentors'],
				'topics' => ['mentorship'],
			],
			'news' => [
				'keywords' => ['report', 'trend', 'market', 'insight', 'policy'],
				'tags' => ['news', 'insights'],
				'topics' => ['policy', 'market_trends'],
			],
			'success' => [
				'keywords' => ['promotion', 'raise', 'salary', 'celebrate', 'milestone'],
				'tags' => ['success', 'celebrate', 'wins'],
				'topics' => ['success_stories'],
			],
		],
		'quality_goals' => [
			'candidates' => (int) env('SOCIAL_FEED_GOAL_CANDIDATES', 20),
			'employers' => (int) env('SOCIAL_FEED_GOAL_EMPLOYERS', 25),
			'success' => (int) env('SOCIAL_FEED_GOAL_SUCCESS', 15),
			'education' => (int) env('SOCIAL_FEED_GOAL_EDUCATION', 20),
			'mentorship' => (int) env('SOCIAL_FEED_GOAL_MENTORSHIP', 10),
			'news' => (int) env('SOCIAL_FEED_GOAL_NEWS', 10),
		],
		'comments' => [
			'preview_replies' => (int) env('SOCIAL_FEED_COMMENT_PREVIEW_REPLIES', 3),
		],
	],
	'privacy' => [
		'candidate_profile_types' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_PRIVACY_CANDIDATE_TYPES', 'candidate,trainee'))))),
		'recruiter_profile_types' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_PRIVACY_RECRUITER_TYPES', 'company,business,government,education_provider,public_sector,sole_trader,mentor'))))),
	],
	'uploads' => [
		'chunk_disk' => env('SOCIAL_UPLOADS_CHUNK_DISK', 'local'),
		'session_ttl_minutes' => (int) env('SOCIAL_UPLOADS_SESSION_TTL_MINUTES', 180),
		'default_chunk_bytes' => (int) env('SOCIAL_UPLOADS_DEFAULT_CHUNK_BYTES', 50 * 1024 * 1024),
		'role_quotas' => [
			'candidate' => [
				'max_bytes' => (int) env('SOCIAL_UPLOADS_CANDIDATE_MAX_BYTES', -1),
				'chunk_bytes' => (int) env('SOCIAL_UPLOADS_CANDIDATE_CHUNK_BYTES', 25 * 1024 * 1024),
			],
			'company' => [
				'max_bytes' => (int) env('SOCIAL_UPLOADS_COMPANY_MAX_BYTES', -1),
				'chunk_bytes' => (int) env('SOCIAL_UPLOADS_COMPANY_CHUNK_BYTES', 100 * 1024 * 1024),
			],
			'mentor' => [
				'max_bytes' => (int) env('SOCIAL_UPLOADS_MENTOR_MAX_BYTES', -1),
				'chunk_bytes' => (int) env('SOCIAL_UPLOADS_MENTOR_CHUNK_BYTES', 50 * 1024 * 1024),
			],
			'default' => [
				'max_bytes' => (int) env('SOCIAL_UPLOADS_DEFAULT_MAX_BYTES', -1),
				'chunk_bytes' => (int) env('SOCIAL_UPLOADS_DEFAULT_CHUNK_BYTES', 50 * 1024 * 1024),
			],
		],
	],
	'capture' => [
		'enabled' => (bool) env('SOCIAL_CAPTURE_ENABLED', true),
		'max_duration_seconds' => (int) env('SOCIAL_CAPTURE_MAX_DURATION', 180),
		'consent_copy' => env('SOCIAL_CAPTURE_CONSENT_COPY', 'Recording is opt-in and encrypted. Attach only content you are comfortable sharing with the community.'),
		'consent_interval_hours' => (int) env('SOCIAL_CAPTURE_CONSENT_INTERVAL_HOURS', 24),
		'video' => [
			'preferred_mime' => env('SOCIAL_CAPTURE_VIDEO_MIME', 'video/webm'),
			'mime_types' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_CAPTURE_VIDEO_TYPES', 'video/webm,video/mp4'))))),
			'max_resolution' => env('SOCIAL_CAPTURE_VIDEO_RESOLUTION', '1280x720'),
		],
		'audio' => [
			'preferred_mime' => env('SOCIAL_CAPTURE_AUDIO_MIME', 'audio/webm'),
			'mime_types' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_CAPTURE_AUDIO_TYPES', 'audio/webm,audio/mpeg'))))),
		],
	],
	'integrations' => [
		'max_links_per_request' => (int) env('SOCIAL_INTEGRATIONS_MAX_LINKS', 5),
		'max_attachments_per_post' => (int) env('SOCIAL_INTEGRATIONS_MAX_ATTACHMENTS', 5),
		'import_signing_key' => env('SOCIAL_IMPORT_SIGNING_KEY', env('APP_KEY')),
		'rate_limits' => [
			'link_imports' => env('SOCIAL_INTEGRATIONS_IMPORT_RATE', '6:10'),
		],
		'providers' => [
			'youtube' => [
				'label' => 'YouTube',
				'icon' => 'fab fa-youtube',
				'domains' => ['youtube.com', 'youtu.be'],
				'media_type' => 'video',
				'requires_connection' => false,
				'embed_template' => 'https://www.youtube.com/embed/{id}',
				'thumbnail_template' => 'https://img.youtube.com/vi/{id}/hqdefault.jpg',
			],
			'facebook' => [
				'label' => 'Facebook',
				'icon' => 'fab fa-facebook',
				'domains' => ['facebook.com', 'fb.watch'],
				'media_type' => 'embed',
				'requires_connection' => true,
				'embed_template' => 'https://www.facebook.com/plugins/post.php?href={encoded_url}&show_text=true',
				'thumbnail_template' => null,
			],
			'instagram' => [
				'label' => 'Instagram',
				'icon' => 'fab fa-instagram',
				'domains' => ['instagram.com', 'instagr.am'],
				'media_type' => 'embed',
				'requires_connection' => true,
				'embed_template' => 'https://www.instagram.com/p/{id}/embed',
				'thumbnail_template' => null,
			],
			'x' => [
				'label' => 'X (Twitter)',
				'icon' => 'fab fa-x-twitter',
				'domains' => ['twitter.com', 'x.com'],
				'media_type' => 'embed',
				'requires_connection' => true,
				'embed_template' => 'https://twitframe.com/show?url={encoded_url}',
				'thumbnail_template' => null,
			],
			'threads' => [
				'label' => 'Threads',
				'icon' => 'fas fa-share-nodes',
				'domains' => ['threads.net'],
				'media_type' => 'embed',
				'requires_connection' => true,
				'embed_template' => 'https://www.threads.net/embed/{id}',
				'thumbnail_template' => null,
			],
		],
	],
	'connections' => [
		'daily_limit' => (int) env('SOCIAL_CONNECTIONS_DAILY_LIMIT', 60),
		'burst_limit' => (int) env('SOCIAL_CONNECTIONS_BURST_LIMIT', 6),
		'burst_minutes' => (int) env('SOCIAL_CONNECTIONS_BURST_MINUTES', 10),
		'spike_threshold' => (int) env('SOCIAL_CONNECTIONS_SPIKE_THRESHOLD', 12),
	],
	'backbone' => [
		'cache_ttl' => (int) env('SOCIAL_BACKBONE_CACHE_TTL', 180),
		'cache_key_prefix' => env('SOCIAL_BACKBONE_CACHE_PREFIX', 'social_backbone:'),
	],
	'queue' => [
		'connection' => env('SOCIAL_QUEUE_CONNECTION', env('QUEUE_CONNECTION', 'sync')),
		'media_processing' => env('SOCIAL_MEDIA_QUEUE', 'social-media'),
		'feed_refresh' => env('SOCIAL_FEED_QUEUE', 'social-feed'),
		'ai_retry' => env('SOCIAL_AI_RETRY_QUEUE', 'ai-retry'),
		'imports' => env('SOCIAL_IMPORTS_QUEUE', 'social-imports'),
	],
	'streams' => [
		'metrics_queue' => env('SOCIAL_STREAM_METRICS_QUEUE', 'social-feed'),
		'default_ingest_region' => env('SOCIAL_STREAM_DEFAULT_REGION', 'ap-southeast-2'),
	],
	'analytics' => [
		'queue' => env('SOCIAL_ANALYTICS_QUEUE', 'analytics'),
		'warehouse_disk' => env('SOCIAL_ANALYTICS_WAREHOUSE_DISK', env('FILESYSTEM_DISK', 'local')),
		'export_path' => env('SOCIAL_ANALYTICS_EXPORT_PATH', 'analytics/warehouse'),
		'batch_size' => (int) env('SOCIAL_ANALYTICS_BATCH_SIZE', 500),
	],
	'revenue' => [
		'queue' => env('SOCIAL_REVENUE_QUEUE', 'revenue'),
		'payout_currency' => env('SOCIAL_REVENUE_PAYOUT_CURRENCY', 'AUD'),
		'export_path' => env('SOCIAL_REVENUE_EXPORT_PATH', 'analytics/payouts'),
	],
	'ai_assist' => [
		'rate_limit' => (int) env('SOCIAL_AI_RATE_LIMIT', 45),
		'cache_ttl' => (int) env('SOCIAL_AI_CACHE_TTL', 120),
		'video_captions_enabled' => (bool) env('SOCIAL_AI_VIDEO_CAPTIONS', true),
		'poll_assistance_enabled' => (bool) env('SOCIAL_AI_POLL_ASSIST', true),
		'live_assistance_enabled' => (bool) env('SOCIAL_AI_LIVE_ASSIST', true),
		'mentor_matching_enabled' => (bool) env('SOCIAL_AI_MENTOR_MATCH', true),
		'fallback_enabled' => (bool) env('SOCIAL_AI_FALLBACK', true),
	],
	'reactions' => [
		'default' => env('SOCIAL_REACTIONS_DEFAULT', 'like'),
		'palette' => [
			'like' => ['label' => 'Like', 'icon' => 'fas fa-thumbs-up'],
			'heart' => ['label' => 'Heart', 'icon' => 'fas fa-heart'],
			'celebrate' => ['label' => 'Celebrate', 'icon' => 'fas fa-champagne-glasses'],
			'support' => ['label' => 'Support', 'icon' => 'fas fa-hands-helping'],
		],
	],
	'shares' => [
		'channels' => ['native', 'feed', 'dm', 'link', 'copy'],
	],
	'repost' => [
		// How many hours to block repeated reposting of the same post by the same profile
		'rate_limit_hours' => (int) env('SOCIAL_REPOST_RATE_LIMIT_HOURS', 24),
		// Which moderation_status values should block reposts by default
		'blocked_moderation_statuses' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_REPOST_BLOCKED_MODERATION_STATUSES', 'pending_review,flagged,rejected'))))),
		// If true, posts with AI moderation flags may be blocked from reposting.
		// If `ai_blocked_flags` is non-empty the post will only be blocked when
		// the post's flags intersect with that list. If `ai_blocked_flags` is empty
		// (default) any AI flag will block reposts.
		'block_on_ai_flags' => (bool) env('SOCIAL_REPOST_BLOCK_ON_AI_FLAGS', true),
		// Comma-separated list of AI moderation flags that should block reposting.
		// If empty, any AI flag will block by default.
		'ai_blocked_flags' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_REPOST_AI_BLOCKED_FLAGS', 'sexually_explicit,violent'))))),
	],
	'notifications' => [
		'categories' => [
			'posts' => 'Posts & reposts',
			'comments' => 'Comments & replies',
			'reactions' => 'Reactions & likes',
			'follows' => 'New followers',
			'messages' => 'Direct messages',
			'invites' => 'Invites & requests',
		],
		'channels' => ['in_app', 'email'],
		'defaults' => [
			'posts' => ['in_app' => true, 'email' => false],
			'comments' => ['in_app' => true, 'email' => true],
			'reactions' => ['in_app' => true, 'email' => false],
			'follows' => ['in_app' => true, 'email' => false],
			'messages' => ['in_app' => true, 'email' => true],
			'invites' => ['in_app' => true, 'email' => true],
		],
	],
	'verification' => [
		'reviewer_roles' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_VERIFICATION_REVIEWER_ROLES', 'Super Admin'))))),
		'notification_roles' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_VERIFICATION_NOTIFICATION_ROLES', env('SOCIAL_VERIFICATION_REVIEWER_ROLES', 'Super Admin')))))),
	],
	'moderation' => [
		'auto_suspend_minutes' => (int) env('SOCIAL_MODERATION_AUTO_SUSPEND_MINUTES', 180),
		'mentor_roles' => array_values(array_filter(array_map('trim', explode(',', env('SOCIAL_MODERATION_MENTOR_ROLES', 'community_manager,mentor_lead'))))),
		'repeat_offender_threshold' => (int) env('SOCIAL_MODERATION_REPEAT_OFFENDER_THRESHOLD', 2),
	],
	'metrics' => [
		'heatmap' => [
			'extended_enabled' => (bool) env('SOCIAL_METRICS_HEATMAP_EXTENDED', true),
			'lookback_days' => (int) env('SOCIAL_METRICS_HEATMAP_LOOKBACK_DAYS', 45),
			'ranges' => array_map('intval', array_filter(array_map('trim', explode(',', env('SOCIAL_METRICS_HEATMAP_RANGES', '7,30'))))),
		],
		'cohort' => [
			'max_tags' => max(1, (int) env('SOCIAL_METRICS_COHORT_MAX_TAGS', 3)),
		],
	],
];
