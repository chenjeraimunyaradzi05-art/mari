<?php

$parseProviderOrder = static function (?string $value): array {
    if ($value === null) {
        return [];
    }

    return array_values(array_filter(array_map(
        static fn ($entry) => trim((string) $entry),
        explode(',', (string) $value)
    )));
};

$defaultProviderOrderString = env('WOMEN_REAL_ESTATE_AI_PROVIDER_ORDER', 'openai,anthropic');
$defaultProviderOrder = $parseProviderOrder($defaultProviderOrderString);
$personaProviderOrder = $parseProviderOrder(env('WOMEN_REAL_ESTATE_AI_PERSONA_PROVIDER_ORDER', $defaultProviderOrderString));
$listingProviderOrder = $parseProviderOrder(env('WOMEN_REAL_ESTATE_AI_LISTING_PROVIDER_ORDER', $defaultProviderOrderString));
$ownerProviderOrder = $parseProviderOrder(env('WOMEN_REAL_ESTATE_AI_OWNER_PROVIDER_ORDER', $defaultProviderOrderString));
$moderationProviderOrder = $parseProviderOrder(env('WOMEN_REAL_ESTATE_AI_MODERATION_PROVIDER_ORDER', $defaultProviderOrderString));
$mortgageProviderOrder = $parseProviderOrder(env('WOMEN_REAL_ESTATE_AI_MORTGAGE_PROVIDER_ORDER', $defaultProviderOrderString));
$partnerProviderOrder = $parseProviderOrder(env('WOMEN_REAL_ESTATE_AI_PARTNER_PROVIDER_ORDER', $defaultProviderOrderString));
$verificationProviderOrder = $parseProviderOrder(env('WOMEN_REAL_ESTATE_AI_VERIFICATION_PROVIDER_ORDER', $defaultProviderOrderString));
$widgetMortgageRoles = $parseProviderOrder(env('WOMEN_REAL_ESTATE_WIDGET_ROLES_MORTGAGE'));
$widgetRentRoles = $parseProviderOrder(env('WOMEN_REAL_ESTATE_WIDGET_ROLES_RENT'));
$widgetSafetyRoles = $parseProviderOrder(env('WOMEN_REAL_ESTATE_WIDGET_ROLES_SAFETY'));
$widgetVirtualTourRoles = $parseProviderOrder(env('WOMEN_REAL_ESTATE_WIDGET_ROLES_TOURS'));

return [
    // Cache lifetime (in seconds) for women real estate listing metrics. Set to 0 to disable caching.
    'metrics_cache_ttl' => (int) env('WOMEN_LISTING_METRICS_CACHE_TTL', 60),

    'features' => [
        'core' => (bool) env('FEATURE_WOMEN_REAL_ESTATE_CORE', false),
        'mortgage_engine' => (bool) env('FEATURE_WOMEN_REAL_ESTATE_MORTGAGE_ENGINE', false),
        'agent_verification' => (bool) env('FEATURE_WOMEN_REAL_ESTATE_AGENT_VERIFICATION', false),
        'social_amplification' => (bool) env('FEATURE_WOMEN_REAL_ESTATE_SOCIAL', false),
        'partnerships' => (bool) env('FEATURE_WOMEN_REAL_ESTATE_PARTNERSHIPS', false),
        'cohort_dashboards' => (bool) env('FEATURE_WOMEN_REAL_ESTATE_COHORT_DASHBOARDS', false),
        'partner_matching' => (bool) env('FEATURE_WOMEN_REAL_ESTATE_PARTNER_MATCHING', false),
    ],

    'dashboard' => [
        'widget_role_limits' => array_filter([
            'mortgage_tools' => $widgetMortgageRoles,
            'rent_vs_buy' => $widgetRentRoles,
            'safety_playbook' => $widgetSafetyRoles,
            'virtual_tours' => $widgetVirtualTourRoles,
        ], static fn ($roles) => is_array($roles)),
    ],

    'ai' => [
        'default_prompt_locale' => env('WOMEN_REAL_ESTATE_AI_PROMPT_LOCALE', 'en-AU'),
        'cache_ttl' => [
            'listing_insights' => (int) env('WOMEN_REAL_ESTATE_AI_CACHE_LISTING_TTL', 86_400),
            'mortgage_guidance' => (int) env('WOMEN_REAL_ESTATE_AI_CACHE_MORTGAGE_TTL', 900),
            'partner_matching' => (int) env('WOMEN_REAL_ESTATE_AI_CACHE_PARTNER_TTL', 21_600),
            'verification_summary' => (int) env('WOMEN_REAL_ESTATE_AI_CACHE_VERIFICATION_TTL', 600),
            'owner_recommendations' => (int) env('WOMEN_REAL_ESTATE_AI_CACHE_OWNER_RECOMMENDATION_TTL', 10_800),
            'moderation_review' => (int) env('WOMEN_REAL_ESTATE_AI_CACHE_MODERATION_TTL', 3_600),
            'persona_story_builder' => (int) env('WOMEN_REAL_ESTATE_AI_CACHE_PERSONA_STORY_TTL', 1_800),
            'persona_trust_coach' => (int) env('WOMEN_REAL_ESTATE_AI_CACHE_PERSONA_TRUST_TTL', 3_600),
            'persona_coaching' => (int) env('WOMEN_REAL_ESTATE_AI_CACHE_PERSONA_COACHING_TTL', 1_800),
        ],
        'persona_provider_order' => $personaProviderOrder,
        'provider_order' => $defaultProviderOrder,
        'flow_provider_order' => array_filter([
            'listing_insights' => $listingProviderOrder,
            'owner_recommendations' => $ownerProviderOrder,
            'moderation_review' => $moderationProviderOrder,
            'mortgage_guidance' => $mortgageProviderOrder,
            'partner_matching' => $partnerProviderOrder,
            'verification_summary' => $verificationProviderOrder,
            'persona_story_builder' => $personaProviderOrder,
            'persona_trust_coach' => $personaProviderOrder,
            'persona_coaching' => $personaProviderOrder,
        ]),
        'providers' => [
            'openai' => [
                'driver' => 'openai',
                'enabled' => (bool) env('WOMEN_REAL_ESTATE_AI_OPENAI_ENABLED', true),
                'timeout' => (int) env('WOMEN_REAL_ESTATE_AI_OPENAI_TIMEOUT', 8),
                'cache_overrides' => [
                    'listing_insights' => env('WOMEN_REAL_ESTATE_AI_OPENAI_CACHE_LISTING_TTL'),
                    'owner_recommendations' => env('WOMEN_REAL_ESTATE_AI_OPENAI_CACHE_OWNER_TTL'),
                    'moderation_review' => env('WOMEN_REAL_ESTATE_AI_OPENAI_CACHE_MODERATION_TTL'),
                    'persona_story_builder' => env('WOMEN_REAL_ESTATE_AI_OPENAI_CACHE_PERSONA_STORY_TTL'),
                    'persona_trust_coach' => env('WOMEN_REAL_ESTATE_AI_OPENAI_CACHE_PERSONA_TRUST_TTL'),
                    'persona_coaching' => env('WOMEN_REAL_ESTATE_AI_OPENAI_CACHE_PERSONA_COACHING_TTL'),
                ],
            ],
            'anthropic' => [
                'driver' => 'anthropic',
                'enabled' => (bool) env('WOMEN_REAL_ESTATE_AI_ANTHROPIC_ENABLED', false),
                'timeout' => (int) env('WOMEN_REAL_ESTATE_AI_ANTHROPIC_TIMEOUT', 8),
                'cache_overrides' => [
                    'listing_insights' => env('WOMEN_REAL_ESTATE_AI_ANTHROPIC_CACHE_LISTING_TTL'),
                    'owner_recommendations' => env('WOMEN_REAL_ESTATE_AI_ANTHROPIC_CACHE_OWNER_TTL'),
                    'moderation_review' => env('WOMEN_REAL_ESTATE_AI_ANTHROPIC_CACHE_MODERATION_TTL'),
                    'persona_story_builder' => env('WOMEN_REAL_ESTATE_AI_ANTHROPIC_CACHE_PERSONA_STORY_TTL'),
                    'persona_trust_coach' => env('WOMEN_REAL_ESTATE_AI_ANTHROPIC_CACHE_PERSONA_TRUST_TTL'),
                    'persona_coaching' => env('WOMEN_REAL_ESTATE_AI_ANTHROPIC_CACHE_PERSONA_COACHING_TTL'),
                ],
            ],
        ],
    ],

    'persona_profiles' => [
        'premium_threshold' => (int) env('WOMEN_REAL_ESTATE_PERSONA_PREMIUM_THRESHOLD', 80),
        'hints' => [
            'househunter' => [
                [
                    'title' => 'Clarify your safety filters',
                    'body' => 'List non-negotiables like secure entry, lighting, and neighbour expectations so agents prioritise aligned listings.',
                    'cta' => 'Add safety cues under Lifestyle',
                ],
                [
                    'title' => 'Anchor your budget story',
                    'body' => 'Share weekly rent band and what a stretch scenario looks like. This helps WomenRise surface calmer matches.',
                    'cta' => null,
                ],
                [
                    'title' => 'Timeline helps matchers',
                    'body' => 'Specify move-in windows and how firm they are. The AI nudges partners when your timeline aligns.',
                    'cta' => null,
                ],
            ],
            'agent' => [
                [
                    'title' => 'License transparency builds trust',
                    'body' => 'Add regulator, expiry and specialties so WomenRise badges you faster during verification.',
                    'cta' => 'Complete Agency Credentials',
                ],
                [
                    'title' => 'Show your care rituals',
                    'body' => 'Describe how you protect women during inspections or leasing. These signals unlock premium referrals.',
                    'cta' => null,
                ],
                [
                    'title' => 'Highlight suburb focus',
                    'body' => 'Document the suburbs and property types you live and breathe. Matching improves when this is explicit.',
                    'cta' => null,
                ],
            ],
            'student' => [
                [
                    'title' => 'Map study rhythm',
                    'body' => 'Explain course load, placement days, and support needs so housing partners respect your schedule.',
                    'cta' => 'Fill Study & Placements',
                ],
                [
                    'title' => 'Surface funding support',
                    'body' => 'Note scholarships or part-time income. WomenRise can then suggest grants and calm budgeting tools.',
                    'cta' => null,
                ],
                [
                    'title' => 'Commute realities matter',
                    'body' => 'Share campus commute times and late-night travel needs to unlock student-safe listings.',
                    'cta' => null,
                ],
            ],
            'entrepreneur' => [
                [
                    'title' => 'Frame your venture stage',
                    'body' => 'Describe current revenue, team size, and capital goals so partners surface relevant space and capital.',
                    'cta' => 'Complete Venture Profile',
                ],
                [
                    'title' => 'Explain workspace rituals',
                    'body' => 'Add how you host clients, prototype, or store stock. It helps us recommend compliant studios.',
                    'cta' => null,
                ],
                [
                    'title' => 'Document community asks',
                    'body' => 'Share which mentors, investors, or suppliers you want to meet. WomenRise routes those intros.',
                    'cta' => null,
                ],
            ],
            'default' => [
                [
                    'title' => 'Tell a richer story',
                    'body' => 'The more detail you add, the more precise WomenRise becomes at protecting your journey.',
                    'cta' => null,
                ],
            ],
        ],
    ],

    'media' => [
        'disk' => env('WOMEN_REAL_ESTATE_MEDIA_DISK', 'public'),
        'directory' => trim(env('WOMEN_REAL_ESTATE_MEDIA_DIRECTORY', 'women/listings'), '/'),
        'queue' => env('WOMEN_REAL_ESTATE_MEDIA_QUEUE', 'media'),
        'max_files_per_listing' => (int) env('WOMEN_REAL_ESTATE_MEDIA_MAX_FILES', 12),
        'allowed_mimes' => array_values(array_filter(array_map(
            static fn ($mime) => trim((string) $mime),
            explode(',', env('WOMEN_REAL_ESTATE_MEDIA_ALLOWED_MIMES', 'jpg,jpeg,png,webp,mp4,mov,pdf'))
        ))),
        'max_filesize_kb' => (int) env('WOMEN_REAL_ESTATE_MEDIA_MAX_FILESIZE_KB', 51_200),
    ],

    'social' => [
        'queue' => env('WOMEN_REAL_ESTATE_SOCIAL_QUEUE', 'notifications'),
        'default_platform' => env('WOMEN_REAL_ESTATE_SOCIAL_PLATFORM', 'womenrise_social'),
        'default_hashtags' => array_values(array_filter(array_map(
            static fn ($value) => ltrim((string) $value, '#'),
            explode(',', env('WOMEN_REAL_ESTATE_SOCIAL_HASHTAGS', 'womenrise,property,equity'))
        ))),
        'dispatch_cooldown_minutes' => (int) env('WOMEN_REAL_ESTATE_SOCIAL_COOLDOWN_MINUTES', 15),
        'dashboard_window_days' => (int) env('WOMEN_REAL_ESTATE_SOCIAL_DASHBOARD_WINDOW_DAYS', 30),
        'recent_window_days' => (int) env('WOMEN_REAL_ESTATE_SOCIAL_RECENT_WINDOW_DAYS', 7),
    ],

    'regulators' => [
        [
            'code' => 'nsw_fair_trading',
            'name' => 'NSW Fair Trading',
            'region' => 'NSW',
            'contact_url' => 'https://www.fairtrading.nsw.gov.au/',
            'license_patterns' => ['/^[A-Z]{2,3}-?\d{5,}$/i'],
        ],
        [
            'code' => 'vic_consumer_affairs',
            'name' => 'VIC Consumer Affairs',
            'region' => 'VIC',
            'contact_url' => 'https://www.consumer.vic.gov.au/',
            'license_patterns' => ['/^[A-Z]{3}-?\d{6}$/i', '/^VIC-\d{5,}$/i'],
        ],
        [
            'code' => 'qld_housing_authority',
            'name' => 'QLD Housing Authority',
            'region' => 'QLD',
            'contact_url' => 'https://www.qld.gov.au/housing',
            'license_patterns' => ['/^(QLD-)?\d{6,7}$/i'],
        ],
        [
            'code' => 'wa_consumer_protection',
            'name' => 'WA Consumer Protection',
            'region' => 'WA',
            'contact_url' => 'https://www.commerce.wa.gov.au/consumer-protection',
            'license_patterns' => ['/^(WA)?\d{5,}$/i'],
        ],
        [
            'code' => 'sa_cbs',
            'name' => 'SA Consumer and Business Services',
            'region' => 'SA',
            'contact_url' => 'https://www.cbs.sa.gov.au/',
            'license_patterns' => ['/^(SA-)?\d{6}$/i'],
        ],
        [
            'code' => 'tas_property_agents_board',
            'name' => 'TAS Property Agents Board',
            'region' => 'TAS',
            'contact_url' => 'https://www.propertyagentsboard.com.au/',
            'license_patterns' => ['/^(TAS-)?\d{5}$/i'],
        ],
        [
            'code' => 'act_access_canberra',
            'name' => 'ACT Access Canberra',
            'region' => 'ACT',
            'contact_url' => 'https://www.accesscanberra.act.gov.au/',
            'license_patterns' => ['/^(ACT-)?\d{6}$/i'],
        ],
        [
            'code' => 'nt_agents_board',
            'name' => 'NT Agents Licensing Board',
            'region' => 'NT',
            'contact_url' => 'https://nt.gov.au/',
            'license_patterns' => ['/^(NT-)?\d{5}$/i'],
        ],
    ],

    'regulator_lookup' => [
        'timeout' => (int) env('WOMEN_REAL_ESTATE_REGULATOR_TIMEOUT', 3),
        'retries' => (int) env('WOMEN_REAL_ESTATE_REGULATOR_RETRIES', 1),
        'simulate_latency_ms' => (int) env('WOMEN_REAL_ESTATE_REGULATOR_LATENCY_MS', 120),
    ],

    'compliance' => [
        'escalation_email' => env('WOMEN_REAL_ESTATE_COMPLIANCE_EMAIL'),
        'slack_webhook' => env('WOMEN_REAL_ESTATE_COMPLIANCE_SLACK_WEBHOOK'),
        'audit_export_disk' => env('WOMEN_REAL_ESTATE_COMPLIANCE_EXPORT_DISK', 'local'),
        'audit_export_path' => trim(env('WOMEN_REAL_ESTATE_COMPLIANCE_EXPORT_PATH', 'compliance/women-verification/audits'), '/'),
        'audit_retention_days' => (int) env('WOMEN_REAL_ESTATE_COMPLIANCE_EXPORT_RETENTION_DAYS', 180),
    ],

    'verification' => [
        'reviewer_roles' => array_values(array_filter(array_map(
            static fn ($value) => trim((string) $value),
            explode(',', env('WOMEN_REAL_ESTATE_VERIFICATION_REVIEWER_ROLES', 'Women Verification Reviewer'))
        ))),
        'analytics' => [
            'sla_hours' => (int) env('WOMEN_REAL_ESTATE_VERIFICATION_SLA_HOURS', 24),
            'dropout_hours' => (int) env('WOMEN_REAL_ESTATE_VERIFICATION_DROPOUT_HOURS', 72),
            'cache_ttl' => (int) env('WOMEN_REAL_ESTATE_VERIFICATION_ANALYTICS_CACHE_TTL', 300),
            'refresh_interval_ms' => (int) env('WOMEN_REAL_ESTATE_VERIFICATION_ANALYTICS_REFRESH_MS', 60000),
        ],
    ],

    'reminders' => [
        'license_expiry_windows' => array_values(array_filter(array_map(
            static fn ($value) => (int) trim($value),
            explode(',', env('WOMEN_REAL_ESTATE_EXPIRY_REMINDER_WINDOWS', '90,30,7'))
        ))),
        'queue' => env('WOMEN_REAL_ESTATE_REMINDER_QUEUE', 'notifications'),
        'throttle_hours' => (int) env('WOMEN_REAL_ESTATE_REMINDER_THROTTLE_HOURS', 24),
        'reverify_lead_days' => (int) env('WOMEN_REAL_ESTATE_REVERIFY_LEAD_DAYS', 30),
    ],

    'impact' => [
        'carbon_program' => [
            'partner' => env('WOMEN_REAL_ESTATE_IMPACT_CARBON_PARTNER', 'Rewild Australia'),
            'target_tonnes' => (float) env('WOMEN_REAL_ESTATE_IMPACT_CARBON_TARGET_TONNES', 42.0),
            'per_listing_offset_kg' => (int) env('WOMEN_REAL_ESTATE_IMPACT_CARBON_PER_LISTING_KG', 220),
        ],
        'flora_fauna' => [
            'habitat_fund_percent' => (float) env('WOMEN_REAL_ESTATE_IMPACT_HABITAT_FUND_PERCENT', 1.5),
            'native_plant_target' => (int) env('WOMEN_REAL_ESTATE_IMPACT_NATIVE_PLANT_TARGET', 12),
        ],
        'equity_framework' => [
            'priority_communities' => array_values(array_filter(array_map(
                static fn ($value) => trim((string) $value),
                explode(',', env('WOMEN_REAL_ESTATE_IMPACT_PRIORITY_COMMUNITIES', 'first_nations,lgbtqia+,single_parents'))
            ))),
            'reporting_queue' => env('WOMEN_REAL_ESTATE_IMPACT_REPORTING_QUEUE', 'impact-reports'),
        ],
    ],
];
