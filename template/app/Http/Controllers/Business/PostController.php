<?php

namespace App\Http\Controllers\Business;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Frontend\Social\Concerns\ManagesSocialProfiles;
use App\Services\AIContentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class PostController extends Controller
{
    use ManagesSocialProfiles;

    public function store(Request $request, AIContentService $aiContentService): RedirectResponse
    {
        $profile = $this->ensureProfile($request->user());

        $validated = $request->validate([
            'caption' => ['required', 'string', 'max:2200'],
            'visibility' => ['nullable', 'in:public,followers'],
        ]);

        $caption = trim($validated['caption']);

        $post = $profile->posts()->create([
            'post_type' => 'post',
            'caption' => $caption,
            'tags' => $this->extractHashtags($caption),
            'mentions' => $this->extractMentions($caption),
            'visibility' => $validated['visibility'] ?? 'public',
            'comments_disabled' => false,
            'published_at' => now(),
        ]);

        $analysis = $aiContentService->analyzePost($post);
        $post->update([
            'ai_tags' => $analysis['tags'] ?? [],
            'ai_engagement_score' => $analysis['engagement_score'] ?? 0,
        ]);

        $profile->increment('posts_count');

        return redirect()
            ->route('business.dashboard')
            ->with('business_post_shared', true);
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function extractHashtags(string $caption): array
    {
        preg_match_all('/#([\pL\pN_]+)/u', $caption, $matches);

        return collect($matches[1] ?? [])
            ->map(fn ($tag) => Str::lower($tag))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function extractMentions(string $caption): array
    {
        preg_match_all('/@([A-Za-z0-9_.]+)/', $caption, $matches);

        return collect($matches[1] ?? [])
            ->unique()
            ->values()
            ->all();
    }
}

