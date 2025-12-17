<?php

namespace App\Contracts\Social;

use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Contract for services that rank social feed candidates for a user.
 */
interface FeedRanker
{
    /**
     * Score and order candidate posts for the target user.
     *
     * @param User $user Feed owner requesting results.
     * @param Collection<int, mixed> $candidates Items to rank (typically SocialPost models).
     * @param array<string, mixed> $options Optional hints such as bucket weights or filter flags.
     */
    public function rank(User $user, Collection $candidates, array $options = []): Collection;
}
