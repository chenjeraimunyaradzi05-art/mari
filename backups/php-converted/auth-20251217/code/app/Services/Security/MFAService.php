<?php

namespace App\Services\Security;

use App\Models\MFABackupCode;
use App\Models\MFAMethod;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

final class MFAService
{
    protected $google2fa;

    /**
     * @psalm-return array{secret: mixed, qr_code: mixed}
     */
    public function setupTOTP(User $user): array
    {
        $secret = $this->google2fa->generateSecretKey();

        // Encrypt and store (or update existing unverified one)
        MFAMethod::updateOrCreate(
            [
                'user_id' => $user->id,
                'method_type' => 'totp',
            ],
            [
                'encrypted_secret' => $secret, // Model casts will handle encryption if set up, but let's be explicit or rely on model
                'is_verified' => false,
                'method_identifier' => $user->email,
            ]
        );

        // Generate QR code
        // We use the SVG format for better compatibility without GD
        $qrCodeUrl = $this->google2fa->getQRCodeUrl(
            config('app.name', 'Athena'),
            $user->email,
            $secret
        );

        $qrCode = QrCode::size(200)->generate($qrCodeUrl);

        return [
            'secret' => $secret,
            'qr_code' => $qrCode,
        ];
    }

    public function verifyTOTP(User $user, string $code): bool
    {
        $mfaMethod = $user->mfaMethods()->where('method_type', 'totp')->first();

        if (!$mfaMethod) return false;

        // If using model casting 'encrypted', accessing the attribute decrypts it automatically
        $secret = $mfaMethod->encrypted_secret;

        $valid = $this->google2fa->verifyKey($secret, $code, 2); // 2 window tolerance

        if ($valid && !$mfaMethod->is_verified) {
            $mfaMethod->update([
                'is_verified' => true,
                'verified_at' => now(),
                'is_primary' => true, // Make it primary if it's the first one verified
            ]);
        }

        return $valid;
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0?: string,...}
     */
    public function generateBackupCodes(User $user, int $count = 10): array
    {
        // Clear existing codes
        $user->mfaBackupCodes()->delete();

        $codes = [];

        for ($i = 0; $i < $count; $i++) {
            $code = strtoupper(Str::random(10));
            $codes[] = $code;

            MFABackupCode::create([
                'user_id' => $user->id,
                'code' => Hash::make($code),
                'used_at' => null,
            ]);
        }

        // Ensure backup codes method exists
        MFAMethod::firstOrCreate(
            [
                'user_id' => $user->id,
                'method_type' => 'backup_codes',
            ],
            [
                'is_verified' => true,
                'verified_at' => now(),
            ]
        );

        return $codes;
    }

    public function verifyBackupCode(User $user, string $code): bool
    {
        $backupCodes = $user->mfaBackupCodes()->whereNull('used_at')->get();

        foreach ($backupCodes as $backupCode) {
            if (Hash::check($code, $backupCode->code)) {
                $backupCode->update(['used_at' => now()]);
                return true;
            }
        }

        return false;
    }
}

