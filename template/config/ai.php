<?php

return [
	'default_provider' => env('AI_DEFAULT_PROVIDER', 'openai'),

	'providers' => [
		'openai' => [
			'api_key' => env('AI_OPENAI_API_KEY'),
			'organization' => env('AI_OPENAI_ORG'),
			'chat_model' => env('AI_OPENAI_CHAT_MODEL', 'gpt-4.1-mini'),
			'embedding_model' => env('AI_OPENAI_EMBED_MODEL', 'text-embedding-3-large'),
		],
		'anthropic' => [
			'api_key' => env('AI_ANTHROPIC_API_KEY'),
			'chat_model' => env('AI_ANTHROPIC_CHAT_MODEL', 'claude-3-5-sonnet-20241022'),
		],
	],

	'pipelines' => [
		'social_feed_recommendations' => [
			'provider' => env('AI_SOCIAL_FEED_PROVIDER', 'openai'),
			'fallback_provider' => env('AI_SOCIAL_FEED_FALLBACK_PROVIDER', 'anthropic'),
			'cache' => [
				'enabled' => (bool) env('AI_CACHE_ENABLED', true),
				'ttl' => (int) env('AI_CACHE_TTL_JOB_RECOMMENDATIONS', 3600),
			],
		],
		'mortgage_guidance' => [
			'provider' => env('AI_MORTGAGE_PROVIDER', 'openai'),
			'cache' => [
				'enabled' => (bool) env('AI_CACHE_ENABLED', true),
				'ttl' => (int) env('AI_CACHE_TTL_MORTGAGE', 900),
			],
		],
		'career_insights' => [
			'provider' => env('AI_CAREER_PROVIDER', 'openai'),
			'cache' => [
				'enabled' => (bool) env('AI_CACHE_ENABLED', true),
				'ttl' => (int) env('AI_CACHE_TTL_CAREER_INSIGHTS', 86400),
			],
		],
	],

	'observability' => [
		'log_channel' => env('AI_LOG_CHANNEL', 'stack'),
		'trace_enabled' => (bool) env('AI_TRACE_ENABLED', false),
	],
];
