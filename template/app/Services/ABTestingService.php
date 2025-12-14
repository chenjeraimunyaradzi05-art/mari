<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * A/B Testing Service for AI Algorithms
 *
 * Allows testing different AI models, algorithms, or parameters
 * to determine which performs better based on user engagement and success metrics
 */
class ABTestingService
{
    /**
     * Create a new A/B test
     *
     * @return (array|float|int|mixed|null|string)[]
     *
     * @psalm-return array{id: string, name: string, variants: array, traffic_split: list<float|int>|mixed, status: 'active', start_date: string, end_date: mixed|null, min_sample_size: 100|mixed, confidence_level: float|mixed, metrics: array{conversions: 0, total_users: 0, by_variant: array<array{users: 0, conversions: 0, conversion_rate: 0, avg_score: 0, total_score: 0, errors: 0, avg_response_time: 0}>}}
     */
    public function createTest(string $testName, array $variants, array $config = []): array
    {
        $testId = 'ab_test_' . md5($testName . time());

        $test = [
            'id' => $testId,
            'name' => $testName,
            'variants' => $variants, // e.g., ['algorithm_v1', 'algorithm_v2']
            'traffic_split' => $config['traffic_split'] ?? $this->equalSplit(count($variants)),
            'status' => 'active',
            'start_date' => now()->toDateTimeString(),
            'end_date' => $config['end_date'] ?? null,
            'min_sample_size' => $config['min_sample_size'] ?? 100,
            'confidence_level' => $config['confidence_level'] ?? 0.95,
            'metrics' => [
                'conversions' => 0,
                'total_users' => 0,
                'by_variant' => [],
            ],
        ];

        // Initialize metrics for each variant
        foreach ($variants as $variant) {
            $test['metrics']['by_variant'][$variant] = [
                'users' => 0,
                'conversions' => 0,
                'conversion_rate' => 0,
                'avg_score' => 0,
                'total_score' => 0,
                'errors' => 0,
                'avg_response_time' => 0,
            ];
        }

        // Store test configuration
        Cache::put("ab_test:{$testId}", $test, 86400 * 30); // 30 days

        // Add to active tests list
        $activeTests = Cache::get('ab_tests:active', []);
        $activeTests[$testId] = $testName;
        Cache::put('ab_tests:active', $activeTests, 86400 * 30);

        Log::info("A/B test created", ['test_id' => $testId, 'name' => $testName]);

        return $test;
    }

    /**
     * Assign user to a test variant
     */
    public function assignVariant(string $testId, int $userId): string
    {
        // Check if user already assigned
        $cacheKey = "ab_test_assignment:{$testId}:{$userId}";
        $assigned = Cache::get($cacheKey);

        if ($assigned) {
            return $assigned;
        }

        $test = Cache::get("ab_test:{$testId}");

        if (!$test || $test['status'] !== 'active') {
            // Return control variant if test not found/inactive
            return $test['variants'][0] ?? 'control';
        }

        // Assign based on traffic split
        $variant = $this->selectVariant($userId, $test['variants'], $test['traffic_split']);

        // Store assignment (persist for duration of test)
        Cache::put($cacheKey, $variant, 86400 * 30);

        // Increment user count for this variant
        $test['metrics']['total_users']++;
        $test['metrics']['by_variant'][$variant]['users']++;
        Cache::put("ab_test:{$testId}", $test, 86400 * 30);

        Log::debug("User assigned to variant", [
            'test_id' => $testId,
            'user_id' => $userId,
            'variant' => $variant,
        ]);

        return $variant;
    }

    /**
     * Track conversion (success event)
     */
    public function trackConversion(string $testId, int $userId, float $score = 1.0): void
    {
        $cacheKey = "ab_test_assignment:{$testId}:{$userId}";
        $variant = Cache::get($cacheKey);

        if (!$variant) {
            Log::warning("No variant assignment found for conversion tracking", [
                'test_id' => $testId,
                'user_id' => $userId,
            ]);
            return;
        }

        $test = Cache::get("ab_test:{$testId}");

        if (!$test) {
            return;
        }

        // Update metrics
        $test['metrics']['conversions']++;
        $test['metrics']['by_variant'][$variant]['conversions']++;
        $test['metrics']['by_variant'][$variant]['total_score'] += $score;

        // Recalculate rates and averages
        $variantData = &$test['metrics']['by_variant'][$variant];
        $variantData['conversion_rate'] = $variantData['users'] > 0
            ? round(($variantData['conversions'] / $variantData['users']) * 100, 2)
            : 0;
        $variantData['avg_score'] = $variantData['conversions'] > 0
            ? round($variantData['total_score'] / $variantData['conversions'], 2)
            : 0;

        Cache::put("ab_test:{$testId}", $test, 86400 * 30);

        Log::info("Conversion tracked", [
            'test_id' => $testId,
            'user_id' => $userId,
            'variant' => $variant,
            'score' => $score,
        ]);
    }

    /**
     * Track error/failure
     */
    public function trackError(string $testId, int $userId): void
    {
        $variant = Cache::get("ab_test_assignment:{$testId}:{$userId}");

        if (!$variant) {
            return;
        }

        $test = Cache::get("ab_test:{$testId}");

        if ($test) {
            $test['metrics']['by_variant'][$variant]['errors']++;
            Cache::put("ab_test:{$testId}", $test, 86400 * 30);
        }
    }

    /**
     * Track response time
     */
    public function trackResponseTime(string $testId, int $userId, float $responseTime): void
    {
        $variant = Cache::get("ab_test_assignment:{$testId}:{$userId}");

        if (!$variant) {
            return;
        }

        $test = Cache::get("ab_test:{$testId}");

        if ($test) {
            // Moving average for response time
            $current = $test['metrics']['by_variant'][$variant]['avg_response_time'];
            $count = $test['metrics']['by_variant'][$variant]['users'];

            $test['metrics']['by_variant'][$variant]['avg_response_time'] =
                round((($current * $count) + $responseTime) / ($count + 1), 2);

            Cache::put("ab_test:{$testId}", $test, 86400 * 30);
        }
    }

    /**
     * Get test results
     *
     * @return (array|bool|null|string)[]
     *
     * @psalm-return array{test?: array, winner?: array|null, has_enough_data?: bool, recommendation?: string, error?: 'Test not found'}
     */
    public function getTestResults(string $testId): array
    {
        $test = Cache::get("ab_test:{$testId}");

        if (!$test) {
            return ['error' => 'Test not found'];
        }

        // Calculate statistical significance
        array_keys($test['metrics']['by_variant']);
        $winner = $this->determineWinner($test);

        return [
            'test' => $test,
            'winner' => $winner,
            'has_enough_data' => $test['metrics']['total_users'] >= $test['min_sample_size'],
            'recommendation' => $this->getRecommendation($test, $winner),
        ];
    }

    /**
     * Stop a test
     */
    public function stopTest(string $testId): bool
    {
        $test = Cache::get("ab_test:{$testId}");

        if (!$test) {
            return false;
        }

        $test['status'] = 'stopped';
        $test['end_date'] = now()->toDateTimeString();

        Cache::put("ab_test:{$testId}", $test, 86400 * 90); // Keep for 90 days

        // Remove from active tests
        $activeTests = Cache::get('ab_tests:active', []);
        unset($activeTests[$testId]);
        Cache::put('ab_tests:active', $activeTests, 86400 * 30);

        Log::info("A/B test stopped", ['test_id' => $testId]);

        return true;
    }

    /**
     * Apply winning variant globally
     *
     * @return (bool|int|mixed|string)[]
     *
     * @psalm-return array{success: bool, winner?: mixed, conversion_rate?: mixed, improvement?: 0|mixed, message?: 'No winner determined'}
     */
    public function applyWinner(string $testId): array
    {
        $results = $this->getTestResults($testId);

        if (!isset($results['winner'])) {
            return ['success' => false, 'message' => 'No winner determined'];
        }

        $winner = $results['winner'];

        // Store winning variant configuration
        $configKey = "ai_config:{$results['test']['name']}";
        Cache::forever($configKey, $winner['variant']);

        // Stop the test
        $this->stopTest($testId);

        Log::info("Winning variant applied", [
            'test_id' => $testId,
            'winner' => $winner['variant'],
        ]);

        return [
            'success' => true,
            'winner' => $winner['variant'],
            'conversion_rate' => $winner['conversion_rate'],
            'improvement' => $winner['improvement'] ?? 0,
        ];
    }

    /**
     * Get all active tests
     *
     * @psalm-return list{0?: mixed,...}
     */
    public function getActiveTests(): array
    {
        $activeTestIds = Cache::get('ab_tests:active', []);
        $tests = [];

        foreach ($activeTestIds as $testId => $testName) {
            $test = Cache::get("ab_test:{$testId}");
            if ($test) {
                $tests[] = $test;
            }
        }

        return $tests;
    }

    // Private helper methods

    /**
     * @return (float|int)[]
     *
     * @psalm-return list<float|int>
     */
    private function equalSplit(int $variantCount): array
    {
        $percentage = 100 / $variantCount;
        return array_fill(0, $variantCount, $percentage);
    }

    private function selectVariant(int $userId, array $variants, array $split): string
    {
        // Deterministic assignment based on user ID
        $hash = crc32("user_{$userId}");
        $percentage = $hash % 100;

        $cumulative = 0;
        foreach ($variants as $index => $variant) {
            $cumulative += $split[$index];
            if ($percentage < $cumulative) {
                return $variant;
            }
        }

        return $variants[0]; // Fallback
    }

    private function determineWinner(array $test): ?array
    {
        $variants = $test['metrics']['by_variant'];

        if (count($variants) === 0) {
            return null;
        }

        $winner = null;
        $bestRate = 0;

        foreach ($variants as $name => $data) {
            if ($data['conversion_rate'] > $bestRate && $data['users'] >= 10) {
                $bestRate = $data['conversion_rate'];
                $winner = array_merge($data, ['variant' => $name]);
            }
        }

        // Calculate improvement over control (first variant)
        if ($winner) {
            $control = reset($variants);
            $winner['improvement'] = $control['conversion_rate'] > 0
                ? round((($winner['conversion_rate'] - $control['conversion_rate']) / $control['conversion_rate']) * 100, 2)
                : 0;
        }

        return $winner;
    }

    private function getRecommendation(array $test, ?array $winner): string
    {
        if (!$winner) {
            return 'Not enough data to determine a winner.';
        }

        if ($test['metrics']['total_users'] < $test['min_sample_size']) {
            return "Continue test. Need {$test['min_sample_size']} users (currently {$test['metrics']['total_users']}).";
        }

        if ($winner['improvement'] > 10) {
            return "Clear winner! Variant '{$winner['variant']}' shows {$winner['improvement']}% improvement. Recommend applying globally.";
        } elseif ($winner['improvement'] > 5) {
            return "Moderate improvement detected. Consider running test longer for more confidence.";
        } else {
            return "No significant difference found. Variants perform similarly.";
        }
    }
}

