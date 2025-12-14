<?php

namespace App\Services\Business;

use App\Models\User;
use App\Models\UserLoginAudit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

final class FounderTimezoneSyncService
{
    /**
     * @psalm-return int<0, max>
     */
    public function syncRecent(?int $lookbackHours = null): int
    {
        $lookbackHours ??= (int) config('business.digests.timezone_sync.lookback_hours', 720);
        $cutoff = $lookbackHours > 0 ? Carbon::now()->subHours($lookbackHours) : null;

        $latestAudits = $this->latestAudits($cutoff);

        if ($latestAudits->isEmpty()) {
            return 0;
        }

        $users = User::query()
            ->whereIn('id', $latestAudits->keys())
            ->where('account_classification', 'business_network')
            ->get(['id', 'timezone']);

        $updated = 0;

        foreach ($users as $user) {
            $audit = $latestAudits->get($user->id);

            if (! $audit) {
                continue;
            }

            $timezone = $this->validatedTimezone($audit->timezone);

            if (! $timezone || $user->timezone === $timezone) {
                continue;
            }

            $user->forceFill(['timezone' => $timezone])->saveQuietly();
            $updated++;
        }

        return $updated;
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<array-key, UserLoginAudit>
     */
    private function latestAudits(?Carbon $cutoff): \Illuminate\Database\Eloquent\Collection
    {
        $latestIds = UserLoginAudit::query()
            ->selectRaw('MAX(id) as id, user_id')
            ->whereNotNull('timezone')
            ->where('timezone', '!=', '')
            ->when($cutoff, function ($query) use ($cutoff) {
                $query->where(function ($inner) use ($cutoff) {
                    $inner->where('logged_in_at', '>=', $cutoff)
                        ->orWhere(function ($sub) use ($cutoff) {
                            $sub->whereNull('logged_in_at')->where('created_at', '>=', $cutoff);
                        });
                });
            })
            ->groupBy('user_id');

        return UserLoginAudit::query()
            ->select('user_login_audits.*')
            ->joinSub($latestIds, 'latest', function ($join) {
                $join->on('user_login_audits.id', '=', 'latest.id');
            })
            ->get()
            ->keyBy('user_id');
    }

    private function validatedTimezone(?string $timezone): string|null
    {
        if (! $timezone) {
            return null;
        }

        try {
            new \DateTimeZone($timezone);
        } catch (\Throwable) {
            return null;
        }

        return $timezone;
    }
}

