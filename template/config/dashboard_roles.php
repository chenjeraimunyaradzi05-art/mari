<?php

use App\DataTransferObjects\Dashboards\KeyedDashboardWidgetData;
use App\DataTransferObjects\Dashboards\Widgets\CandidateCareerPulseData;
use App\DataTransferObjects\Dashboards\Widgets\CandidateOpportunityStreamData;
use App\DataTransferObjects\Dashboards\Widgets\CandidatePathwayProgressData;
use App\DataTransferObjects\Dashboards\Widgets\CandidatePersonaEchoData;
use App\DataTransferObjects\Dashboards\Widgets\CandidateWellbeingSnapshotData;
use App\DataTransferObjects\Dashboards\Widgets\CompanyEquityComplianceData;
use App\DataTransferObjects\Dashboards\Widgets\CompanyRequisitionHealthData;

return [
    'cache' => [
        'default_ttl' => 300,
        'key_prefix' => 'role-dashboard',
    ],

    'roles' => [
        'member' => [
            'title' => 'Member Mission Control',
            'description' => 'Track applications, pathways, mentors, and wellbeing signals.',
            'feature_flag' => 'candidate_dashboard_v1',
            'cache_ttl' => 180,
            'widgets' => [
                'candidate_career_pulse',
                'candidate_persona_echo',
                'candidate_pathway_progress',
                'candidate_opportunity_stream',
                'candidate_wellbeing_snapshot',
            ],
            'design_reference' => null,
        ],

        // 'candidate' role removed - 'member' is canonical for this persona
        'company' => [
            'title' => 'Employer Talent Command',
            'description' => 'Monitor requisitions, pipeline velocity, and equity compliance.',
            'feature_flag' => 'company_dashboard_v1',
            'cache_ttl' => 180,
            'widgets' => [
                'company_requisition_health',
                'company_equity_snapshot',
            ],
            'design_reference' => null,
        ],
        'public_sector' => [
            'title' => 'Public Sector Impact',
            'description' => 'Surface grants, civic missions, and policy alerts.',
            'feature_flag' => 'public_sector_dashboard_v1',
            'cache_ttl' => 300,
            'widgets' => [
                'public_sector_playbook',
                'public_sector_opportunity_radar',
                'public_sector_engagements',
            ],
            'design_reference' => null,
        ],
        'mentor' => [
            'title' => 'Mentor Guidance Hub',
            'description' => 'Stay ahead of mentee check-ins and trust tasks.',
            'feature_flag' => 'mentor_dashboard_v1',
            'cache_ttl' => 300,
            'widgets' => [
                'mentor_session_pipeline',
                'mentor_relationship_health',
            ],
            'design_reference' => null,
        ],
        'tafe_university' => [
            'title' => 'TAFE & University Operations',
            'description' => 'Manage cohorts, placements, and wraparound services.',
            'feature_flag' => 'education_dashboard_v1',
            'cache_ttl' => 300,
            'widgets' => [
                'education_program_health',
                'education_ai_recommendations',
            ],
            'design_reference' => null,
        ],
        'business_network' => [
            'title' => 'Business Network Exchange',
            'description' => 'Monitor partner deals, referrals, and supplier trust.',
            'feature_flag' => 'business_network_dashboard_v1',
            'cache_ttl' => 300,
            'widgets' => [
                'business_momentum_snapshot',
                'business_community_pulse',
            ],
            'design_reference' => null,
        ],
        'real_estate' => [
            'title' => 'Real Estate Safety Desk',
            'description' => 'Track housing matches, DV-safe alerts, and compliance.',
            'feature_flag' => 'real_estate_dashboard_v1',
            'cache_ttl' => 300,
            'widgets' => [
                'real_estate_pipeline_overview',
                'real_estate_safety_compliance',
            ],
            'design_reference' => null,
        ],
        'trades' => [
            'title' => 'Trades & Apprenticeships Ops',
            'description' => 'Surface placements, equipment financing, and safety.',
            'feature_flag' => 'trades_dashboard_v1',
            'cache_ttl' => 300,
            'widgets' => [
                'trades_apprenticeship_view',
                'trades_equipment_financing',
            ],
            'design_reference' => null,
        ],
        'financial_literacy' => [
            'title' => 'Financial Literacy Observatory',
            'description' => 'Show savings milestones, bundle pilots, and workshop flow.',
            'feature_flag' => 'financial_dashboard_v1',
            'cache_ttl' => 300,
            'widgets' => [
                'financial_savings_milestones',
                'financial_workshop_flow',
                'tax_returnable_assets',
                'receipts_and_logbook',
            ],
            'design_reference' => null,
        ],
    ],

    'widgets' => [
        'candidate_career_pulse' => [
            'dto' => CandidateCareerPulseData::class,
            'resolver' => 'buildCandidateCareerPulse',
            'telemetry_event' => 'candidate_career_pulse_rendered',
            'cache_ttl' => 180,
        ],
        'candidate_persona_echo' => [
            'dto' => CandidatePersonaEchoData::class,
            'resolver' => 'buildCandidatePersonaEcho',
            'telemetry_event' => 'candidate_persona_echo_rendered',
            'cache_ttl' => 600,
        ],
        'candidate_pathway_progress' => [
            'dto' => CandidatePathwayProgressData::class,
            'resolver' => 'buildCandidatePathwayProgress',
            'telemetry_event' => 'candidate_pathway_progress_rendered',
            'cache_ttl' => 120,
        ],
        'candidate_opportunity_stream' => [
            'dto' => CandidateOpportunityStreamData::class,
            'resolver' => 'buildCandidateOpportunityStream',
            'telemetry_event' => 'candidate_opportunity_stream_rendered',
            'cache_ttl' => 180,
        ],
        'candidate_wellbeing_snapshot' => [
            'dto' => CandidateWellbeingSnapshotData::class,
            'resolver' => 'buildCandidateWellbeingSnapshot',
            'telemetry_event' => 'candidate_wellbeing_snapshot_rendered',
            'cache_ttl' => 900,
        ],
        'company_requisition_health' => [
            'dto' => CompanyRequisitionHealthData::class,
            'resolver' => 'buildCompanyRequisitionHealth',
            'telemetry_event' => 'company_requisition_health_rendered',
            'cache_ttl' => 300,
        ],
        'company_equity_snapshot' => [
            'dto' => CompanyEquityComplianceData::class,
            'resolver' => 'buildCompanyEquitySnapshot',
            'telemetry_event' => 'company_equity_snapshot_rendered',
            'cache_ttl' => 900,
        ],
        'public_sector_playbook' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildPublicSectorPlaybook',
            'telemetry_event' => 'public_sector_playbook_rendered',
            'cache_ttl' => 600,
        ],
        'public_sector_opportunity_radar' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildPublicSectorOpportunityRadar',
            'telemetry_event' => 'public_sector_opportunity_radar_rendered',
            'cache_ttl' => 300,
        ],
        'public_sector_engagements' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildPublicSectorEngagements',
            'telemetry_event' => 'public_sector_engagements_rendered',
            'cache_ttl' => 300,
        ],
        'mentor_session_pipeline' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildMentorSessionPipeline',
            'telemetry_event' => 'mentor_session_pipeline_rendered',
            'cache_ttl' => 180,
        ],
        'mentor_relationship_health' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildMentorRelationshipHealth',
            'telemetry_event' => 'mentor_relationship_health_rendered',
            'cache_ttl' => 600,
        ],
        'education_program_health' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildEducationProgramHealth',
            'telemetry_event' => 'education_program_health_rendered',
            'cache_ttl' => 300,
        ],
        'education_ai_recommendations' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildEducationAiRecommendations',
            'telemetry_event' => 'education_ai_recommendations_rendered',
            'cache_ttl' => 600,
        ],
        'business_momentum_snapshot' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildBusinessMomentumSnapshot',
            'telemetry_event' => 'business_momentum_snapshot_rendered',
            'cache_ttl' => 300,
        ],
        'business_community_pulse' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildBusinessCommunityPulse',
            'telemetry_event' => 'business_community_pulse_rendered',
            'cache_ttl' => 300,
        ],
        'real_estate_pipeline_overview' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildRealEstatePipelineOverview',
            'telemetry_event' => 'real_estate_pipeline_overview_rendered',
            'cache_ttl' => 300,
        ],
        'real_estate_safety_compliance' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildRealEstateSafetyCompliance',
            'telemetry_event' => 'real_estate_safety_compliance_rendered',
            'cache_ttl' => 600,
        ],
        'trades_apprenticeship_view' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildTradesApprenticeshipView',
            'telemetry_event' => 'trades_apprenticeship_view_rendered',
            'cache_ttl' => 300,
        ],
        'trades_equipment_financing' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildTradesEquipmentFinancing',
            'telemetry_event' => 'trades_equipment_financing_rendered',
            'cache_ttl' => 600,
        ],
        'financial_savings_milestones' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildFinancialSavingsMilestones',
            'telemetry_event' => 'financial_savings_milestones_rendered',
            'cache_ttl' => 300,
        ],
        'financial_workshop_flow' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildFinancialWorkshopFlow',
            'telemetry_event' => 'financial_workshop_flow_rendered',
            'cache_ttl' => 600,
        ],
        'tax_returnable_assets' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildTaxReturnableAssets',
            'telemetry_event' => 'tax_returnable_assets_rendered',
            'cache_ttl' => 300,
        ],
        'receipts_and_logbook' => [
            'dto' => KeyedDashboardWidgetData::class,
            'resolver' => 'buildReceiptsAndLogbook',
            'telemetry_event' => 'receipts_and_logbook_rendered',
            'cache_ttl' => 300,
        ],
    ],
];
