<?php

declare(strict_types=1);

namespace App\Enums\WomenRealEstate;

enum DashboardWidgetType: string
{
    case HERO_SUMMARY = 'hero_summary';
    case MORTGAGE_WIDGET = 'mortgage_widget';
    case GOAL_TRACKER = 'goal_tracker';
    case MENTOR_MATCHES = 'mentor_matches';
    case PARTNER_OPPORTUNITIES = 'partner_opportunities';
    case RECOMMENDED_LISTINGS = 'recommended_listings';
    case AI_NUDGES = 'ai_nudges';

    public function label(): string
    {
        return match ($this) {
            self::HERO_SUMMARY => 'Hero Summary',
            self::MORTGAGE_WIDGET => 'Mortgage Widget',
            self::GOAL_TRACKER => 'Goal Tracker',
            self::MENTOR_MATCHES => 'Mentor Matches',
            self::PARTNER_OPPORTUNITIES => 'Partner Opportunities',
            self::RECOMMENDED_LISTINGS => 'Recommended Listings',
            self::AI_NUDGES => 'AI Nudges',
        };
    }
}
