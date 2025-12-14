<?php

return [
    'blocked_participant_types' => ['guardian_hold'],

    'policies' => [
        'sensitive' => [
            'description' => 'Baseline women-first guardrail for sensitive routes.',
            'requires_authenticated_user' => true,
            'requires_verified_email' => true,
            'requires_policy_acceptance' => true,
            'deny_participant_types' => ['guardian_hold'],
        ],

        'company' => [
            'extends' => 'sensitive',
            'description' => 'Employer console protections.',
            'allow_roles' => ['company'],
            'requires_company_profile' => true,
            'intent_requirements' => [
                'intent:launch_business|policy_impact',
                'portal:business',
            ],
        ],

        'candidate' => [
            'extends' => 'sensitive',
            'description' => 'Member dashboard protections.',
            // Allow both legacy 'candidate' and canonical 'member' role values
            'allow_roles' => ['candidate', 'member'],
            'intent_requirements' => [
                'intent:career_growth',
            ],
        ],
    ],
];
