<?php

namespace App\Http\Controllers\Frontend\Social\Concerns;

use App\Models\SocialProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Support\Str;

trait ManagesSocialProfiles
{
    protected function ensureProfile(User $user): \Illuminate\Database\Eloquent\Model|null
    {
        $profile = $user->socialProfile;

        if ($profile) {
            return $profile;
        }

        $profile = SocialProfile::query()
            ->where('user_id', $user->id)
            ->orWhere(function ($query) use ($user) {
                $query->where('profileable_type', $user->getMorphClass())
                    ->where('profileable_id', $user->getKey());
            })
            ->latest('id')
            ->first();

        if ($profile) {
            $user->setRelation('socialProfile', $profile);

            return $profile;
        }

        $profile = $user->socialProfile()->create([
            'user_id' => $user->id,
            'profile_type' => $this->determineProfileType($user),
            'display_name' => $user->name ?? 'Member '.$user->id,
            'username' => $this->generateUniqueUsername($user->name ?? 'member-'.$user->id),
            'social_links' => [],
        ]);

        return $profile->fresh();
    }

    protected function determineProfileType(User $user): string
    {
        if ($user->account_classification === 'business_network') {
            return 'business';
        }

        if ($this->hasRelationInstance($user, 'company')) {
            return 'company';
        }

        if ($this->hasRelationInstance($user, 'candidate')) {
            return 'candidate';
        }

        return $user->role === 'company' ? 'company' : 'candidate';
    }

    private function hasRelationInstance(EloquentModel $model, string $relation): bool
    {
        if (! method_exists($model, $relation)) {
            return false;
        }

        if ($model->relationLoaded($relation)) {
            return (bool) $model->getRelation($relation);
        }

        return $model->{$relation}()->exists();
    }

    protected function adjustCounter(EloquentModel $model, string $column, int $delta): void
    {
        $current = (int) $model->getAttribute($column);
        $next = max(0, $current + $delta);
        $model->forceFill([$column => $next]);

        if (method_exists($model, 'saveQuietly')) {
            $model->saveQuietly();
        } else {
            $model->save();
        }
    }

    protected function generateUniqueUsername(string $base, ?int $ignoreId = null): string
    {
        $slug = Str::slug(Str::limit($base, 40, ''));

        if ($slug === '') {
            $slug = 'member';
        }

        $username = $slug;
        $suffix = 1;

        while (SocialProfile::query()
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->where('username', $username)
            ->exists()) {
            $username = $slug.'-'.$suffix;
            $suffix++;
        }

        return $username;
    }
}
