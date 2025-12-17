<?php

namespace App\Services\Social;

use App\Models\MediaUploadSession;
use App\Models\SocialMedia;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

final class GuardianSignalService
{
    /**
     * Analyze media for guardian signals (e.g., male presence).
     *
     * @param SocialMedia|MediaUploadSession $media
     *
     * @return ((bool|int)[][]|bool|string)[] Analysis results
     *
     * @psalm-return array{analyzed_at: string, signals: array{male_presence: array{detected: bool, confidence: int<0, 99>}, adult_content: array{detected: false, confidence: int<0, 5>}}, flagged: bool}
     */
    public function analyze(Model $media): array
    {
        // In a real implementation, this would call an external AI service (AWS Rekognition, Google Vision, etc.)
        // For now, we simulate the analysis.

        $path = $media instanceof MediaUploadSession ? $media->storage_path : $media->file_path;
        $isSuspicious = $this->simulateDetection($path);

        $analysis = [
            'analyzed_at' => now()->toIso8601String(),
            'signals' => [
                'male_presence' => [
                    'detected' => $isSuspicious,
                    'confidence' => $isSuspicious ? rand(80, 99) : rand(0, 10),
                ],
                'adult_content' => [
                    'detected' => false,
                    'confidence' => rand(0, 5),
                ],
            ],
            'flagged' => $isSuspicious,
        ];

        // Update the media model
        if ($media instanceof SocialMedia) {
            $media->ai_analysis = array_merge($media->ai_analysis ?? [], ['guardian_signals' => $analysis]);
            $media->save();
        } elseif ($media instanceof MediaUploadSession) {
            $media->scan_labels = array_merge($media->scan_labels ?? [], ['guardian_signals' => $analysis]);
            $media->save();
        }

        if ($isSuspicious) {
            Log::warning("Guardian Signal Detected: Male presence suspected in media ID {$media->id}");
            // potentially trigger an alert or moderation queue
        }

        return $analysis;
    }

    /**
     * Simulate detection logic.
     * For demo purposes, we might flag files with "male" in the name, or just random.
     * Let's make it deterministic based on file size or name for testing.
     */
    private function simulateDetection(?string $path): bool
    {
        if (!$path) {
            return false;
        }
        // If the filename contains "test_male", flag it.
        if (str_contains(strtolower($path), 'test_male')) {
            return true;
        }

        return false;
    }
}

