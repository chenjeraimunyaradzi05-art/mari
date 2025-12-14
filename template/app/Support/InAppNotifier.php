<?php

namespace App\Support;

use App\Models\AdminNotification;
use App\Models\Notification;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;

final class InAppNotifier
{
    public static function notifyUser(int $userId, string $type, array $data = []): void
    {
        try {
            Notification::query()->create([
                'user_id' => $userId,
                'type' => $type,
                'data' => Arr::only($data, array_keys($data)),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Failed to persist in-app notification for user', [
                'user_id' => $userId,
                'type' => $type,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    public static function notifyAdmin(int $adminId, string $type, array $data = []): void
    {
        try {
            AdminNotification::query()->create([
                'admin_id' => $adminId,
                'type' => $type,
                'data' => Arr::only($data, array_keys($data)),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Failed to persist in-app notification for admin', [
                'admin_id' => $adminId,
                'type' => $type,
                'exception' => $exception->getMessage(),
            ]);
        }
    }
}

