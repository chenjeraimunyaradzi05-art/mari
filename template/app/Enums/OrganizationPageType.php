<?php

namespace App\Enums;

enum OrganizationPageType: string
{
    case University = 'university';
    case Tafe = 'tafe';
    case Rto = 'rto';
    case Employer = 'employer';
    case Tradie = 'tradie';
    case Government = 'government';
    case Association = 'association';

    public function label(): string
    {
        return match ($this) {
            self::University => 'University',
            self::Tafe => 'TAFE Provider',
            self::Rto => 'RTO Provider',
            self::Employer => 'Corporate Employer',
            self::Tradie => 'Tradie Business',
            self::Government => 'Government Agency',
            self::Association => 'Industry Association',
        };
    }

    public function defaultLeadIntent(): string
    {
        return match ($this) {
            self::University, self::Tafe, self::Rto => 'course',
            self::Tradie => 'apprenticeship',
            self::Employer => 'job',
            self::Government, self::Association => 'general',
        };
    }

    /**
     * Persona metadata mirrors the seven organization archetypes in moneyman-v3.0 §1.2.
     *
     * @return (string|string[])[]
     *
     * @psalm-return array{badge: string, tagline: string, summary: string, unlocks: list{string, string, string}, label: string, default_lead_intent: string}
     */
    public function personaMeta(): array
    {
        $meta = match ($this) {
            self::University => [
                'badge' => 'Higher Education Persona',
                'tagline' => 'Universities power research-led pathways for ambitious women.',
                'summary' => 'Showcase bachelor-to-master programs, research labs, and alumni outcomes with verified safety signals.',
                'unlocks' => [
                    'Promote degrees, micro-credentials, and dual study streams.',
                    'Highlight faculty mentors, alumni success, and scholarships.',
                    'Surface open days, intakes, and outcomes tracking.',
                ],
            ],
            self::Tafe => [
                'badge' => 'TAFE Persona',
                'tagline' => 'TAFE campuses spotlight hands-on training and wrap-around support.',
                'summary' => 'Perfect for certificate and diploma programs with government-backed funding, safety assurances, and coaching.',
                'unlocks' => [
                    'Advertise intakes across nursing, aviation, logistics, and trades.',
                    'Promote Skills First or VET Student Loan subsidies.',
                    'Embed campus tours, labs, and mentor spotlights.',
                ],
            ],
            self::Rto => [
                'badge' => 'RTO Persona',
                'tagline' => 'Registered Training Organisations broadcast competency-based pathways.',
                'summary' => 'Align competency frameworks, employer partnerships, and assessment journeys to reassure applicants.',
                'unlocks' => [
                    'Map competencies to high-demand roles and apprenticeships.',
                    'Highlight employer co-delivery and placement guarantees.',
                    'Automate compliance notices, safety readiness, and subsidies.',
                ],
            ],
            self::Employer => [
                'badge' => 'Employer Persona',
                'tagline' => 'Corporate, luxury hospitality, aviation, and tech hubs recruit with premium storytelling.',
                'summary' => 'Activate culture reels, day-in-life clips, and leadership pledges to attract verified women talent.',
                'unlocks' => [
                    'Run boosted job campaigns with salary transparency.',
                    'Feature leadership pathways, ERGs, and mentorship programs.',
                    'Layer luxury hospitality, aviation, or tech vertical badges.',
                ],
            ],
            self::Tradie => [
                'badge' => 'Trades & Apprenticeships Persona',
                'tagline' => 'Tradie collectives recruit apprentices with safety-first crews.',
                'summary' => 'Designed for plumbing, electrical, construction, and maritime teams that need evergreen apprenticeships.',
                'unlocks' => [
                    'Publish apprenticeship ladders with rotation calendars.',
                    'Embed compliance checklists (White Card, STCW, ENG1).',
                    'Spotlight mentor tradies and site safety commitments.',
                ],
            ],
            self::Government => [
                'badge' => 'Government Persona',
                'tagline' => 'Government agencies showcase programs, scholarships, and public sector hiring.',
                'summary' => 'Bundle internships, leadership academies, and policy guardrails for women entering civic careers.',
                'unlocks' => [
                    'Advertise cadetships, grad programs, and fellowships.',
                    'Explain workplace protections, DEI policies, and benefits.',
                    'Surface grant applications and intake calendars.',
                ],
            ],
            self::Association => [
                'badge' => 'Industry Association Persona',
                'tagline' => 'Associations convene members, standards, and networking pathways.',
                'summary' => 'Ideal for industry bodies running events, certifications, and referral programs that uplift women.',
                'unlocks' => [
                    'Publish event calendars, AMAs, and chapter directories.',
                    'Highlight member perks, standards, and advocacy outcomes.',
                    'Capture leads for councils, certifications, and cohorts.',
                ],
            ],
        };

        return array_merge($meta, [
            'label' => $this->label(),
            'default_lead_intent' => $this->defaultLeadIntent(),
        ]);
    }
}
