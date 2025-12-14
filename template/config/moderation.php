<?php

return [
	// Provider: local | openai | aws | google | none
	'provider' => env('MODERATION_PROVIDER', 'local'),

	// Provider-specific configuration
	'openai' => [
		'api_key' => env('OPENAI_API_KEY'),
		'base_url' => env('OPENAI_API_BASE', 'https://api.openai.com/v1'),
		'model' => env('OPENAI_MODERATION_MODEL', 'omni-moderation-latest'),
		'timeout' => 5,
	],

	// Categories to classify reports and moderation decisions
	'categories' => [
		'harassment',
		'hate_speech',
		'spam',
		'adult_content',
		'self_harm',
		'misinformation',
		'privacy',
	],

	// Severity weights used by policy engine
	'severity_weights' => [
		'none' => 0,
		'low' => 1,
		'medium' => 2,
		'high' => 3,
		'critical' => 4,
	],

	// Recommended action mapping by severity
	'severity_actions' => [
		'none' => 'allow',
		'low' => 'allow',
		'medium' => 'queue_review',
		'high' => 'block',
		'critical' => 'block',
	],

	// Combined dictionaries (merge curated terms here)
	'dictionaries' => [
		'block' => [
			// NOTE: these are example entries used by tests; in production this list
			// should be curated and stored in a secure source or feature-flagged service.
			'kill yourself' => 'critical',
			'kill you' => 'high',
			'rape' => 'critical',
			'bitch' => 'medium',
			'fag' => 'high',
			'blood oath' => 'high',
			'hate crime' => 'high',
		],
	],

	// Additional operational configuration for moderation functionality
	'login_alerts' => [
		'notify_on_new_device' => true,
		'notify_on_geo_anomaly' => true,
		'channels' => ['mail'],
	],
];
