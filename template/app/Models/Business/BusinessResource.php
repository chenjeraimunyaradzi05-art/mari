<?php

namespace App\Models\Business;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $title
 * @property string $resource_type
 * @property string|null $badge
 * @property string|null $summary
 * @property string|null $cta_label
 * @property string|null $cta_url
 * @property string|null $hero_color
 * @property array<array-key, mixed>|null $tags
 * @property array<array-key, mixed>|null $metadata
 * @property float $ai_relevance_score
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource published()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereAiRelevanceScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereBadge($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereCtaLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereCtaUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereHeroColor($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereResourceType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessResource withoutTrashed()
 * @mixin \Eloquent
 */
final class BusinessResource extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'title',
        'resource_type',
        'badge',
        'summary',
        'cta_label',
        'cta_url',
        'hero_color',
        'tags',
        'metadata',
        'ai_relevance_score',
        'published_at',
    ];

    protected $casts = [
        'tags' => 'array',
        'metadata' => 'array',
        'ai_relevance_score' => 'float',
        'published_at' => 'datetime',
    ];

    public function scopePublished($query)
    {
        return $query->whereNotNull('published_at')->where('published_at', '<=', now());
    }

    public static function ensureStarterSet(): void
    {
        if (self::count() > 0) {
            return;
        }

        $now = now();
        $resources = [
            [
                'title' => 'Grant Playbook: Export-ready Women Founders',
                'resource_type' => 'grant',
                'badge' => 'New',
                'summary' => 'Step-by-step workbook for preparing Austrade landing pads and grant submissions aimed at women-led exporters.',
                'cta_label' => 'Open grant workbook',
                'cta_url' => 'https://grants.gov.au/playbooks/export-ready',
                'hero_color' => '#F9A8D4',
                'tags' => ['capital', 'government', 'export'],
                'metadata' => ['duration' => '45 min read'],
            ],
            [
                'title' => 'Supplier Match: Inclusive Procurement Directory',
                'resource_type' => 'directory',
                'badge' => 'Curated',
                'summary' => '200+ corporations with active inclusive procurement mandates ready to onboard new women-owned suppliers.',
                'cta_label' => 'View partners',
                'cta_url' => 'https://inclusivesuppliers.gov.au/directory',
                'hero_color' => '#FBCFE8',
                'tags' => ['enterprise', 'procurement'],
                'metadata' => ['entries' => 200],
            ],
            [
                'title' => 'AI Studio: Instant Brand Voice Kit',
                'resource_type' => 'template',
                'badge' => 'AI',
                'summary' => 'Prompt stack + Notion template to keep every caption, email, and landing page on the same dreamy, confident tone.',
                'cta_label' => 'Duplicate template',
                'cta_url' => 'https://notion.so/templates/ai-brand-voice',
                'hero_color' => '#C4B5FD',
                'tags' => ['brand', 'ai'],
                'metadata' => ['format' => 'Notion'],
            ],
            [
                'title' => 'Partner Hours: Women in Capital Office Hours',
                'resource_type' => 'event',
                'badge' => 'Live',
                'summary' => 'Weekly founder hotline with women GPs covering term sheets, due diligence, and storytelling with warmth.',
                'cta_label' => 'Book a slot',
                'cta_url' => 'https://calendly.com/women-capital/office-hours',
                'hero_color' => '#A5F3FC',
                'tags' => ['capital', 'mentorship'],
                'metadata' => ['cadence' => 'Weekly'],
            ],
        ];

        foreach ($resources as $resource) {
            self::create(array_merge($resource, [
                'ai_relevance_score' => random_int(70, 98),
                'published_at' => $now,
            ]));
        }
    }

    public function badgeLabel(): string
    {
        return strtoupper($this->badge ?? Str::after($this->resource_type, '_'));
    }
}

