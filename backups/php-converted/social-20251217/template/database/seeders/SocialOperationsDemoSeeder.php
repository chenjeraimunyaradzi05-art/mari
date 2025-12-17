<?php

namespace Database\Seeders;

use App\Enums\SocialVerificationStatus;
use App\Enums\SocialThreadRequestMode;
use App\Enums\SocialThreadStatus;
use App\Enums\SocialThreadType;
use App\Models\CommerceChannel;
use App\Models\CommerceCollection;
use App\Models\CommerceOrder;
use App\Models\CommerceOrderEvent;
use App\Models\CommerceOrderItem;
use App\Models\CommercePayoutBatch;
use App\Models\CommerceProduct;
use App\Models\CommerceProductVariant;
use App\Models\CommunityGroup;
use App\Models\SocialBlockList;
use App\Models\SocialBlockListEntry;
use App\Models\SocialLiveStream;
use App\Models\SocialLiveStreamGift;
use App\Models\SocialLiveStreamMetric;
use App\Models\SocialPost;
use App\Models\SocialPostPoll;
use App\Models\SocialPostPollOption;
use App\Models\SocialPostPollVote;
use App\Models\SocialProfile;
use App\Models\SocialProfileVerification;
use App\Models\SocialThread;
use App\Models\SocialThreadBinding;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

final class SocialOperationsDemoSeeder extends Seeder
{
    public function run(): void
    {
        // keep the demo operations seeding opt-in — avoid population by default
        return;
    }


    protected function ensureProfileHasUser(SocialProfile $profile): SocialProfile
    {
        if ($profile->user_id) {
            return $profile;
        }

        $user = $profile->account ?? User::query()->first();

        if (! $user) {
            $user = User::factory()->create();
        }

        $profile->forceFill(['user_id' => $user->id])->save();

        return $profile->refresh();
    }

    protected function upsertPost(SocialProfile $profile, string $seedKey, array $payload): SocialPost
    {
        $post = SocialPost::query()
            ->where('meta->seed_key', $seedKey)
            ->first();

        $data = array_merge(
            [
                'social_profile_id' => $profile->id,
                'user_id' => $profile->user_id,
                'postable_type' => SocialProfile::class,
                'postable_id' => $profile->id,
                'meta' => ['seed_key' => $seedKey],
                'moderation_status' => 'pending',
                'visibility' => 'public',
                'published_at' => CarbonImmutable::now()->subHours(6),
            ],
            $payload
        );

        if ($post) {
            $post->fill(Arr::except($data, ['meta']))->save();
            $post->meta = array_merge($post->meta ?? [], ['seed_key' => $seedKey]);
            $post->save();

            return $post;
        }

        return SocialPost::create($data);
    }
}

