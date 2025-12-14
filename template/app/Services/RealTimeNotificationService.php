<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;

final class RealTimeNotificationService
{
	public function broadcast(User $user, string $type, array $payload = []): void
	{
		Log::info('notifications.realtime.dispatch', [
			'user_id' => $user->id,
			'type' => $type,
			'payload' => $payload,
		]);
	}
}

