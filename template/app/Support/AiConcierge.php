<?php

namespace App\Support;

use Illuminate\Support\Arr;

final class AiConcierge
{
    private const FEATURED_CONTEXT_KEYS = [
        'money-budgeting-education',
        'mobility-ai-guide',
        'housing-mortgage-education',
        'business-legal-foundations',
        'wellness-money-calm',
        'wellbeing-fitness',
        'women-marketplace',
    ];

    /**
     * Context metadata describing all supported concierge entry points.
     *
     * @return string[][]
     *
     * @psalm-return array{'money-budgeting-education': array{title: 'Money calm coach', badge: 'Money', guardrails: 'Educational reflections about budgeting, subscriptions, and calm spending habits. Not financial advice.', placeholder: 'Could you walk me through trimming two software subscriptions gently?', summary: 'Talk through subscriptions, budgets, or debt trade-offs without judgement.'}, 'sole-trader-statements': array{title: 'Debt & statement explainer', badge: 'Business', guardrails: 'Helps you reflect on trade-offs. Does not recommend lenders, products, or tax moves.', placeholder: 'What does net profit vs cash flow mean for my studio?', summary: 'Explains sole-trader statements, cash flow vs profit, and light bookkeeping terms.'}, 'bank-feed-triage': array{title: 'Bank feed triage coach', badge: 'Money', guardrails: 'Summarises transaction patterns without suggesting providers or making credit decisions.', placeholder: 'Help me understand these flagged software transactions kindly.', summary: 'Gives friendly language for what your transaction list is showing.'}, 'mobility-ai-guide': array{title: 'Mobility & car buying coach', badge: 'Mobility', guardrails: 'Educational reflections about transport trade-offs, DV-safe travel planning, and dealership scripts. Not lending or insurance advice.', placeholder: 'Can you help me compare a safe used SUV with a hybrid salary-packaged option?', summary: 'Pairs car research, safety checklists, and budget prompts so women never negotiate alone.'}, 'housing-mortgage-education': array{title: 'Housing & mortgage explainer', badge: 'Housing', guardrails: 'Educational reflections about renting vs buying, repayments, and housing rights. Not lending or real-estate advice.', placeholder: 'Can you outline the trade-off between renting now vs saving longer for a deposit?', summary: 'Covers repayments, housing affordability, safety checklists, and calm next steps.'}, 'business-legal-foundations': array{title: 'Business & legal foundations', badge: 'Legal', guardrails: 'Plain-language education about structures, templates, and compliance. Not legal or tax advice.', placeholder: 'What should I think about before switching from sole trader to a company?', summary: 'Explains structures, contracts, grants, and compliance questions in warm language.'}, 'wellbeing-fitness': array{title: 'Wellbeing & Vipassana reflections', badge: 'Wellness', guardrails: 'Educational reflections only. Not medical, psychological, or therapeutic advice.', placeholder: 'How can I pace a women-only Vipassana sit if I have low energy?', summary: 'Talk through meditation, nervous system care, and gentle movement ideas.'}, 'wellness-money-calm': array{title: 'Wellness + money calm', badge: 'Wellness', guardrails: 'Educational reflections blending nervous system care with financial literacy. Not medical, mental health, or financial advice.', placeholder: 'I tense up before checking statements. Can you script a calm ritual first?', summary: 'Connects breathwork, reflection prompts, and Money Inbox nudges for calmer budgeting.'}, 'wellness-circle-plans': array{title: 'Care circle ritual designer', badge: 'Community', guardrails: 'Educational prompts for peer circles and stipends. Not legal, HR, or therapeutic advice.', placeholder: 'Draft a fortnightly ritual for our founders group that respects low energy weeks.', summary: 'Generates agendas, accountability prompts, and stipend-ready plans for teams or pods.'}, 'wellness-mobility-support': array{title: 'Mobility recovery stack', badge: 'Wellness', guardrails: 'Educational reflections only. Not physiotherapy, medical, or financial advice.', placeholder: 'Help me sync physio rest days with the mobility fund timeline.', summary: 'Links rehab pacing, transport plans, and mobility concierge notes into one briefing.'}, 'wellness-fast-hand-off': array{title: 'Rapid wellness hand-off', badge: 'Support', guardrails: 'Shares grounding prompts and referral checklists. Not crisis counselling or medical advice.', placeholder: 'I need to reset after a tough shift and know who to loop in tomorrow.', summary: 'Wraps quick grounding scripts with the next best Athena context or human channel.'}, 'women-marketplace': array{title: 'Marketplace concierge', badge: 'Marketplace', guardrails: 'Summarises listings and shares reflective shopping prompts. Not medical, legal, or financial advice.', placeholder: 'Compare two trauma-aware studios in Melbourne that include childcare?', summary: 'Helps weigh up marketplace listings, perks, and access needs noted in Problem Map research.'}, 'health-insurance-comparison': array{title: 'Health Insurance Guide', badge: 'Health', guardrails: 'Educational summaries of insurance plans. Not financial or medical advice.', placeholder: 'What is the difference between the Gold and Silver plans?', summary: 'Helps compare health insurance plans, premiums, and benefits.'}, 'company-insights': array{title: 'Company Insights', badge: 'Business', guardrails: 'Educational insights based on public company data. Not investment advice.', placeholder: 'What is the market sentiment for this company?', summary: 'Analyzes company performance, culture, and market data.'}, 'entertainment-guide': array{title: 'Entertainment Guide', badge: 'Entertainment', guardrails: 'Recommendations and summaries of entertainment content.', placeholder: 'Recommend a documentary about women in tech.', summary: 'Suggests movies, documentaries, and educational content.'}, 'career-copilot': array{title: 'Career Copilot', badge: 'Career', guardrails: 'Professional development guidance. Not recruitment or legal advice.', placeholder: 'Review my resume summary for a Senior PM role.', summary: 'Helps with resumes, interviews, and career growth strategies.'}}
     */
    public static function contexts(): array
    {
        return [
            'money-budgeting-education' => [
                'title' => 'Money calm coach',
                'badge' => 'Money',
                'guardrails' => 'Educational reflections about budgeting, subscriptions, and calm spending habits. Not financial advice.',
                'placeholder' => 'Could you walk me through trimming two software subscriptions gently?',
                'summary' => 'Talk through subscriptions, budgets, or debt trade-offs without judgement.',
            ],
            'sole-trader-statements' => [
                'title' => 'Debt & statement explainer',
                'badge' => 'Business',
                'guardrails' => 'Helps you reflect on trade-offs. Does not recommend lenders, products, or tax moves.',
                'placeholder' => 'What does net profit vs cash flow mean for my studio?',
                'summary' => 'Explains sole-trader statements, cash flow vs profit, and light bookkeeping terms.',
            ],
            'bank-feed-triage' => [
                'title' => 'Bank feed triage coach',
                'badge' => 'Money',
                'guardrails' => 'Summarises transaction patterns without suggesting providers or making credit decisions.',
                'placeholder' => 'Help me understand these flagged software transactions kindly.',
                'summary' => 'Gives friendly language for what your transaction list is showing.',
            ],
            'mobility-ai-guide' => [
                'title' => 'Mobility & car buying coach',
                'badge' => 'Mobility',
                'guardrails' => 'Educational reflections about transport trade-offs, DV-safe travel planning, and dealership scripts. Not lending or insurance advice.',
                'placeholder' => 'Can you help me compare a safe used SUV with a hybrid salary-packaged option?',
                'summary' => 'Pairs car research, safety checklists, and budget prompts so women never negotiate alone.',
            ],
            'housing-mortgage-education' => [
                'title' => 'Housing & mortgage explainer',
                'badge' => 'Housing',
                'guardrails' => 'Educational reflections about renting vs buying, repayments, and housing rights. Not lending or real-estate advice.',
                'placeholder' => 'Can you outline the trade-off between renting now vs saving longer for a deposit?',
                'summary' => 'Covers repayments, housing affordability, safety checklists, and calm next steps.',
            ],
            'business-legal-foundations' => [
                'title' => 'Business & legal foundations',
                'badge' => 'Legal',
                'guardrails' => 'Plain-language education about structures, templates, and compliance. Not legal or tax advice.',
                'placeholder' => 'What should I think about before switching from sole trader to a company?',
                'summary' => 'Explains structures, contracts, grants, and compliance questions in warm language.',
            ],
            'wellbeing-fitness' => [
                'title' => 'Wellbeing & Vipassana reflections',
                'badge' => 'Wellness',
                'guardrails' => 'Educational reflections only. Not medical, psychological, or therapeutic advice.',
                'placeholder' => 'How can I pace a women-only Vipassana sit if I have low energy?',
                'summary' => 'Talk through meditation, nervous system care, and gentle movement ideas.',
            ],
            'wellness-money-calm' => [
                'title' => 'Wellness + money calm',
                'badge' => 'Wellness',
                'guardrails' => 'Educational reflections blending nervous system care with financial literacy. Not medical, mental health, or financial advice.',
                'placeholder' => 'I tense up before checking statements. Can you script a calm ritual first?',
                'summary' => 'Connects breathwork, reflection prompts, and Money Inbox nudges for calmer budgeting.',
            ],
            'wellness-circle-plans' => [
                'title' => 'Care circle ritual designer',
                'badge' => 'Community',
                'guardrails' => 'Educational prompts for peer circles and stipends. Not legal, HR, or therapeutic advice.',
                'placeholder' => 'Draft a fortnightly ritual for our founders group that respects low energy weeks.',
                'summary' => 'Generates agendas, accountability prompts, and stipend-ready plans for teams or pods.',
            ],
            'wellness-mobility-support' => [
                'title' => 'Mobility recovery stack',
                'badge' => 'Wellness',
                'guardrails' => 'Educational reflections only. Not physiotherapy, medical, or financial advice.',
                'placeholder' => 'Help me sync physio rest days with the mobility fund timeline.',
                'summary' => 'Links rehab pacing, transport plans, and mobility concierge notes into one briefing.',
            ],
            'wellness-fast-hand-off' => [
                'title' => 'Rapid wellness hand-off',
                'badge' => 'Support',
                'guardrails' => 'Shares grounding prompts and referral checklists. Not crisis counselling or medical advice.',
                'placeholder' => 'I need to reset after a tough shift and know who to loop in tomorrow.',
                'summary' => 'Wraps quick grounding scripts with the next best Athena context or human channel.',
            ],
            'women-marketplace' => [
                'title' => 'Marketplace concierge',
                'badge' => 'Marketplace',
                'guardrails' => 'Summarises listings and shares reflective shopping prompts. Not medical, legal, or financial advice.',
                'placeholder' => 'Compare two trauma-aware studios in Melbourne that include childcare?',
                'summary' => 'Helps weigh up marketplace listings, perks, and access needs noted in Problem Map research.',
            ],
            'health-insurance-comparison' => [
                'title' => 'Health Insurance Guide',
                'badge' => 'Health',
                'guardrails' => 'Educational summaries of insurance plans. Not financial or medical advice.',
                'placeholder' => 'What is the difference between the Gold and Silver plans?',
                'summary' => 'Helps compare health insurance plans, premiums, and benefits.',
            ],
            'company-insights' => [
                'title' => 'Company Insights',
                'badge' => 'Business',
                'guardrails' => 'Educational insights based on public company data. Not investment advice.',
                'placeholder' => 'What is the market sentiment for this company?',
                'summary' => 'Analyzes company performance, culture, and market data.',
            ],
            'entertainment-guide' => [
                'title' => 'Entertainment Guide',
                'badge' => 'Entertainment',
                'guardrails' => 'Recommendations and summaries of entertainment content.',
                'placeholder' => 'Recommend a documentary about women in tech.',
                'summary' => 'Suggests movies, documentaries, and educational content.',
            ],
            'career-copilot' => [
                'title' => 'Career Copilot',
                'badge' => 'Career',
                'guardrails' => 'Professional development guidance. Not recruitment or legal advice.',
                'placeholder' => 'Review my resume summary for a Senior PM role.',
                'summary' => 'Helps with resumes, interviews, and career growth strategies.',
            ],
        ];
    }

    /**
     * Featured contexts surfaced in the global concierge bar.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function featuredContexts(): array
    {
        return Arr::only(static::contexts(), static::FEATURED_CONTEXT_KEYS);
    }

    public static function systemPrompt(string $contextKey): string
    {
        return match ($contextKey) {
            'money-budgeting-education' => (string) config('athena_ai.money_budgeting_education_system_prompt'),
            'sole-trader-statements' => (string) config('athena_ai.sole_trader_statements_system_prompt'),
            'bank-feed-triage' => (string) config('athena_ai.money_budgeting_education_system_prompt'),
            'mobility-ai-guide' => (string) config('athena_ai.mobility_ai_guide_system_prompt'),
            'housing-mortgage-education' => (string) config('athena_ai.housing_mortgage_system_prompt'),
            'business-legal-foundations' => (string) config('athena_ai.business_legal_foundations_system_prompt'),
            'wellbeing-fitness' => (string) config('athena_ai.wellbeing_fitness_system_prompt'),
            'wellness-money-calm' => (string) config('athena_ai.wellness_money_calm_system_prompt'),
            'wellness-circle-plans' => (string) config('athena_ai.wellness_circle_plans_system_prompt'),
            'wellness-mobility-support' => (string) config('athena_ai.wellness_mobility_support_system_prompt'),
            'wellness-fast-hand-off' => (string) config('athena_ai.wellness_fast_handoff_system_prompt'),
            'women-marketplace' => (string) config('athena_ai.women_marketplace_system_prompt'),
            'health-insurance-comparison' => 'You are a helpful assistant for comparing health insurance plans. Explain terms like deductible, premium, and copay simply. Do not give financial advice.',
            'company-insights' => 'You are a business analyst assistant. Provide insights on company culture, market performance, and job opportunities based on available data. Do not give investment advice.',
            'entertainment-guide' => 'You are an entertainment guide. Recommend content that empowers and educates women. Focus on stories of success, resilience, and learning.',
            'career-copilot' => (string) config('athena_ai.career_copilot_system_prompt'),
            default => 'You are Athena, a respectful educational assistant. Keep replies warm and non-judgemental.',
        };
    }
}

