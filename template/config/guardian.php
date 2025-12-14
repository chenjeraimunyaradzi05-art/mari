<?php

return [
    'male_detection' => [
        'enabled' => (bool) env('GUARDIAN_MALE_FLAGGING_ENABLED', true),
        'notify_threshold' => (float) env('GUARDIAN_MALE_FLAGGING_NOTIFY', 0.45),
        'auto_hold_threshold' => (float) env('GUARDIAN_MALE_FLAGGING_HOLD', 0.8),
        'pronoun_weights' => [
            'he_him' => 0.7,
            'he_they' => 0.65,
            'he_him_they' => 0.65,
        ],
        'name_tokens' => [
            'adam', 'aidan', 'alex', 'andrew', 'anthony', 'ben', 'brad', 'brandon', 'caleb', 'cameron', 'charles',
            'chris', 'christian', 'christopher', 'cole', 'dan', 'daniel', 'darren', 'david', 'dylan', 'ethan',
            'eric', 'george', 'greg', 'harry', 'henry', 'jack', 'james', 'jason', 'jeremy', 'john', 'jonathan',
            'jordan', 'josh', 'joshua', 'kevin', 'liam', 'luke', 'mark', 'matt', 'matthew', 'michael', 'nick',
            'nathan', 'patrick', 'paul', 'peter', 'richard', 'robert', 'ryan', 'sam', 'samuel', 'sean', 'stephen',
            'steve', 'thomas', 'tim', 'tyler', 'will', 'william', 'zac', 'zachary',
        ],
        'title_tokens' => ['mr', 'sir', 'king', 'lord'],
        'email_tokens' => ['mr', 'sir', 'man', 'boy', 'king', 'dude', 'bro', 'guy'],
        'ally_account_types' => [
            'company',
            'business_network',
            'public_sector',
            'real_estate',
            'financial_literacy',
            'tafe_university',
        ],
        'ally_account_penalty' => 0.15,
        'guardian_roles' => ['guardian', 'guardian_team'],
    ],
];
