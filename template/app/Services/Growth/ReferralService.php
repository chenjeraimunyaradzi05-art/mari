<?php

namespace App\Services\Growth;

use App\Models\Referral;
use App\Models\User;
use App\Notifications\ReferralInvitationNotification;
use App\Notifications\ReferralRewardNotification;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

final class ReferralService
{
    public function generateReferralCode(User $user): string
    {
        // Deterministic code: ATH + User ID in Base36
        return 'ATH' . strtoupper(base_convert($user->id, 10, 36));
    }

    public function getReferrerFromCode(string $code): ?User
    {
        if (str_starts_with($code, 'ATH')) {
            $idString = substr($code, 3);
            $id = intval(base_convert($idString, 36, 10));
            return User::find($id);
        }
        return null;
    }

    public function sendReferral(User $referrer, string $email, ?string $message = null): Referral
    {
        $code = $this->generateReferralCode($referrer); // This is now the user's static code

        // For email invites, we might want a unique code to track specific emails,
        // but for now let's use the static code to keep it simple and consistent.
        // Or we can append a random string if we really want unique invite codes.
        // Let's stick to the static code for "Viral Loops" simplicity.

        $referral = Referral::create([
            'referrer_id' => $referrer->id,
            'referred_email' => $email,
            'referral_code' => $code,
            'referred_at' => now(),
            'status' => 'pending',
        ]);

        // Send referral email (Assuming Notification class exists or using Mail directly)
        // For now, we'll assume a notification class
        // $referrer->notify(new ReferralInvitationNotification($email, $code, $message));

        return $referral;
    }

    public function acceptReferral(string $code, User $newUser): void
    {
        // Check if it's an existing invitation (pending)
        $referral = Referral::where('referral_code', $code)
            ->where('status', 'pending')
            ->where('referred_email', $newUser->email) // Match email if possible
            ->first();

        // If not found by email, just look for the code in pending state (legacy support)
        if (!$referral) {
             $referral = Referral::where('referral_code', $code)
                ->where('status', 'pending')
                ->whereNull('referred_id')
                ->first();
        }

        if ($referral) {
            $referral->update([
                'referred_id' => $newUser->id,
                'status' => 'accepted',
            ]);
            $this->scheduleReward($referral);
            return;
        }

        // Check if it's a user code (Viral Loop)
        $referrer = $this->getReferrerFromCode($code);
        if ($referrer && $referrer->id !== $newUser->id) {
             // Create a new referral record
             $referral = Referral::create([
                'referrer_id' => $referrer->id,
                'referred_id' => $newUser->id,
                'referral_code' => $code,
                'referred_email' => $newUser->email,
                'status' => 'accepted',
                'referred_at' => now(),
            ]);
            $this->scheduleReward($referral);
        }
    }

    private function scheduleReward(Referral $referral): void
    {
        // Check after 30 days if referred user is active
        // In a real app, this would be a dispatched job
        /*
        dispatch(function () use ($referral) {
            $referredUser = $referral->referred;

            // Active = logged in at least 10 times
            $loginCount = $referredUser->activities() // Assuming activities relation
                ->where('type', 'login')
                ->where('created_at', '>=', $referral->referred_at)
                ->count();

            if ($loginCount >= 10) {
                $this->rewardReferrer($referral);
            }
        })->delay(now()->addDays(30));
        */
    }
}

