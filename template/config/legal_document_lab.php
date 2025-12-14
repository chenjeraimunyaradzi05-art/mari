<?php

return [
    'disclaimer' => 'Educational information only. Always obtain advice from a qualified accountant, tax agent, and lawyer before acting.',

    'storage' => [
        'disk' => env('LEGAL_DOCUMENTS_DISK', 'local'),
        'base_path' => env('LEGAL_DOCUMENTS_PATH', 'legal-documents'),
    ],

    'grant_pack_feed' => [
        'url' => env('LEGAL_LAB_GRANT_PACK_FEED_URL'),
        'timeout' => (int) env('LEGAL_LAB_GRANT_PACK_FEED_TIMEOUT', 10),
        'auto_update' => (bool) env('LEGAL_LAB_GRANT_PACK_AUTO_UPDATE', true),
        'cache_path' => env('LEGAL_LAB_GRANT_PACK_CACHE_PATH', 'legal-document-lab/grant-packs.cache.json'),
    ],

    'ai_context_logging' => [
        'enabled' => (bool) env('LEGAL_LAB_AI_CONTEXT_LOGGING', true),
        'surface' => env('LEGAL_LAB_AI_CONTEXT_SURFACE', 'legal_document_lab'),
        'context_key' => env('LEGAL_LAB_AI_CONTEXT_KEY', 'legal-document-lab'),
        'max_preview_fields' => (int) env('LEGAL_LAB_AI_CONTEXT_MAX_PREVIEW_FIELDS', 6),
    ],

    'documents' => [
        'constitution' => [
            'label' => 'Company Constitution (AU)',
            'description' => 'Baseline governance rules for Australian proprietary limited companies.',
            'wizard' => 'constitution',
            'template_view' => 'legal.templates.constitution',
            'default_format' => 'pdf',
            'export_formats' => ['pdf', 'docx'],
            'grant_tags' => ['startup', 'scale'],
            'icon' => 'gavel',
        ],
        'memorandum_of_association' => [
            'label' => 'Memorandum of Association',
            'description' => 'Legacy but still requested for certain grant programs and Commonwealth tenders.',
            'wizard' => 'memorandum',
            'template_view' => 'legal.templates.memorandum-of-association',
            'default_format' => 'pdf',
            'export_formats' => ['pdf', 'docx'],
            'grant_tags' => ['legacy', 'government'],
            'icon' => 'scroll',
        ],
        'articles_of_association' => [
            'label' => 'Articles of Association',
            'description' => 'Codify director powers, voting thresholds, and share classes.',
            'wizard' => 'articles',
            'template_view' => 'legal.templates.articles-of-association',
            'default_format' => 'pdf',
            'export_formats' => ['pdf', 'docx'],
            'grant_tags' => ['governance'],
            'icon' => 'balance-scale',
        ],
        'shareholder_agreement' => [
            'label' => 'Shareholder Agreement (Starter)',
            'description' => 'Plain-English alignment on equity, vesting, exits, and dispute paths.',
            'wizard' => 'shareholders',
            'template_view' => 'legal.templates.shareholder-agreement',
            'default_format' => 'docx',
            'export_formats' => ['pdf', 'docx'],
            'grant_tags' => ['investor_ready'],
            'icon' => 'handshake',
        ],
    ],

    'wizard' => [
        'constitution' => [
            'steps' => [
                [
                    'key' => 'company_profile',
                    'label' => 'Company profile',
                    'caption' => 'Baseline identifiers, jurisdiction, and contact anchors.',
                    'fields' => [
                        [
                            'key' => 'company_name',
                            'label' => 'Registered company name',
                            'type' => 'text',
                            'rules' => 'required|string|max:255',
                        ],
                        [
                            'key' => 'abn',
                            'label' => 'ABN / ACN',
                            'type' => 'text',
                            'rules' => 'required|string|max:32',
                        ],
                        [
                            'key' => 'registered_office',
                            'label' => 'Registered office address',
                            'type' => 'textarea',
                            'rules' => 'required|string|max:500',
                        ],
                        [
                            'key' => 'jurisdiction',
                            'label' => 'Jurisdiction',
                            'type' => 'select',
                            'options' => ['Australia', 'New Zealand', 'Other (specify in notes)'],
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'mission_statement',
                            'label' => 'Purpose / mission statement',
                            'type' => 'textarea',
                            'rules' => 'nullable|string|max:500',
                        ],
                    ],
                ],
                [
                    'key' => 'governance',
                    'label' => 'Governance & voting',
                    'caption' => 'Director powers, voting thresholds, and meeting cadence.',
                    'fields' => [
                        [
                            'key' => 'directors_required',
                            'label' => 'Minimum directors',
                            'type' => 'number',
                            'rules' => 'required|integer|min:1|max:10',
                        ],
                        [
                            'key' => 'quorum',
                            'label' => 'Board quorum (percentage)',
                            'type' => 'number',
                            'rules' => 'required|integer|min:50|max:100',
                        ],
                        [
                            'key' => 'voting_threshold',
                            'label' => 'Special resolution threshold',
                            'type' => 'select',
                            'options' => ['50% + 1', '66%', '75%', 'Unanimous'],
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'meeting_frequency',
                            'label' => 'Meeting frequency',
                            'type' => 'select',
                            'options' => ['Monthly', 'Quarterly', 'Ad hoc'],
                            'rules' => 'required|string',
                        ],
                    ],
                ],
                [
                    'key' => 'share_capital',
                    'label' => 'Share capital',
                    'caption' => 'Share classes, issue limits, and transfer rules.',
                    'fields' => [
                        [
                            'key' => 'share_classes',
                            'label' => 'Share classes',
                            'type' => 'textarea',
                            'placeholder' => 'e.g. Ordinary (voting), Founder (vesting), Preference (non-voting)…',
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'preemptive_rights',
                            'label' => 'Pre-emptive rights',
                            'type' => 'select',
                            'options' => ['Enabled (all classes)', 'Enabled (ordinary only)', 'Disabled'],
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'transfer_controls',
                            'label' => 'Transfer controls',
                            'type' => 'textarea',
                            'rules' => 'nullable|string',
                        ],
                    ],
                ],
            ],
        ],
        'memorandum' => [
            'steps' => [
                [
                    'key' => 'objectives',
                    'label' => 'Objects & scope',
                    'caption' => 'List the core business objects requested by funders.',
                    'fields' => [
                        [
                            'key' => 'primary_object',
                            'label' => 'Primary object',
                            'type' => 'textarea',
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'secondary_objects',
                            'label' => 'Supporting objects',
                            'type' => 'textarea',
                            'rules' => 'nullable|string',
                        ],
                    ],
                ],
                [
                    'key' => 'liability',
                    'label' => 'Liability & capital',
                    'caption' => 'State whether member liability is limited or guaranteed.',
                    'fields' => [
                        [
                            'key' => 'member_liability',
                            'label' => 'Member liability',
                            'type' => 'select',
                            'options' => ['Limited by shares', 'Limited by guarantee', 'Unlimited'],
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'capital_commitment',
                            'label' => 'Capital commitment',
                            'type' => 'textarea',
                            'rules' => 'nullable|string',
                        ],
                    ],
                ],
            ],
        ],
        'articles' => [
            'steps' => [
                [
                    'key' => 'board_rules',
                    'label' => 'Board rules',
                    'caption' => 'How directors are appointed, removed, and compensated.',
                    'fields' => [
                        [
                            'key' => 'appointment_process',
                            'label' => 'Director appointment process',
                            'type' => 'textarea',
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'removal_process',
                            'label' => 'Removal process',
                            'type' => 'textarea',
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'director_fees',
                            'label' => 'Director fee policy',
                            'type' => 'textarea',
                            'rules' => 'nullable|string',
                        ],
                    ],
                ],
                [
                    'key' => 'member_rights',
                    'label' => 'Member rights',
                    'caption' => 'Voting, notices, dividends, and dispute resolution.',
                    'fields' => [
                        [
                            'key' => 'dividend_policy',
                            'label' => 'Dividend policy',
                            'type' => 'textarea',
                            'rules' => 'nullable|string',
                        ],
                        [
                            'key' => 'notice_period',
                            'label' => 'Meeting notice period (days)',
                            'type' => 'number',
                            'rules' => 'required|integer|min:7|max:60',
                        ],
                        [
                            'key' => 'dispute_resolution',
                            'label' => 'Dispute resolution steps',
                            'type' => 'textarea',
                            'rules' => 'nullable|string',
                        ],
                    ],
                ],
            ],
        ],
        'shareholders' => [
            'steps' => [
                [
                    'key' => 'cap_table',
                    'label' => 'Cap table snapshot',
                    'caption' => 'Equity, vesting, and founder roles.',
                    'fields' => [
                        [
                            'key' => 'founder_equity',
                            'label' => 'Founders & equity split',
                            'type' => 'textarea',
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'vesting_terms',
                            'label' => 'Vesting terms',
                            'type' => 'textarea',
                            'rules' => 'nullable|string',
                        ],
                        [
                            'key' => 'esop_pool',
                            'label' => 'ESOP / option pool %',
                            'type' => 'number',
                            'rules' => 'nullable|numeric|min:0|max:40',
                        ],
                    ],
                ],
                [
                    'key' => 'governance',
                    'label' => 'Governance triggers',
                    'caption' => 'Drag/tag rights, information rights, and acceleration rules.',
                    'fields' => [
                        [
                            'key' => 'information_rights',
                            'label' => 'Information rights',
                            'type' => 'textarea',
                            'rules' => 'required|string',
                        ],
                        [
                            'key' => 'drag_tag',
                            'label' => 'Drag/tag-along rules',
                            'type' => 'textarea',
                            'rules' => 'nullable|string',
                        ],
                        [
                            'key' => 'exit_provisions',
                            'label' => 'Exit & change-of-control provisions',
                            'type' => 'textarea',
                            'rules' => 'nullable|string',
                        ],
                    ],
                ],
            ],
        ],
    ],

    'grant_packs' => [
        'boosting-female-founders' => [
            'name' => 'Boosting Female Founders',
            'summary' => 'Bundle tailored to the Australian Federal Boosting Female Founders program.',
            'documents' => ['constitution', 'shareholder_agreement'],
            'includes' => [
                'Impact-focused constitution clause pack',
                'Founder vesting schedule appendix',
                'Grant-ready cover letter shell',
            ],
            'value_proposition' => 'Highlights gender equality KPIs and impact reporting language required by the grant.',
        ],
        'indigenous-women-microgrants' => [
            'name' => 'Indigenous Women Micro-grants',
            'summary' => 'Templates emphasising community benefit statements and cultural governance.',
            'documents' => ['memorandum_of_association', 'articles_of_association'],
            'includes' => [
                'Community governance addendum',
                'Cultural safety board charter excerpt',
            ],
            'value_proposition' => 'Builds trust with funders by centring First Nations ownership structures.',
        ],
        'stem-accelerator' => [
            'name' => 'STEM Accelerator Pack',
            'summary' => 'Investor-style share framework geared for STEM commercialisation grants.',
            'documents' => ['shareholder_agreement'],
            'includes' => [
                'IP assignment acknowledgement',
                'Convertible note + option summary page',
            ],
            'value_proposition' => 'Positions the company as capital-ready with clean IP chain-of-title.',
        ],
    ],
];
