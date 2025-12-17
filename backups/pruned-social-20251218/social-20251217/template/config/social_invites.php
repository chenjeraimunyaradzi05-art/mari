<?php

return [
    'throttle' => [
        'per_day' => env('SOCIAL_INVITES_PER_DAY', 50),
        'per_month' => env('SOCIAL_INVITES_PER_MONTH', 200),
        'contact_sync_per_day' => env('CONTACT_SYNC_PER_DAY', 4),
    ],

    'default_channel' => 'email',

    'contact_sync' => [
        'hash_salt' => env('CONTACT_SYNC_HASH_SALT'),
        'contact_ttl_days' => env('CONTACT_SYNC_TTL_DAYS', 30),
        'providers' => [
            'google' => [
                'display_name' => 'Google Contacts',
                'scopes' => ['https://www.googleapis.com/auth/contacts.readonly'],
            ],
            'outlook' => [
                'display_name' => 'Outlook / Microsoft',
                'scopes' => ['https://graph.microsoft.com/Contacts.Read'],
            ],
        ],
    ],

    'templates' => [
        'mentor_intro' => [
            'label' => 'Mentor Introduction',
            'type' => 'mentor_connection',
            'default_message' => 'I would love to open up a mentorship lane with you—let’s trade notes and set up our first chat.',
            'nudge_offsets' => [24, 72], // hours
            'onboarding' => [
                'resource_bundle' => [
                    'title' => 'Mentorship welcome kit',
                    'links' => [
                        'https://womenrise.local/mentor-playbook',
                        'https://womenrise.local/check-in-template',
                    ],
                ],
                'check_in_days' => 14,
            ],
        ],
        'mentee_cohort' => [
            'label' => 'Cohort Placement',
            'type' => 'cohort_invite',
            'default_message' => 'Your energy would lift our mentorship cohort. Join us to unlock office hours, cohorts, and live accountability.',
            'nudge_offsets' => [12, 48],
            'onboarding' => [
                'resource_bundle' => [
                    'title' => 'Cohort starter resources',
                    'links' => [
                        'https://womenrise.local/cohort-guide',
                        'https://womenrise.local/win-tracker',
                    ],
                ],
                'check_in_days' => 10,
            ],
        ],
        'office_hours' => [
            'label' => 'Office Hours Drop-In',
            'type' => 'office_hours',
            'default_message' => 'Pop into my office hours so we can unblock your next move—slots are casual but focused.',
            'nudge_offsets' => [6, 24],
            'onboarding' => [
                'resource_bundle' => [
                    'title' => 'Office hours prep list',
                    'links' => [
                        'https://womenrise.local/office-hours-kit',
                    ],
                ],
                'check_in_days' => 7,
            ],
        ],
    ],
];
