<?php

namespace App\Http\Controllers\Api\Wellbeing;

use App\Http\Controllers\Controller;
use App\Support\Wellbeing\WellbeingInterestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WellbeingArticleController extends Controller
{
    public function __construct(private readonly WellbeingInterestService $interestService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $articleSet = collect(config('wellbeing.articles', []));

        $tags = $user->wellbeingProfile
            ? $this->interestService->tagsFromProfile($user->wellbeingProfile)
            : $this->interestService->inferFromUser($user);

        $preferred = $this->interestService->preferredInterest($tags);

        if ($preferred) {
            $articleSet = $articleSet->filter(function (array $article) use ($preferred) {
                $articleTags = collect($article['tags'] ?? []);

                return $articleTags->isEmpty() || $articleTags->contains($preferred) || $articleTags->contains('wellness');
            });
        }

        return response()->json([
            'articles' => $articleSet->values()->all(),
            'disclaimer' => (string) config('wellbeing.disclaimer'),
        ]);
    }
}

