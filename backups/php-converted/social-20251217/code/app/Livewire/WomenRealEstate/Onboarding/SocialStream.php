<?php

declare(strict_types=1);

namespace App\Livewire\WomenRealEstate\Onboarding;

use App\Models\SocialPost;
use App\Models\User;
use App\Models\WomenRealEstate\WomenSocialNetworkConnection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Livewire\Component;

final class SocialStream extends Component
{
    public array $posts = [];

    public bool $loading = true;

    public ?string $path = null;

    public string $activeTag = 'all';

    public array $tagOptions = [];

    public int $connectionsCount = 0;

    public int $pendingConnections = 0;

    protected $listeners = [
        'socialConnectionsUpdated' => 'hydrateConnections',
    ];

    public function mount(?string $path = null): void
    {
        $this->path = $path;
        $this->tagOptions = $this->buildTagOptions($path);
        $this->refreshStream();
    }

    public function refreshStream(): void
    {
        $this->loadPosts();
        $this->hydrateConnections();
    }

    public function loadPosts(): void
    {
        $this->loading = true;

        $this->posts = SocialPost::query()
            ->with('profile')
            ->visible()
            ->public()
            ->when($this->activeTag !== 'all', function ($query): void {
                $tag = $this->activeTag;
                $query->whereJsonContains('tags', $tag)
                    ->orWhereJsonContains('tags', Str::slug($tag, '_'))
                    ->orWhereJsonContains('ai_tags', $tag)
                    ->orWhere('meta->topic', str_replace('-', '_', $tag));
            })
            ->where(function ($query): void {
                $query->whereJsonContains('tags', 'real-estate')
                    ->orWhereJsonContains('tags', 'real_estate')
                    ->orWhereJsonContains('ai_tags', 'real estate')
                    ->orWhere('meta->topic', 'real_estate');
            })
            ->latest('published_at')
            ->limit(6)
            ->get()
            ->map(/**
             * @return (int|mixed|null|string)[]
             *
             * @psalm-return array{id: mixed, caption: null|string, content: string, profile: null|string, likes: int|null, comments: int|null, url: string, published_at: null|string}
             */
            static function (SocialPost $post): array {
                return [
                    'id' => $post->getKey(),
                    'caption' => $post->caption,
                    'content' => Str::of($post->content ?? '')->limit(160)->value(),
                    'profile' => $post->profile?->display_name ?? $post->user?->name,
                    'likes' => $post->likes_count,
                    'comments' => $post->comments_count,
                    'url' => route('social.posts.show', $post),
                    'published_at' => optional($post->published_at ?? $post->created_at)?->diffForHumans(),
                ];
            })
            ->all();

        $this->loading = false;
    }

    public function setTag(string $tag): void
    {
        if ($this->activeTag === $tag) {
            return;
        }

        $this->activeTag = $tag;
        $this->loadPosts();
    }

    public function hydrateConnections(): void
    {
        /** @var User|null $user */
        $user = Auth::user();

        if (! $user instanceof User) {
            $this->connectionsCount = 0;
            $this->pendingConnections = 0;
            $this->dispatch('realEstateSocialProgress', [
                'complete' => false,
                'connections' => 0,
                'pending' => 0,
            ]);
            return;
        }

        $userId = $user->getKey();

        $this->connectionsCount = WomenSocialNetworkConnection::query()
            ->where(function ($query) use ($userId): void {
                $query->where('user_id_1', $userId)
                    ->orWhere('user_id_2', $userId);
            })
            ->whereIn('status', ['accepted', 'connected'])
            ->count();

        $this->pendingConnections = WomenSocialNetworkConnection::query()
            ->where('user_id_2', $userId)
            ->where('status', 'pending')
            ->count();

        $this->dispatch('realEstateSocialProgress', [
            'complete' => $this->connectionsCount > 0,
            'connections' => $this->connectionsCount,
            'pending' => $this->pendingConnections,
        ]);
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{0: array{value: string, label: string}, 1?: array{value: string, label: string},...}
     */
    private function buildTagOptions(?string $path): array
    {
        $map = [
            'rent' => [
                'househunter-insights' => 'Househunter insights',
                'renter-safety' => 'Safety cues',
                'community-wins' => 'Community wins',
            ],
            'lease' => [
                'landlord-playbook' => 'Landlord playbook',
                'listing-ops' => 'Listing ops',
                'investor-updates' => 'Investor updates',
            ],
            'agent' => [
                'agent-life' => 'Agent life',
                'referral-loop' => 'Referral loop',
                'compliance-watch' => 'Compliance watch',
            ],
            'buy' => [
                'mortgage-gameplan' => 'Mortgage game plan',
                'cash-buyer' => 'Cash buyer tips',
                'wealth-building' => 'Wealth building',
            ],
        ];

        $bucket = $map[$path] ?? [
            'real-estate' => 'Real estate',
            'womenrise-community' => 'Community',
        ];

        $options = [
            ['value' => 'all', 'label' => 'All topics'],
        ];

        foreach ($bucket as $value => $label) {
            $options[] = [
                'value' => $value,
                'label' => $label,
            ];
        }

        return $options;
    }

    public function render(): \Illuminate\Contracts\View\View
    {
        return view('livewire.women-real-estate.onboarding.social-stream');
    }
}

