<?php

declare(strict_types=1);

namespace App\Policies\WomenRealEstate;

use App\Models\User;
use App\Models\WomenRealEstate\WomenDashboardWidget;
use Illuminate\Auth\Access\HandlesAuthorization;

final class WomenDashboardWidgetPolicy
{
    use HandlesAuthorization;

    public function update(User $user, WomenDashboardWidget $widget): bool
    {
        return $this->ownsWidget($user, $widget) || $this->canModerate($user);
    }

    public function delete(User $user, WomenDashboardWidget $widget): bool
    {
        return $this->ownsWidget($user, $widget) || $this->canModerate($user);
    }

    private function ownsWidget(User $user, WomenDashboardWidget $widget): bool
    {
        $preference = $widget->preference;

        return $preference !== null && $preference->user_id === $user->id;
    }

    private function canModerate(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);
    }
}

