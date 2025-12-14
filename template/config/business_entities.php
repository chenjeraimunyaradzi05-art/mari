<?php

return [
    'scan_disk_templates' => (bool) env('BUSINESS_TEMPLATES_SCAN_DISK', true),
    'entities' => [
        'sole_trader' => [
            'label' => 'Sole Trader',
            'summary' => 'Fastest path to trading under your own name with minimal registrations.',
            'liability' => 'Unlimited personal liability (protect with insurance).',
            'liability_risk' => 'Personal exposure',
            'compliance' => 'Low admin: ABN + simple record keeping.',
            'compliance_level' => 'Low effort',
            'gst' => [
                'treatment' => 'Register once turnover exceeds $75k. GST is tied to your personal TFN.',
                'reporting' => 'Quarterly BAS recommended; monthly if cashflow is volatile.',
                'method' => 'Cash basis keeps things simple – lodge only when money moves.',
            ],
            'tax_rate' => 'Personal marginal tax rates up to 45%.',
            'setup_cost' => 'ABN registration is free; business name ~$42/1yr.',
            'setup_cost_value' => 100,
            'funding_friendliness' => 'Bootstrapped or micro-grants only.',
            'pros' => [
                'Complete control and flexible decision making.',
                'Simplest bookkeeping, perfect for testing an idea.',
                'All profits flow directly to you.',
            ],
            'cons' => [
                'Personal assets exposed to business debts.',
                'Harder to raise capital or add co-founders.',
                'High marginal tax once profits climb.',
            ],
            'best_for' => ['Freelancers', 'Consultants', 'Pre-seed ideas'],
        ],
        'company' => [
            'label' => 'Company (Pty Ltd)',
            'summary' => 'Separate legal entity designed for scaling, investors, and teams.',
            'liability' => 'Limited liability when directors comply with duties.',
            'liability_risk' => 'Limited liability',
            'compliance' => 'ASIC filings, payroll, director obligations, annual reviews.',
            'compliance_level' => 'High effort',
            'gst' => [
                'treatment' => 'GST is reported under the company ABN and can be split by business units.',
                'reporting' => 'Monthly BAS if turnover > $20M; quarterly for most founders.',
                'method' => 'Accrual basis if you issue invoices before payment; cash basis optional if revenue < $10M.',
            ],
            'tax_rate' => '25% small business rate (base rate entities) or 30% standard.',
            'setup_cost' => '$1,000–$3,000 setup + ASIC annual review ($310).',
            'setup_cost_value' => 1500,
            'funding_friendliness' => 'VC, grants, and banking ready.',
            'pros' => [
                'Protects personal assets and supports multiple shareholders.',
                'Attractive to investors and grant providers.',
                'Company tax rate often lower than top marginal rate.',
            ],
            'cons' => [
                'Requires payroll, director minutes, and ASIC upkeep.',
                'More expensive to wind down or restructure.',
                'Profits trapped unless paid as wages/dividends.',
            ],
            'best_for' => ['Employers', 'Investor-backed startups', 'IP heavy ventures'],
        ],
        'partnership' => [
            'label' => 'Partnership',
            'summary' => 'Two or more people sharing profits under a partnership agreement.',
            'liability' => 'Partners are jointly liable – one mistake can impact all.',
            'liability_risk' => 'Shared risk',
            'compliance' => 'Partnership TFN/ABN + annual partnership tax return.',
            'compliance_level' => 'Moderate effort',
            'gst' => [
                'treatment' => 'GST tracked at the partnership level; distribute credits between partners.',
                'reporting' => 'Quarterly BAS (monthly if high activity).',
                'method' => 'Usually cash basis to keep drawings simple.',
            ],
            'tax_rate' => 'Profits distributed to partners and taxed at their rates.',
            'setup_cost' => '$300–$900 for agreements + registrations.',
            'setup_cost_value' => 600,
            'funding_friendliness' => 'Bank loans possible with personal guarantees.',
            'pros' => [
                'Shared workload and complementary skills.',
                'Each partner handles their own tax bill.',
                'Great for professional services collectives.',
            ],
            'cons' => [
                'Hard to exit or introduce new partners.',
                'Joint liability can strain relationships.',
                'Requires a strong, updated partnership agreement.',
            ],
            'best_for' => ['Professional practices', 'Joint ventures', 'Family businesses'],
        ],
        'trust' => [
            'label' => 'Discretionary Trust',
            'summary' => 'Trustee holds assets for beneficiaries with flexible income distributions.',
            'liability' => 'Trustee liable; corporate trustee reduces personal exposure.',
            'liability_risk' => 'Trustee controlled',
            'compliance' => 'Trust deed, annual resolutions, dedicated bank account, TFN/ABN.',
            'compliance_level' => 'High effort',
            'gst' => [
                'treatment' => 'Trust registers for GST once turnover hits $75k.',
                'reporting' => 'Quarterly BAS with annual end-of-year trust distribution minutes.',
                'method' => 'Accrual if royalties/rent; cash acceptable for small trading trusts.',
            ],
            'tax_rate' => 'Beneficiaries taxed at their marginal rates; undistributed income at top marginal + penalty.',
            'setup_cost' => '$1,500–$4,000 incl. deed + corporate trustee.',
            'setup_cost_value' => 2500,
            'funding_friendliness' => 'Great for asset-backed lending + family offices.',
            'pros' => [
                'Strong asset protection when managed well.',
                'Income streaming to family members within ATO rules.',
                'Common for holding IP or investments.',
            ],
            'cons' => [
                'High setup + advisory costs.',
                'Complex record keeping and minutes.',
                'Banks often request personal guarantees anyway.',
            ],
            'best_for' => ['Family-run groups', 'Asset holding', 'Franchises'],
        ],
    ],

    'templates' => [
        [
            'label' => 'Founder Service Agreement',
            'slug' => 'founder-service-agreement',
            'path' => 'templates/business/founder-service-agreement.md',
            'jurisdiction' => 'AU',
            'complexity' => 'Medium',
            'updated_at' => '2025-10-15',
            'timeframes' => ['monthly', 'quarterly', 'yearly'],
            'prerequisites' => [
                'Founders share ABN + ASIC Director IDs',
                'Equity split + vesting intentions drafted',
            ],
        ],
        [
            'label' => 'Partnership Heads of Agreement',
            'slug' => 'partnership-hoa',
            'path' => 'templates/business/partnership-hoa.md',
            'jurisdiction' => 'AU',
            'complexity' => 'Low',
            'updated_at' => '2025-09-02',
            'timeframes' => ['monthly', 'quarterly'],
            'prerequisites' => [
                'Partners confirm TFNs + capital contributions',
                'Nominate BAS lodgement partner',
            ],
        ],
        [
            'label' => 'Company Constitution (Starter)',
            'slug' => 'company-constitution-starter',
            'path' => 'templates/business/company-constitution-starter.md',
            'jurisdiction' => 'AU',
            'complexity' => 'High',
            'updated_at' => '2025-08-28',
            'timeframes' => ['quarterly', 'yearly'],
            'prerequisites' => [
                'ASIC Form 201 drafted with share classes',
                'Directors hold Director IDs + minutes template',
            ],
        ],
        [
            'label' => 'Shareholders Agreement (Starter)',
            'slug' => 'shareholders-agreement-starter',
            'path' => 'templates/business/shareholders-agreement-starter.md',
            'jurisdiction' => 'AU',
            'complexity' => 'High',
            'updated_at' => '2025-10-01',
            'timeframes' => ['quarterly', 'yearly'],
            'prerequisites' => [
                'Cap table draft with share classes + vesting',
                'Directors agree on dispute + exit mechanics',
            ],
        ],
        [
            'label' => 'GST & BAS Checklist',
            'slug' => 'gst-bas-checklist',
            'path' => 'templates/business/gst-bas-checklist.md',
            'jurisdiction' => 'AU',
            'complexity' => 'Low',
            'updated_at' => '2025-11-10',
            'timeframes' => ['weekly', 'monthly', 'quarterly'],
            'prerequisites' => [
                'Accounting software access (Xero/MYOB)',
                'ATO Business Portal login enabled',
            ],
        ],
        [
            'label' => 'Privacy Policy (Australia)',
            'slug' => 'privacy-policy-au',
            'path' => 'templates/business/privacy-policy-au.md',
            'jurisdiction' => 'AU',
            'complexity' => 'Medium',
            'updated_at' => '2025-09-18',
            'timeframes' => ['monthly', 'quarterly', 'yearly'],
            'prerequisites' => [
                'Document data handling map for products/services',
                'Identify privacy officer + contact address',
            ],
        ],
    ],

    'ai_prompts' => [
        'founders_agreement' => [
            'label' => 'Draft a founders agreement',
            'prompt' => <<<'PROMPT'
You are Athena AI, drafting a plain-English founders agreement outline.
Context:
- Entity type: %s
- Co-founders: %s
- Equity split: %s
- Key risks/notes: %s

Tasks:
1. Summarise decision-making + voting.
2. List vesting schedule and cliff.
3. Highlight dispute and exit process.
4. Insert disclaimer reminding them to seek legal advice.
PROMPT,
        ],
        'partnership_loi' => [
            'label' => 'Prepare a partnership LOI',
            'prompt' => <<<'PROMPT'
Create a Letter of Intent for a partnership.
Include:
- Parties + ABNs
- Purpose + scope of collaboration
- Contributions + responsibilities
- Profit share + drawings
- GST + BAS obligations (who lodges)
- Confidentiality + dispute steps
Add a closing paragraph advising the parties to obtain independent legal and tax advice.
PROMPT,
        ],
        'bas_summary' => [
            'label' => 'Explain my BAS',
            'prompt' => <<<'PROMPT'
Summarise this BAS period for a founder:
- GST collected on sales: %s
- GST paid on purchases: %s
- PAYG withholding: %s
- Fuel tax credits or adjustments: %s
Provide: net GST payable/refundable, reminders about due dates, and a friendly explanation of the GST clearing account entry to close the BAS. Finish with "Informational only – confirm with your accountant.".
PROMPT,
        ],
    ],

    'disclaimer' => 'Educational information only. Always obtain advice from a qualified accountant, tax agent, and lawyer before acting.',
];
