<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenDashboardPreference;
use App\Models\WomenRealEstate\WomenDashboardWidget;
use Illuminate\Support\Collection;

final class WomenDashboardService
{
    public function preferenceForUser(User $user): WomenDashboardPreference|null
    {
        return WomenDashboardPreference::query()
            ->with(['widgets' => function ($query): void {
                /** @var \Illuminate\Database\Eloquent\Builder $query */
                $query->orderBy('position');
            }])
            ->where('user_id', $user->id)
            ->first();
    }

    /**
     * @return Collection|\Illuminate\Database\Eloquent\Collection
     *
     * @psalm-return Collection<never, never>|\Illuminate\Database\Eloquent\Collection<int, WomenDashboardWidget>
     */
    public function widgetsForUser(User $user): \Illuminate\Database\Eloquent\Collection|Collection
    {
        $preference = $this->preferenceForUser($user);

        if ($preference === null) {
            return collect();
        }

        return $preference->widgets->sortBy('position')->values();
    }

    public function pinWidget(WomenDashboardWidget $widget): WomenDashboardWidget
    {
        $widget->pinned = true;
        $widget->save();

        return $widget;
    }

    public function reorderWidgets(WomenDashboardPreference $preference, array $orderedIds): void
    {
        $position = 1;
        foreach ($orderedIds as $widgetId) {
            $preference->widgets()->whereKey($widgetId)->update(['position' => $position]);
            $position++;
        }
    }
}

