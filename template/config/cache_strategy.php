<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cache Strategy Configuration
    |--------------------------------------------------------------------------
    |
    | This file defines the caching strategy for various parts of the application.
    | Each key represents a cacheable entity or feature, and defines its
    | Time To Live (TTL) in seconds and associated tags for invalidation.
    |
    */

    'user_profile' => ['ttl' => 3600, 'tags' => ['users']],
    'job_listings' => ['ttl' => 900, 'tags' => ['jobs']],
    'course_catalog' => ['ttl' => 1800, 'tags' => ['courses']],
    'housing_listings' => ['ttl' => 1800, 'tags' => ['housing']],
    'grants' => ['ttl' => 7200, 'tags' => ['grants']],
    'pathways' => ['ttl' => 3600, 'tags' => ['pathways']],
    'social_feed' => ['ttl' => 300, 'tags' => ['social']],
    'analytics' => ['ttl' => 600, 'tags' => ['analytics']],
    'bundle_offers' => ['ttl' => 3600, 'tags' => ['money', 'bundles']],
    'wellness_plans' => ['ttl' => 86400, 'tags' => ['wellness']],
];
